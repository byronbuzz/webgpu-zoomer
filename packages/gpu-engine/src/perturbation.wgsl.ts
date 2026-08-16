export const maximumPerturbationIterations = 512;

export const mandelbrotPerturbationPreviewShader = /* wgsl */ `
const MAXIMUM_ITERATIONS: u32 = 512u;
const SPLITTER: f32 = 4097.0;

struct PerturbationUniforms {
  metrics: vec4f,
  guard: vec4f,
}

struct ReferenceOrbit {
  values: array<vec4f>,
}

@group(0) @binding(0) var<uniform> preview: PerturbationUniforms;
@group(0) @binding(1) var<storage, read> referenceOrbit: ReferenceOrbit;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  return vec4f(positions[index], 0.0, 1.0);
}

fn quickTwoSum(a: f32, b: f32) -> vec2f {
  let sum = a + b;
  return vec2f(sum, b - (sum - a));
}

fn twoSum(a: f32, b: f32) -> vec2f {
  let sum = a + b;
  let bVirtual = sum - a;
  let error = (a - (sum - bVirtual)) + (b - bVirtual);
  return vec2f(sum, error);
}

fn dsAdd(left: vec2f, right: vec2f) -> vec2f {
  let high = twoSum(left.x, right.x);
  let low = twoSum(left.y, right.y);
  let combined = quickTwoSum(high.x, high.y + low.x);
  return quickTwoSum(combined.x, combined.y + low.y);
}

fn dsSubtract(left: vec2f, right: vec2f) -> vec2f {
  return dsAdd(left, vec2f(-right.x, -right.y));
}

fn dsMultiply(left: vec2f, right: vec2f) -> vec2f {
  let product = left.x * right.x;
  let leftSplit = SPLITTER * left.x;
  let rightSplit = SPLITTER * right.x;
  let leftHigh = leftSplit - (leftSplit - left.x);
  let rightHigh = rightSplit - (rightSplit - right.x);
  let leftLow = left.x - leftHigh;
  let rightLow = right.x - rightHigh;
  let productError = ((leftHigh * rightHigh - product) + leftHigh * rightLow + leftLow * rightHigh)
    + leftLow * rightLow;
  return twoSum(product, productError + left.x * right.y + left.y * right.x + left.y * right.y);
}

fn complexAdd(left: vec4f, right: vec4f) -> vec4f {
  let real = dsAdd(left.xy, right.xy);
  let imaginary = dsAdd(left.zw, right.zw);
  return vec4f(real.x, real.y, imaginary.x, imaginary.y);
}

fn complexMultiply(left: vec4f, right: vec4f) -> vec4f {
  let real = dsSubtract(dsMultiply(left.xy, right.xy), dsMultiply(left.zw, right.zw));
  let imaginary = dsAdd(dsMultiply(left.xy, right.zw), dsMultiply(left.zw, right.xy));
  return vec4f(real.x, real.y, imaginary.x, imaginary.y);
}

fn complexScale(value: vec4f, factor: f32) -> vec4f {
  let real = dsMultiply(value.xy, vec2f(factor, 0.0));
  let imaginary = dsMultiply(value.zw, vec2f(factor, 0.0));
  return vec4f(real.x, real.y, imaginary.x, imaginary.y);
}

fn complexMagnitudeSquared(value: vec4f) -> vec2f {
  return dsAdd(dsMultiply(value.xy, value.xy), dsMultiply(value.zw, value.zw));
}

fn colour(iteration: u32, magnitudeSquared: vec2f) -> vec4f {
  let radius = sqrt(max(magnitudeSquared.x, 1.0001));
  let smoothIteration = f32(iteration) + 1.0 - log2(log2(radius));
  let phase = 0.035 * smoothIteration;
  let value = 0.5 + 0.5 * cos(6.2831853 * (vec3f(0.02, 0.18, 0.34) + phase));
  return vec4f(pow(value, vec3f(0.72)), 1.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let resolution = preview.metrics.xy;
  let scale = preview.metrics.z;
  let iterationCap = min(u32(preview.metrics.w), MAXIMUM_ITERATIONS);
  let aspect = resolution.x / resolution.y;
  let deltaC = (position.xy / resolution - vec2f(0.5)) * vec2f(aspect, -1.0) * scale + preview.guard.yz;
  let glitchLimit = preview.guard.x;
  var delta = vec4f(0.0);

  for (var iteration = 0u; iteration < MAXIMUM_ITERATIONS; iteration += 1u) {
    if (iteration >= iterationCap) { break; }
    let reference = referenceOrbit.values[iteration];
    let nextDelta = complexAdd(
      complexAdd(complexScale(complexMultiply(reference, delta), 2.0), complexMultiply(delta, delta)),
      vec4f(deltaC.x, 0.0, deltaC.y, 0.0),
    );
    if (!(max(max(abs(nextDelta.x), abs(nextDelta.y)), max(abs(nextDelta.z), abs(nextDelta.w))) <= glitchLimit)) {
      return vec4f(0.72, 0.14, 0.62, 1.0);
    }
    let z = complexAdd(referenceOrbit.values[iteration + 1u], nextDelta);
    let magnitudeSquared = complexMagnitudeSquared(z);
    if (magnitudeSquared.x > 256.0) { return colour(iteration, magnitudeSquared); }
    delta = nextDelta;
  }
  return vec4f(0.004, 0.008, 0.018, 1.0);
}
`;