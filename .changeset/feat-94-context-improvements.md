---
'@jbpark/live-editor': minor
---

usePreview/useError now throw a clear error when used without a `<Live>` ancestor instead of silently no-op'ing (this is a behavior change for any code that was relying on the silent no-op — please verify all usages are correctly wrapped). Also memoized ContextProvider's Provider values so consumers only re-render when code/error actually change.
