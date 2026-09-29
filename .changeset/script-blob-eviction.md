---
'@jbpark/live-editor': patch
---

Fix preview scripts from `frame.scripts` occasionally not loading, with no error. Each script is cached as a blob URL, and the cache revoked a URL as soon as it evicted it. A frame waiting on several scripts, or several frames loading at once, could push more distinct scripts through the cache than it holds. The first URLs were then revoked before the frame injected them, and those `<script>` elements silently failed. A frame now holds its scripts' URLs until it has injected them. An evicted URL that is still held is revoked when the frame is done with it.
