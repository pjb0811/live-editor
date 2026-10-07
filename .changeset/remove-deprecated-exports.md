---
'@jbpark/live-editor': major
---

Remove the exports deprecated in 4.x. The Utilities docs page lists each removed name with what to use instead.

- **`./utils`:** the internal helpers `transformCode`, `detectTypeScript`, `registerEditorSession`, `getCachedScriptBlob`, `clearScriptCache`, `generateSection`, `generateSections`, `createSectionPreviewCache` and `SectionPreviewCache`. Use `compile`, `preloadScripts` and `clearEditorCaches`.
- **`./utils/ast`:**
  - the internal helpers behind `useDndItems`, `extract` and the document layer, such as `parseBinding`, `extractNodeValue`, `moveArrayItems`, `parseDocument`, `fillIds` and `generateCode`. Use `extract`, `update`, `updateAll`, `useDndItems`, `extractSections`, `replaceSections` and `checkDocument`.
  - `bulkUpdate`. Use `updateAll`, which applies every entry or none. `UpdateResult` no longer has `failures`, which only `bulkUpdate` set.
- **`./dnd` and the package root:** the earlier names `useItemsEditor`, `useChildrenEditor`, `ItemsEditor*` and `ChildrenEditor*`. Use `useDndItems`, `useDndChildren`, `DndItems*` and `DndChildren*`.
