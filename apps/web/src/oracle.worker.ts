/// <reference lib="webworker" />
type WasmOracle = Readonly<{
  default: () => Promise<void>;
  evaluate_json: (input: string) => string;
}>;

// Generated into public/wasm by `npm run build:wasm`; absence is a hard runtime diagnostic.
const wasmModuleUrl: string = "/wasm/precision_wasm.js";
const ready = import(/* @vite-ignore */ wasmModuleUrl).then(async (module) => {
  const oracle = module as WasmOracle;
  await oracle.default();
  return oracle;
});

self.addEventListener("message", async (event: MessageEvent<{ id: number; request: unknown }>) => {
  const oracle = await ready;
  const response = JSON.parse(oracle.evaluate_json(JSON.stringify(event.data.request))) as unknown;
  self.postMessage({ id: event.data.id, response });
});
