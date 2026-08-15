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
            return Self {
                numerator,
                exponent: BigInt::zero(),
            };
        }
        while (&numerator & BigInt::one()).is_zero() {
            numerator >>= 1usize;
            exponent += 1u8;
        }
        Self {
            numerator,
            exponent,
        }
    }

    fn integer(value: impl Into<BigInt>) -> Self {
        Self::new(value.into(), BigInt::zero())
    }

    fn shift_to_usize(shift: &BigInt) -> Result<usize, Reason> {
        shift.to_usize().ok_or(Reason::ResourceBudgetExhausted)
    }

    fn add(&self, other: &Self) -> Result<Self, Reason> {
        let exponent = if self.exponent < other.exponent {
            &self.exponent
        } else {
            &other.exponent
        };
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
        Self::new(
            &self.numerator * &other.numerator,
            &self.exponent + &other.exponent,
        )
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

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleBatchLimits {
    pub maximum_items: u32,
    pub maximum_total_iterations: u32,
    pub maximum_numerator_bits: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleBatchRequest {
    pub schema_version: u32,
    pub requests: Vec<OracleRequest>,
    pub limits: OracleBatchLimits,
}

const MAXIMUM_REFERENCE_ITERATIONS: u32 = 50_000;
const MAXIMUM_BATCH_ITEMS: u32 = 64;
const MAXIMUM_BATCH_ITERATIONS: u32 = 100_000;
const MAXIMUM_NUMERATOR_BITS: u32 = 8_192;
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

fn exceeds_numerator_limit(value: &ExactDyadic, maximum_numerator_bits: u32) -> bool {
    value.numerator.bits() > u64::from(maximum_numerator_bits)
}

fn evaluate_with_numerator_limit(
    request: &OracleRequest,
    maximum_numerator_bits: u32,
) -> OracleResult {
    if request.schema_version != 1 || request.bailout_squared < 4 || request.precision_bits == 0 {
        return result(
            Status::Invalid,
            Reason::InvalidRequest,
            0,
            request.precision_bits,
        );
    }

    let x = match parse_wire(&request.c_re, request.precision_bits) {
        Ok(value) => value,
        Err(reason) => return result(Status::Unresolved, reason, 0, request.precision_bits),
    };
    let y = match parse_wire(&request.c_im, request.precision_bits) {
        Ok(value) => value,
        Err(reason) => return result(Status::Unresolved, reason, 0, request.precision_bits),
    };
    if exceeds_numerator_limit(&x, maximum_numerator_bits)
        || exceeds_numerator_limit(&y, maximum_numerator_bits)
    {
        return result(
            Status::Unresolved,
            Reason::ResourceBudgetExhausted,
            0,
            request.precision_bits,
        );
    }

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
        let next_r = match zr
            .multiply(&zr)
            .subtract(&zi.multiply(&zi))
            .and_then(|value| value.add(&x))
        {
            Ok(value) => value,
            Err(reason) => {
                return result(
                    Status::Unresolved,
                    reason,
                    iteration - 1,
                    request.precision_bits,
                );
            }
        };
        let next_i = match zr
            .multiply(&zi)
            .multiply(&ExactDyadic::integer(2u8))
            .add(&y)
        {
            Ok(value) => value,
            Err(reason) => {
                return result(
                    Status::Unresolved,
                    reason,
                    iteration - 1,
                    request.precision_bits,
                );
            }
        };
        if exceeds_numerator_limit(&next_r, maximum_numerator_bits)
            || exceeds_numerator_limit(&next_i, maximum_numerator_bits)
        {
            return result(
                Status::Unresolved,
                Reason::ResourceBudgetExhausted,
                iteration - 1,
                request.precision_bits,
            );
        }
        zr = next_r;
        zi = next_i;
        let radius = match zr.multiply(&zr).add(&zi.multiply(&zi)) {
            Ok(value) => value,
            Err(reason) => {
                return result(
                    Status::Unresolved,
                    reason,
                    iteration,
                    request.precision_bits,
                );
            }
        };
        if exceeds_numerator_limit(&radius, maximum_numerator_bits) {
            return result(
                Status::Unresolved,
                Reason::ResourceBudgetExhausted,
                iteration,
                request.precision_bits,
            );
        }
        if radius
            .compare(&bailout)
            .is_ok_and(|ordering| ordering == Ordering::Greater)
        {
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

pub fn evaluate(request: &OracleRequest) -> OracleResult {
    evaluate_with_numerator_limit(request, u32::MAX)
}

fn unresolved_batch_result(request: &OracleRequest) -> OracleResult {
    result(
        Status::Unresolved,
        Reason::ResourceBudgetExhausted,
        0,
        request.precision_bits,
    )
}

pub fn evaluate_batch(request: &OracleBatchRequest) -> Vec<OracleResult> {
    let limits = &request.limits;
    let invalid_limits = request.schema_version != 1
        || limits.maximum_items == 0
        || limits.maximum_items > MAXIMUM_BATCH_ITEMS
        || limits.maximum_total_iterations == 0
        || limits.maximum_total_iterations > MAXIMUM_BATCH_ITERATIONS
        || limits.maximum_numerator_bits == 0
        || limits.maximum_numerator_bits > MAXIMUM_NUMERATOR_BITS;
    let total_iterations = request
        .requests
        .iter()
        .try_fold(0u32, |total, item| total.checked_add(item.iteration_cap));
    let exceeds_work_budget = request.requests.len() > limits.maximum_items as usize
        || request
            .requests
            .iter()
            .any(|item| item.iteration_cap > MAXIMUM_REFERENCE_ITERATIONS)
        || total_iterations.map_or(true, |total| total > limits.maximum_total_iterations);
    if invalid_limits || exceeds_work_budget {
        return request
            .requests
            .iter()
            .map(unresolved_batch_result)
            .collect();
    }
    request
        .requests
        .iter()
        .map(|item| evaluate_with_numerator_limit(item, limits.maximum_numerator_bits))
        .collect()
}

pub fn evaluate_json(input: &str) -> String {
    match serde_json::from_str::<OracleRequest>(input) {
        Ok(request) => serde_json::to_string(&evaluate(&request)).expect("OracleResult serializes"),
        Err(_) => serde_json::to_string(&result(Status::Invalid, Reason::InvalidRequest, 0, 0))
            .expect("OracleResult serializes"),
    }
}

pub fn evaluate_batch_json(input: &str) -> String {
    match serde_json::from_str::<OracleBatchRequest>(input) {
        Ok(request) => serde_json::to_string(&evaluate_batch(&request))
            .expect("Batch oracle results serialize"),
        Err(_) => "[]".to_owned(),
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
        assert_eq!(
            evaluate(&request(("0", "0"), ("0", "0"), 0, 64)).status,
            Status::CertifiedInterior
        );
        assert_eq!(
            evaluate(&request(("-1", "0"), ("0", "0"), 64, 64)).status,
            Status::CertifiedInterior
        );
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

    fn batch(
        requests: Vec<OracleRequest>,
        maximum_total_iterations: u32,
        maximum_numerator_bits: u32,
    ) -> OracleBatchRequest {
        OracleBatchRequest {
            schema_version: 1,
            requests,
            limits: OracleBatchLimits {
                maximum_items: 64,
                maximum_total_iterations,
                maximum_numerator_bits,
            },
        }
    }

    #[test]
    fn bounded_batch_accepts_a_50k_iteration_ceiling_without_promoting_cap_exhaustion() {
        let results = evaluate_batch(&batch(
            vec![request(("1", "0"), ("0", "0"), 50_000, 64)],
            50_000,
            64,
        ));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].status, Status::Escaped);
        assert_eq!(results[0].iterations, 3);
    }

    #[test]
    fn bounded_batch_rejects_total_requested_work_before_evaluation() {
        let results = evaluate_batch(&batch(
            vec![
                request(("1", "0"), ("0", "0"), 50_000, 64),
                request(("1", "0"), ("0", "0"), 50_000, 64),
            ],
            50_000,
            64,
        ));
        assert!(
            results
                .iter()
                .all(|result| result.status == Status::Unresolved
                    && result.reason == Reason::ResourceBudgetExhausted
                    && result.iterations == 0)
        );
    }

    #[test]
    fn bounded_batch_stops_numerator_growth_as_unresolved() {
        let results = evaluate_batch(&batch(
            vec![request(("1", "0"), ("0", "0"), 50_000, 64)],
            50_000,
            1,
        ));
        assert_eq!(results[0].status, Status::Unresolved);
        assert_eq!(results[0].reason, Reason::ResourceBudgetExhausted);
    }
}
