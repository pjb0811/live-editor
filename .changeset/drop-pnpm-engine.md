---
'@jbpark/live-editor': patch
---

Drop the `pnpm` field from the published `engines`. It described how to develop this repository, not what installing the package needs, and made pnpm with `engine-strict` refuse to install the package on pnpm 9 or older. `engines.node` stays `>=20`, and CI now checks that the entries meant for Node load on Node 20.
