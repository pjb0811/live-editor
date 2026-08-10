---
'@jbpark/live-editor': patch
---

Fixed the iframe frame not loading new scripts after the scripts prop changed post-initial-load, and fixed removed styles/stylesheets staying injected in the iframe instead of being cleaned up.
