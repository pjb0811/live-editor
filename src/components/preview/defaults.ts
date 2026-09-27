// Stable defaults for optional object props. A `= {}` default is a new
// object on every render, which re-runs every memo keyed on it — the merged
// module map, and so `compile()` — even when the caller passed nothing (#348).
export const NO_PROPS: Record<string, unknown> = {};
export const NO_MODULES: Record<string, unknown> = {};
