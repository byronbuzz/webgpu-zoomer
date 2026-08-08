use precision::{OracleRequest, WireDyadic, evaluate};
use std::time::Instant;

fn main() {
    let request = OracleRequest {
        schema_version: 1,
        c_re: WireDyadic {
            numerator: "1".into(),
            exponent: "0".into(),
        },
        c_im: WireDyadic {
            numerator: "0".into(),
            exponent: "0".into(),
        },
        iteration_cap: 64,
        precision_bits: 256,
        bailout_squared: 4,
    };
    let runs = 10_000u32;
    let started = Instant::now();
    for _ in 0..runs {
        std::hint::black_box(evaluate(std::hint::black_box(&request)));
    }
    let elapsed = started.elapsed();
    println!(
        "{{\"candidate\":\"pure-rust-exact-dyadic\",\"runs\":{runs},\"elapsedNs\":{},\"nsPerSample\":{}}}",
        elapsed.as_nanos(),
        elapsed.as_nanos() / u128::from(runs)
    );
}
