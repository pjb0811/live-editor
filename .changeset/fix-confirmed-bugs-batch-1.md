---
'@jbpark/live-editor': patch
---

Fixed 7 confirmed bugs: Guard's onError prop being shadowed and never invoked, Field's blur handlers blocking clearing a value to empty, extractNodeValue not recognizing negative numeric literals, Items crashing when adding an item to an empty array, createBoundedCache not calling onEvict on overwrite/delete/clear, scriptCache sharing an unrelated cache's size limit, and compile()'s cache key using a collision-prone 32-bit hash.
