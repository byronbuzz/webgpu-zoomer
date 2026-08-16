export const progressiveDispatchQuantum = 64;

export const mandelbrotProgressiveComputeShader = /* wgsl */ `
const DISPATCH_QUANTUM: u32 = 64u;

struct ProgressiveUniforms {
  metrics: vec4f,
  policy: vec4f,
}

struct PixelState {
  z: vec2f,
  iteration: u32,
  status: u32,
}

struct CoverageCounters {
  remaining: atomic<u32>,
  escaped: atomic<u32>,
  unresolved: atomic<u32>,
  reserved: atomic<u32>,
}

@group(0) @binding(0) var<uniform> request: ProgressiveUniforms;
@group(0) @binding(1) var<storage, read_write> states: array<PixelState>;
@group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<storage, read_write> coverage: CoverageCounters;

fn colour(iteration: u32, radiusSquared: f32) -> vec4f {
  let radius = sqrt(max(radiusSquared, 1.0001));
  let smoothIteration = f32(iteration) + 1.0 - log2(log2(radius));
  let phase = 0.035 * smoothIteration;
  let value = 0.5 + 0.5 * cos(6.2831853 * (vec3f(0.02, 0.18, 0.34) + phase));
  return vec4f(pow(value, vec3f(0.72)), 1.0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) invocation: vec3u) {
  let width = u32(request.metrics.x);
  let height = u32(request.metrics.y);
  if (invocation.x >= width || invocation.y >= height) { return; }
  let index = invocation.y * width + invocation.x;
  var state = states[index];
  if (state.status == 1u) {
    atomicAdd(&coverage.escaped, 1u);
    return;
  }

  let iterationLimit = u32(request.policy.y);
  let pixel = vec2f(f32(invocation.x) + 0.5, f32(invocation.y) + 0.5);
  let plane = (pixel / request.metrics.xy - vec2f(0.5))
    * vec2f(request.metrics.x / request.metrics.y, -1.0)
    * request.policy.x;
  let c = request.metrics.zw + plane;
  var escapedRadiusSquared = 0.0;

  for (var step = 0u; step < DISPATCH_QUANTUM; step += 1u) {
    if (state.iteration >= iterationLimit) { break; }
    state.z = vec2f(
      state.z.x * state.z.x - state.z.y * state.z.y + c.x,
      2.0 * state.z.x * state.z.y + c.y,
    );
    state.iteration += 1u;
    escapedRadiusSquared = dot(state.z, state.z);
    if (escapedRadiusSquared > 256.0) {
      state.status = 1u;
      break;
    }
  }
  states[index] = state;
  if (state.status == 1u) {
    atomicAdd(&coverage.escaped, 1u);
    textureStore(outputTexture, vec2u(invocation.xy), colour(state.iteration, escapedRadiusSquared));
  } else {
    if (state.iteration >= iterationLimit) {
      atomicAdd(&coverage.unresolved, 1u);
    } else {
      atomicAdd(&coverage.remaining, 1u);
    }
    textureStore(outputTexture, vec2u(invocation.xy), vec4f(0.004, 0.008, 0.018, 1.0));
  }
}
`;

export const mandelbrotProgressivePresentShader = /* wgsl */ `
@group(0) @binding(0) var progressiveTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  return vec4f(positions[index], 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  return textureLoad(progressiveTexture, vec2i(position.xy), 0);
}
`;
