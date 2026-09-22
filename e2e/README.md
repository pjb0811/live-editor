# Browser regression tests

`pnpm test:browser` runs the small Chromium suite against an isolated Vite
fixture. Playwright starts the server; no preview deployment or external
network request is needed during a test. Install the matching browser once
with `pnpm exec playwright install chromium`. CI installs Chromium and its OS
dependencies before running the same command.

The scenarios cover keyboard item range selection (#320), CodeMirror
focus/selection through a nested JSX item move (#359), and preservation of
panel, external, and code-editor changes across DnD/Editor transitions. The second
uses `HTMLElement.click()` deliberately: a physical click on the move button
is an intentional blur, whereas this test isolates the editor lifecycle
caused by moving a focused item.

Chromium is the supported browser for this initial suite. Expand to Firefox
or WebKit when a browser-specific behavior or support requirement warrants
their download and CI cost. On failure, Playwright retains a trace and
screenshot under `test-results/`; CI uploads those and the HTML report as a
`playwright-report` artifact.
