---
'@jbpark/live-editor': patch
---

Fixed click/pointerdown/pointerup events being handled twice by listeners outside a shadow-mode frame. Shadow no longer manually redispatches these events on the host, since they already cross the shadow boundary on their own (composed: true).
