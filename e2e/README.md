# Browser regression tests

`pnpm test:browser` runs the small Chromium suite against an isolated Vite
fixture. Playwright starts the server; no preview deployment or external
network request is needed during a test. Install the matching browser once
with `pnpm exec playwright install chromium`. CI installs Chromium and its OS
dependencies before running the same command.

The scenarios cover keyboard item range selection (#320), CodeMirror
focus/selection through a nested JSX item move (#359), preservation of
panel, external, and code-editor changes across DnD/Editor transitions, and
`autoHeight` measurement of animated `position: fixed` content (#374). The
second uses `HTMLElement.click()` deliberately: a physical click on the move
button is an intentional blur, whereas this test isolates the editor lifecycle
caused by moving a focused item.

The `autoHeight` and `transitions` scenarios are the cases that need a real
browser rather than a unit test: they turn on computed styles,
`getAnimations()`, real transition and animation timelines, and an iframe's own
default height, none of which jsdom provides.

`autoheight` holds its fade-ins at computed `opacity: 0` with a long
`animation-delay` and `animation-fill-mode: backwards` instead of racing a
short animation's clock, then completes them with `Animation.finish()`.

`transitions` covers the measurement pass no longer cancelling the preview's
own transitions. It drives one overlay by writing an inline `opacity`, which is
both what starts the transition and the mutation that schedules a measurement —
the collision that used to kill it. Assertions read computed opacity inside the
preview frame, since a snapped transition and a completed one reach the same
final height and only the intermediate value tells them apart.

Chromium is the supported browser for this initial suite. Expand to Firefox
or WebKit when a browser-specific behavior or support requirement warrants
their download and CI cost. On failure, Playwright retains a trace and
screenshot under `test-results/`; CI uploads those and the HTML report as a
`playwright-report` artifact.
