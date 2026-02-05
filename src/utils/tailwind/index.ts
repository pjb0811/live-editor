import { compile } from 'tailwindcss';

const extractClasses = (code: string): string[] => {
  const classes = new Set<string>();

  const cnPattern = /cn\(([^)]*(?:\([^)]*\)[^)]*)*)\)/gs;
  let cnMatch;

  while ((cnMatch = cnPattern.exec(code)) !== null) {
    const cnContent = cnMatch[1];

    const stringPattern = /['"`]([^'"`]+)['"`]/g;
    let strMatch;

    while ((strMatch = stringPattern.exec(cnContent!)) !== null) {
      strMatch[1]!.split(/\s+/).forEach(cls => {
        if (cls.trim()) classes.add(cls.trim());
      });
    }
  }

  const classNamePatterns = [
    /className=["']([^"']+)["']/g,
    /className=\{["'`]([^"'`]+)["'`]\}/g,
  ];

  for (const pattern of classNamePatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      match[1]!.split(/\s+/).forEach(cls => {
        if (cls.trim()) classes.add(cls.trim());
      });
    }
  }

  const conditionalPattern = /&&\s*['"`]([^'"`]+)['"`]/g;
  let condMatch;

  while ((condMatch = conditionalPattern.exec(code)) !== null) {
    condMatch[1]!.split(/\s+/).forEach(cls => {
      if (cls.trim()) classes.add(cls.trim());
    });
  }

  return Array.from(classes);
};

export const generateTailwindCSS = async (code: string): Promise<string> => {
  const classes = extractClasses(code);

  if (classes.length === 0) {
    return '';
  }

  const compiler = await compile(`@tailwind utilities;`);
  const css = compiler.build(classes);

  return css;
};
