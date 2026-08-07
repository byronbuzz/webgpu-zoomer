use num_bigint::BigInt;
use num_traits::{One, Signed, ToPrimitive, Zero};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::str::FromStr;

#[derive(Clone, Debug)]
struct ExactDyadic {
    numerator: BigInt,
    exponent: BigInt,
}

impl ExactDyadic {
    fn new(mut numerator: BigInt, mut exponent: BigInt) -> Self {
        if numerator.is_zero() {
            return Self { numerator, exponent: BigInt::zero() };
        }
        while (&numerator & BigInt::one()).is_zero() {
            numerator >>= 1usize;
            exponent += 1u8;
        }
        Self { numerator, exponent }
    }

    fn integer(value: impl Into<BigInt>) -> Self {
        Self::new(value.into(), BigInt::zero())
    }

    fn shift_to_usize(shift: &BigInt) -> Result<usize, Reason> {
        shift.to_usize().ok_or(Reason::ResourceBudgetExhausted)
    }

    fn add(&self, other: &Self) -> Result<Self, Reason> {
        let exponent = if self.exponent < other.exponent { &self.exponent } else { &other.exponent };
        let left_shift = Self::shift_to_usize(&(&self.exponent - exponent))?;
        let right_shift = Self::shift_to_usize(&(&other.exponent - exponent))?;
        Ok(Self::new(
            (&self.numerator << left_shift) + (&other.numerator << right_shift),
            exponent.clone(),
        ))
    }

    fn negate(&self) -> Self {
        Self::new(-&self.numerator, self.exponent.clone())
    }

    fn subtract(&self, other: &Self) -> Result<Self, Reason> {
        self.add(&other.negate())
    }

    fn multiply(&self, other: &Self) -> Self {
        Self::new(&self.numerator * &other.numerator, &self.exponent + &other.exponent)
    }

    fn compare(&self, other: &Self) -> Result<Ordering, Reason> {
        Ok(self.subtract(other)?.numerator.cmp(&BigInt::zero()))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WireDyadic {
    pub numerator: String,
    pub exponent: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleRequest {
    pub schema_version: u32,
    pub c_re: WireDyadic,
    pub c_im: WireDyadic,
    pub iteration_cap: u32,
    pub precision_bits: u32,
    pub bailout_squared: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Escaped,
    CertifiedInterior,
    Unresolved,
    Invalid,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    AnalyticInterior,
    EscapeProved,
    IterationBudgetExhausted,
    InsufficientPrecision,
    InvalidRequest,
    ResourceBudgetExhausted,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleResult {
    pub schema_version: u32,
    pub oracle_version: &'static str,
    pub status: Status,
    pub reason: Reason,
    pub iterations: u32,
    pub working_precision_bits: u32,
}

fn result(status: Status, reason: Reason, iterations: u32, precision_bits: u32) -> OracleResult {
    OracleResult {
        schema_version: 1,
        oracle_version: "exact-dyadic-v1",
        status,
        reason,
        iterations,
        working_precision_bits: precision_bits,
    }
}

fn parse_wire(value: &WireDyadic, precision_bits: u32) -> Result<ExactDyadic, Reason> {
    let numerator = BigInt::from_str(&value.numerator).map_err(|_| Reason::InvalidRequest)?;
    let exponent = BigInt::from_str(&value.exponent).map_err(|_| Reason::InvalidRequest)?;
    if numerator.is_zero() {
        return Ok(ExactDyadic::integer(0u8));
    }

    if exponent.is_negative() {
        let required = -&exponent;
        if required > BigInt::from(precision_bits) {
            return Err(Reason::InsufficientPrecision);
        }
        Ok(ExactDyadic::new(numerator, exponent))
    } else {
        let shift = exponent.to_usize().ok_or(Reason::ResourceBudgetExhausted)?;
        // Precision is also the explicit per-request allocation/work guard.
        if shift > precision_bits as usize + 64 {
            return Err(Reason::ResourceBudgetExhausted);
        }
        Ok(ExactDyadic::new(numerator, exponent))
    }
}

fn analytic_interior(x: &ExactDyadic, y: &ExactDyadic) -> Result<bool, Reason> {
    let one = ExactDyadic::integer(1u8);
    let sixteenth = ExactDyadic::new(BigInt::one(), BigInt::from(-4i8));
    let quarter = ExactDyadic::new(BigInt::one(), BigInt::from(-2i8));

    let bulb_x = x.add(&one)?;
    let bulb_radius = bulb_x.multiply(&bulb_x).add(&y.multiply(y))?;
    if bulb_radius.compare(&sixteenth)? != Ordering::Greater {
        return Ok(true);
    }

    let shifted_x = x.subtract(&quarter)?;
    let q = shifted_x.multiply(&shifted_x).add(&y.multiply(y))?;
    let left = q.multiply(&q.add(&shifted_x)?);
    let right = y.multiply(y).multiply(&quarter);
    Ok(left.compare(&right)? != Ordering::Greater)
}

pub fn evaluate(request: &OracleRequest) -> OracleResult {
    if request.schema_version != 1 || request.bailout_squared < 4 || request.precision_bits == 0 {
        return result(Status::Invalid, Reason::InvalidRequest, 0, request.precision_bits);
    }

    let x = match parse_wire(&request.c_re, request.precision_bits) {
        Ok(value) => value,
        Err(reason) => return result(Status::Unresolved, reason, 0, request.precision_bits),
    };
    let y = match parse_wire(&request.c_im, request.precision_bits) {
        Ok(value) => value,
        Err(reason) => return result(Status::Unresolved, reason, 0, request.precision_bits),
    };

    match analytic_interior(&x, &y) {
        Ok(true) => {
            return result(
                Status::CertifiedInterior,
                Reason::AnalyticInterior,
                0,
                request.precision_bits,
            );
        }
        Ok(false) => {}
        Err(reason) => return result(Status::Unresolved, reason, 0, request.precision_bits),
    }

    let mut zr = ExactDyadic::integer(0u8);
    let mut zi = ExactDyadic::integer(0u8);
    let bailout = ExactDyadic::integer(request.bailout_squared);

    for iteration in 1..=request.iteration_cap {
        let next_r = match zr.multiply(&zr).subtract(&zi.multiply(&zi)).and_then(|value| value.add(&x)) {
            Ok(value) => value,
            Err(reason) => return result(Status::Unresolved, reason, iteration - 1, request.precision_bits),
        };
        let next_i = match zr.multiply(&zi).multiply(&ExactDyadic::integer(2u8)).add(&y) {
            Ok(value) => value,
            Err(reason) => return result(Status::Unresolved, reason, iteration - 1, request.precision_bits),
        };
        zr = next_r;
        zi = next_i;
        let radius = match zr.multiply(&zr).add(&zi.multiply(&zi)) {
            Ok(value) => value,
            Err(reason) => return result(Status::Unresolved, reason, iteration, request.precision_bits),
        };
        if radius.compare(&bailout).is_ok_and(|ordering| ordering == Ordering::Greater) {
            return result(
                Status::Escaped,
                Reason::EscapeProved,
                iteration,
                request.precision_bits,
            );
        }
    }

    result(
        Status::Unresolved,
        Reason::IterationBudgetExhausted,
        request.iteration_cap,
        request.precision_bits,
    )
}

pub fn evaluate_json(input: &str) -> String {
    match serde_json::from_str::<OracleRequest>(input) {
        Ok(request) => serde_json::to_string(&evaluate(&request)).expect("OracleResult serializes"),
        Err(_) => serde_json::to_string(&result(Status::Invalid, Reason::InvalidRequest, 0, 0))
            .expect("OracleResult serializes"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(re: (&str, &str), im: (&str, &str), cap: u32, bits: u32) -> OracleRequest {
        OracleRequest {
            schema_version: 1,
            c_re: WireDyadic {
                numerator: re.0.into(),
                exponent: re.1.into(),
            },
            c_im: WireDyadic {
                numerator: im.0.into(),
                exponent: im.1.into(),
            },
            iteration_cap: cap,
            precision_bits: bits,
            bailout_squared: 4,
        }
    }

    #[test]
    fn proves_analytic_interiors() {
        assert_eq!(evaluate(&request(("0", "0"), ("0", "0"), 0, 64)).status, Status::CertifiedInterior);
        assert_eq!(evaluate(&request(("-1", "0"), ("0", "0"), 64, 64)).status, Status::CertifiedInterior);
    }

    #[test]
    fn proves_escape_with_exact_arithmetic() {
        let output = evaluate(&request(("1", "0"), ("0", "0"), 64, 64));
        assert_eq!(output.status, Status::Escaped);
        assert_eq!(output.iterations, 3);
    }

    #[test]
    fn cap_exhaustion_is_unresolved() {
        let output = evaluate(&request(("-2", "0"), ("0", "0"), 128, 64));
        assert_eq!(output.status, Status::Unresolved);
        assert_eq!(output.reason, Reason::IterationBudgetExhausted);
    }

    #[test]
    fn insufficient_precision_fails_safely_before_iteration() {
        let output = evaluate(&request(("1", "-4096"), ("0", "0"), 10, 512));
        assert_eq!(output.status, Status::Unresolved);
        assert_eq!(output.reason, Reason::InsufficientPrecision);
        assert_eq!(output.iterations, 0);
    }
}
