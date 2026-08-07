export const directMandelbrotShader = /* wgsl */ `
struct InputSample {
  c: vec2f,
  iterationCap: u32,
  bailoutSquared: f32,
}

struct OutputSample {
  status: u32,
  iterations: u32,
  radiusSquared: f32,
  reserved: u32,
}

@group(0) @binding(0) var<storage, read> inputs: array<InputSample>;
@group(0) @binding(1) var<storage, read_write> outputs: array<OutputSample>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) invocation: vec3u) {
  let index = invocation.x;
  if (index >= arrayLength(&inputs)) {
    return;
  }
  let sample = inputs[index];
  var z = vec2f(0.0, 0.0);
  var output = OutputSample(0u, sample.iterationCap, 0.0, 0u);
  for (var iteration = 1u; iteration <= sample.iterationCap; iteration += 1u) {
    z = vec2f(z.x * z.x - z.y * z.y + sample.c.x, 2.0 * z.x * z.y + sample.c.y);
    let radiusSquared = dot(z, z);
    if (radiusSquared > sample.bailoutSquared) {
      output = OutputSample(1u, iteration, radiusSquared, 0u);
      break;
    }
  }
  outputs[index] = output;
}
`;
