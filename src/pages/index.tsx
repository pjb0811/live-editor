import { useEffect, useSyncExternalStore } from 'react';

import { Button, Layout, Radio } from '@jbpark/ui-kit';
import { useLocalStorage } from '@jbpark/use-hooks';
import { Moon, Sun } from 'lucide-react';

import './index.css';

import CustomPanel from './custom-panel';
import Fallback from './fallback';
import Inspector from './inspector';
import Playground from './playground';
import PreviewModes from './preview-modes';
import { type Theme, ThemeContext } from './shared/theme';

// The dev app is a set of pages, one per feature to check by hand. Each page
// owns its own `<Live>` and document, so switching pages starts that feature
// from a known state instead of from whatever the last page left behind.
const PAGES = [
  { key: 'playground', label: 'Playground', Page: Playground },
  { key: 'custom-panel', label: 'Custom panel', Page: CustomPanel },
  { key: 'inspector', label: 'Inspector & options', Page: Inspector },
  { key: 'fallback', label: 'Section fallback', Page: Fallback },
  { key: 'preview-modes', label: 'Preview modes', Page: PreviewModes },
] as const;

type PageKey = (typeof PAGES)[number]['key'];

const THEME_KEY = 'live-editor-dev-theme';

// The page lives in the URL hash, so a reload or a shared link opens the same
// page without a router.
const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);

  return () => window.removeEventListener('hashchange', onChange);
};

const readPage = (): PageKey => {
  const key = window.location.hash.slice(1);

  return PAGES.some(page => page.key === key) ? (key as PageKey) : PAGES[0].key;
};

const App = () => {
  const current = useSyncExternalStore(subscribe, readPage);
  const { Page } = PAGES.find(page => page.key === current)!;
  const [theme, setTheme] = useLocalStorage<Theme>(THEME_KEY, 'light');

  // ui-kit's dark tokens key off `[data-theme="dark"]` on an ancestor, the
  // same switch a docs site flips on `<html>`. Setting it here also checks
  // that previews follow the host's theme (`syncStyle`, #497).
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    // A viewport-sized shell: `h-dvh` caps the height ui-kit's Layout would
    // otherwise only floor (its root is `min-h-screen`), and
    // `overflow-hidden` keeps a page from scrolling the document. Each page
    // scrolls inside its own panes.
    <Layout className="h-dvh overflow-hidden">
      <Layout.Header
        position="static"
        className="h-12 justify-between gap-2 p-2"
      >
        <div className="min-w-0 overflow-x-auto">
          <Radio.Group
            size="small"
            value={current}
            options={PAGES.map(({ key, label }) => ({ label, value: key }))}
            optionType="button"
            buttonStyle="solid"
            onChange={value => {
              window.location.hash = String(value);
            }}
          />
        </div>
        <Button
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
      </Layout.Header>
      {/*
        `min-h-0` lets this flex child shrink below its content's intrinsic
        height, so the space left after the header is a definite height each
        page can fill with `h-full`.
      */}
      <Layout.Content className="min-h-0">
        <ThemeContext value={theme}>
          <Page key={current} />
        </ThemeContext>
      </Layout.Content>
    </Layout>
  );
};

export default App;
