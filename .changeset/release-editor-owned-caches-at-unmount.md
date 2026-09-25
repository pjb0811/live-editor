---
'@jbpark/live-editor': patch
---

Release every editor-owned cache when the last provider unmounts, not just
the compilation cache. Parsed documents, extracted bindings and the blob URLs
generated for external scripts previously outlived an editing session, freed
only when their LRU happened to evict them — so opening and closing an editor
repeatedly in one tab accumulated source-derived data, and blob URLs stayed
un-revoked.

`clearEditorCaches()` is the one place that knows the full set, so a cache
added to the compile or AST pipeline no longer has to be remembered at the
provider too. `clearScriptCache()` is exported alongside it for the script
cache on its own.

Cleanup is now reference counted through `registerEditorSession()`. Clearing
on any single unmount reached into providers that were still mounted, which
was survivable when a wasted compile was the only cost but is not once
revoking blob URLs is part of it.
