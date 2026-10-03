import CustomPalettePanelDemo from '../../../demos/custom-palette-panel/custom-palette-panel-demo';

// The docs demo for custom regions, mounted as is: a custom palette built on
// `DraggableItem`, panels built on `useDndPanel()`, `Field`, `useDndItems()`
// and `useDndChildren()`, and a layout of its own. Reusing it keeps the docs
// example and this check from drifting apart.
const CustomPanel = () => <CustomPalettePanelDemo />;

export default CustomPanel;
