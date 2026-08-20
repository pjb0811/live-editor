import { compile } from 'tailwindcss';

// Loaded as `theme(reference)` below so utilities can resolve theme-dependent
// values (colors, spacing, font sizes, ...) without re-emitting the `@theme`
// block itself — see https://tailwindcss.com/docs/functions-and-directives#reference-directive.
// A checked-in copy (not a `?raw` import of the real file) because `?raw` is
// a Vite convention tsdown's bundler doesn't resolve, which would otherwise
// ship an unresolved specifier in dist/ that breaks for non-Vite consumers.
import themeCSS from './theme-css';

const compileClasses = async (classes: string[]): Promise<string> => {
  if (classes.length === 0) {
    return '';
  }

  const compiler = await compile(
    `@import "tailwindcss/theme.css" theme(reference); @tailwind utilities;`,
    {
      loadStylesheet: async () => ({
        content: themeCSS,
        base: '',
        path: 'tailwindcss/theme.css',
      }),
    },
  );

  return compiler.build(classes);
};

// Scans an already-rendered DOM subtree for `class` attributes, rather than
// regex-scanning the compiled source text. Source-text scanning can only see
// classes the reader typed literally (e.g. `className="p-6"`) — it has no
// way to know what classes an imported component (e.g. ui-kit's `Button`,
// `Typography.Title`) renders internally, since those live in that
// component's own compiled output, not the previewed source. Scanning the
// real DOM after mount catches both, because by then every class — reader-
// authored or contributed by a component — is actually present as an
// attribute.
export const generateTailwindCSSFromDOM = async (
  root: Element,
): Promise<string> => {
  const classes = new Set<string>();

  const collect = (el: Element) => {
    el.getAttribute('class')
      ?.split(/\s+/)
      .forEach(cls => {
        if (cls.trim()) {
          classes.add(cls.trim());
        }
      });
  };

  collect(root);
  root.querySelectorAll('[class]').forEach(collect);

  return compileClasses(Array.from(classes));
};
