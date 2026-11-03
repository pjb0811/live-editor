---
'@jbpark/live-editor': patch
---

Stop an error while generating `dynamicTailwind` CSS from becoming an unhandled rejection

When loading the Tailwind compiler or generating the CSS failed, the promise had no rejection handler, so the host page got an unhandled rejection. The preview also kept its previous CSS with nothing saying why. The failure is now logged with `console.error`, and the preview and canvas sections keep the last CSS that compiled.
