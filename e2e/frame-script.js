// Loaded into each section's iframe through `frame.scripts` by the `reorder`
// scenario. Marks the document it ran in, so a test can tell whether a
// document got the script.
document.documentElement.dataset.frameScript = 'loaded';
