import { compile } from 'tailwindcss';

// Loaded with `reference`, so utilities can use theme values without
// emitting the `@theme` block (https://tailwindcss.com/docs/functions-and-directives#reference-directive).
// A copied file, not a `?raw` import, which only Vite understands.
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

// Collects the classes in a rendered DOM subtree. Reading the DOM, not the
// source, finds classes that imported components (such as ui-kit's
// `Button`) render too.
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
