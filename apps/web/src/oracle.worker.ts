/// <reference lib="webworker" />
import init, { evaluate_json } from "./generated/wasm/precision_wasm.js";

// Generated into the source graph by `npm run build:wasm`; absence is a hard build diagnostic.
const ready = init().then(() => ({ evaluate_json }));

self.addEventListener("message", async (event: MessageEvent<{ id: number; request: unknown }>) => {
  const oracle = await ready;
  const response = JSON.parse(oracle.evaluate_json(JSON.stringify(event.data.request))) as unknown;
  self.postMessage({ id: event.data.id, response });
});
