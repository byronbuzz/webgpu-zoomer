export const maximumPerturbationIterations = 512;

export const mandelbrotPerturbationPreviewShader = /* wgsl */ `
const MAXIMUM_ITERATIONS: u32 = 512u;

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

fn referenceLinear(reference: vec4f, delta: vec2f) -> vec2f {
  let zr = reference.x;
  let zi = reference.z;
  let lowR = reference.y;
  let lowI = reference.w;
  return vec2f(
    2.0 * ((zr * delta.x - zi * delta.y) + (lowR * delta.x - lowI * delta.y)),
    2.0 * ((zr * delta.y + zi * delta.x) + (lowR * delta.y + lowI * delta.x)),
  );
}

fn displayValue(reference: vec4f, delta: vec2f) -> vec2f {
  return vec2f(reference.x + reference.y + delta.x, reference.z + reference.w + delta.y);
}

fn colour(iteration: u32, z: vec2f) -> vec4f {
  let smoothIteration = f32(iteration) + 1.0 - log2(log2(length(z)));
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
  var delta = vec2f(0.0);

  for (var iteration = 0u; iteration < MAXIMUM_ITERATIONS; iteration += 1u) {
    if (iteration >= iterationCap) { break; }
    let nextDelta = referenceLinear(referenceOrbit.values[iteration], delta)
      + vec2f(delta.x * delta.x - delta.y * delta.y, 2.0 * delta.x * delta.y)
      + deltaC;
    let z = displayValue(referenceOrbit.values[iteration + 1u], nextDelta);
    if (!(max(abs(nextDelta.x), abs(nextDelta.y)) <= glitchLimit)) {
      return vec4f(0.72, 0.14, 0.62, 1.0);
    }
    if (dot(z, z) > 256.0) { return colour(iteration, z); }
    delta = nextDelta;
  }
  return vec4f(0.004, 0.008, 0.018, 1.0);
}
`;