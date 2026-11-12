---
'@jbpark/live-editor': patch
---

Stop rewriting every copied style on any host `<head>` change with `frame.syncStyle`

With `syncStyle`, any change to the host's `<head>` set every attribute and the text of every copied style in every frame, including the ones that hadn't changed. Setting a `<style>`'s text makes the browser parse it again and build a new stylesheet, and the viewport-unit conversion ran again over the full CSS text each time. A copy is now written only where it differs from its source, and the conversion runs again only when that source's text changes. In Chromium, adding an unrelated `<style>` to a page with 9 framed canvas sections rebuilt all 126 copied stylesheets before, and none after.
