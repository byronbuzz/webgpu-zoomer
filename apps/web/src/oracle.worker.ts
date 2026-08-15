/// <reference lib="webworker" />
import init, { evaluate_batch_json, evaluate_json } from "./generated/wasm/precision_wasm.js";

type OracleWorkerRequest = Readonly<{
  id: number;
  kind?: "single" | "batch";
  request: unknown;
}>;

// Generated into the source graph by `npm run build:wasm`; absence is a hard build diagnostic.
const ready = init().then(() => ({ evaluate_batch_json, evaluate_json }));

self.addEventListener("message", async (event: MessageEvent<OracleWorkerRequest>) => {
  const oracle = await ready;
  const encoded = JSON.stringify(event.data.request);
  const response = JSON.parse(event.data.kind === "batch"
    ? oracle.evaluate_batch_json(encoded)
    : oracle.evaluate_json(encoded)) as unknown;
  self.postMessage({ id: event.data.id, response });
});
