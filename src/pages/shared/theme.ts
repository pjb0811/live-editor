import { createContext, useContext } from 'react';

import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';

export type Theme = 'light' | 'dark';

// The dev app's theme, set from the header. ui-kit and the previews follow
// `data-theme` on `<html>` by themselves, but a CodeMirror theme is an
// extension passed as a prop, so the code editors read it from here.
export const ThemeContext = createContext<Theme>('light');

export const useEditorTheme = () =>
  useContext(ThemeContext) === 'dark' ? vscodeDark : vscodeLight;
