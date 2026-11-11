---
'@jbpark/live-editor': patch
---

Apply the div props that `Live.Preview`, `Live.Error` and `Error.Runtime` accept

Their props types extend the `div` props, so TypeScript accepted `id`, `style`, `data-*`, `aria-*`, event handlers and `ref`, but `Live.Preview` applied only `className`, `Live.Error` only `className` and `style`, and `Error.Runtime` none of them. Each now applies them to its outer `div`, the element that already gets `className`, as `Live.Dnd` does. On `Live.Preview`, a host `style` is merged over the built-in one, and a host `ref` is merged with the internal one.

- `children` and `dangerouslySetInnerHTML` are no longer in these types. They were never applied, since each component renders its own content, so passing one is now a type error.
- `Live.Preview`'s `container` prop is deprecated. It has no effect and will be removed in the next major version.
