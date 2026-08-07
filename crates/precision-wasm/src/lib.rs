use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn evaluate_json(input: &str) -> String {
    precision::evaluate_json(input)
}
