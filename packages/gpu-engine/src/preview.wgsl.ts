export const mandelbrotPreviewShader = /* wgsl */ `
struct PreviewUniforms {
  resolution: vec2f,
  center: vec2f,
  scale: f32,
  padding0: f32,
  padding1: f32,
  padding2: f32,
}

@group(0) @binding(0) var<uniform> preview: PreviewUniforms;

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
  let aspect = preview.resolution.x / preview.resolution.y;
  let plane = (position.xy / preview.resolution - vec2f(0.5))
    * vec2f(aspect, -1.0)
    * preview.scale;
  let c = preview.center + plane;
  var z = vec2f(0.0);
  var escaped = false;
  var escapeIteration = 0u;

  for (var iteration = 0u; iteration < 320u; iteration += 1u) {
    z = vec2f(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 256.0) {
      escaped = true;
      escapeIteration = iteration;
      break;
    }
  }

  if (!escaped) {
    return vec4f(0.004, 0.008, 0.018, 1.0);
  }

  let smoothIteration = f32(escapeIteration) + 1.0 - log2(log2(length(z)));
  let phase = 0.035 * smoothIteration;
  let colour = 0.5 + 0.5 * cos(6.2831853 * (vec3f(0.02, 0.18, 0.34) + phase));
  return vec4f(pow(colour, vec3f(0.72)), 1.0);
}
`;
