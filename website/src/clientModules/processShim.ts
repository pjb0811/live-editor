// Docusaurus client modules run once per page load, browser-only — see
// docusaurus.config.ts for why this exists. Only a `.env` shape is needed:
// nothing in the bundled `@jbpark/live-editor` reads `process` beyond that.
if (typeof window !== 'undefined' && !('process' in window)) {
  (window as unknown as { process: { env: Record<string, unknown> } }).process =
    { env: {} };
}
