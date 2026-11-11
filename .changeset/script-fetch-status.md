---
'@jbpark/live-editor': patch
---

Stop caching a failed `frame.scripts` fetch as the script

A script in `frame.scripts` was fetched and turned into a blob URL without checking the response status. A 404 or 500 body, usually an HTML error page, was cached as the script for the rest of the session and injected into every frame, where it failed as a syntax error inside the frame. A response that isn't ok now rejects with the status and the URL, caches nothing, and a later load fetches the script again.
