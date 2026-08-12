import Core, { type Props as CoreProps } from './core';
import EditorImpl, { type EditorRenderData, type Props } from './editor';

type EditorComponent = typeof EditorImpl & { Core: typeof Core };

const Editor = EditorImpl as EditorComponent;

Editor.Core = Core;

export { Core };
export type { Props, CoreProps, EditorRenderData };
export default Editor;
