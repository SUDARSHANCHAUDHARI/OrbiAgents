// acquireVsCodeApi must be called exactly once per webview lifetime.
// Import this module wherever you need to post messages to the extension.
const _api = typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

export function postMessage(msg: unknown): void {
  _api?.postMessage(msg);
}
