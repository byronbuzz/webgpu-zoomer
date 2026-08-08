export const presentationCompositeShader = /* wgsl */ `
struct CompositeCell {
  clipBounds: vec4f,
  escapeIterations: f32,
  source: f32,
  padding: vec2f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) escapeIterations: f32,
  @location(2) source: f32,
}

@group(0) @binding(0) var<storage, read> cells: array<CompositeCell>;

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let cell = cells[instanceIndex];
  let local = corners[vertexIndex];
  let clip = mix(cell.clipBounds.xy, cell.clipBounds.zw, local);
  var output: VertexOutput;
  output.position = vec4f(clip, 0.0, 1.0);
  output.local = local;
  output.escapeIterations = cell.escapeIterations;
  output.source = cell.source;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let edge = min(min(input.local.x, input.local.y), min(1.0 - input.local.x, 1.0 - input.local.y));
  if (input.source < 0.5) {
    let phase = input.escapeIterations * 0.075;
    let colour = 0.5 + 0.5 * cos(6.2831853 * (vec3f(0.04, 0.22, 0.42) + phase));
    let alpha = select(0.10, 0.30, edge < 0.025);
    return vec4f(colour * alpha, alpha);
  }
  let stripe = fract((input.position.x + input.position.y) / 12.0);
  let alpha = select(0.10, 0.34, stripe < 0.28 || edge < 0.035);
  return vec4f(vec3f(0.72, 0.20, 0.62) * alpha, alpha);
}
`;
