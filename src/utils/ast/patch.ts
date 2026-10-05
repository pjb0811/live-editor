// Applies source edits by position: the spans `update` records are
// replaced, and everything else is copied as is, so an edit never reformats
// code it didn't touch (#239). Not `magic-string`, which would become a
// runtime dependency for features (source maps, moves) this doesn't need.
export interface SourceEdit {
  start: number;
  end: number;
  content: string;
  // Indent `content`'s later lines to match the line it lands on. Only for
  // generated code, which is printed from column zero; a value the author
  // wrote must go in exactly as written. Applied only when every newline is
  // layout (`hasOnlyLayoutNewlines`).
  indent?: boolean;
}

// Whether every newline in generated code is layout, not part of a value.
// Babel escapes newlines in ordinary strings, so a meaningful newline can
// only come from a template literal or JSX text, which start with a
// backtick or `<`. Indenting such a newline would change the value, again
// on every edit.
//
// Anything ambiguous returns false: a missed indent is harmless, a changed
// value is not.
const hasOnlyLayoutNewlines = (content: string): boolean => {
  let index = 0;

  while (index < content.length) {
    const char = content[index];

    // `<` also matches comparison operators and TS generics. Refusing those
    // is harmless.
    if (char === '`' || char === '<') {
      return false;
    }

    if (char === '"' || char === "'") {
      const next = skipStringLiteral(content, index);

      if (next === -1) {
        return false;
      }

      index = next;
      continue;
    }

    if (char === '/') {
      const following = content[index + 1];

      if (following === '/') {
        const lineEnd = content.indexOf('\n', index + 2);
        index = lineEnd === -1 ? content.length : lineEnd;
        continue;
      }

      if (following === '*') {
        const commentEnd = content.indexOf('*/', index + 2);

        if (commentEnd === -1) {
          return false;
        }

        index = commentEnd + 2;
        continue;
      }

      // Division or a regex literal — indistinguishable without parsing.
      return false;
    }

    index++;
  }

  return true;
};

// The index just past the closing quote, or -1 when the literal doesn't end
// on its line. Generated JS never has a bare newline in a string, so one
// means the scan is lost.
const skipStringLiteral = (content: string, start: number): number => {
  const quote = content[start];

  for (let index = start + 1; index < content.length; index++) {
    const char = content[index];

    if (char === '\\') {
      // A backslash before a newline is a line continuation, so the newline
      // is part of the string's source. Indenting it would change the
      // string: give up.
      const escaped = content[index + 1];

      if (escaped === '\n' || escaped === '\r') {
        return -1;
      }

      index++;
      continue;
    }

    if (char === quote) {
      return index + 1;
    }

    if (char === '\n') {
      return -1;
    }
  }

  return -1;
};

// Indentation of the line that `offset` falls on.
const lineIndentAt = (source: string, offset: number): string => {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const match = /^[ \t]*/.exec(source.slice(lineStart, offset));

  return match?.[0] ?? '';
};

// The file's own line ending, so generated code (always LF from Babel)
// doesn't mix endings in a CRLF file. Used only with re-indentation.
const lineTerminatorOf = (source: string): string => {
  return source.includes('\r\n') ? '\r\n' : '\n';
};

// Applies non-overlapping edits to `source` in one pass. An edit with
// `start === end` inserts. Throws on overlapping or out-of-range edits,
// which mean the caller's offsets are wrong, instead of returning broken
// source.
export const applyEdits = (source: string, edits: SourceEdit[]): string => {
  if (edits.length === 0) {
    return source;
  }

  const ordered = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);

  for (const edit of ordered) {
    if (
      !Number.isInteger(edit.start) ||
      !Number.isInteger(edit.end) ||
      edit.start < 0 ||
      edit.end > source.length ||
      edit.start > edit.end
    ) {
      throw new Error(
        `Invalid source edit [${edit.start}, ${edit.end}) for a source of length ${source.length}`,
      );
    }
  }

  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1]!;
    const current = ordered[i]!;

    if (current.start < previous.end) {
      throw new Error(
        `Overlapping source edits: [${previous.start}, ${previous.end}) and [${current.start}, ${current.end})`,
      );
    }
  }

  let result = '';
  let cursor = 0;
  const terminator = lineTerminatorOf(source);

  for (const edit of ordered) {
    const content =
      edit.indent &&
      edit.content.includes('\n') &&
      hasOnlyLayoutNewlines(edit.content)
        ? edit.content.replace(
            /\n/g,
            `${terminator}${lineIndentAt(source, edit.start)}`,
          )
        : edit.content;

    result += source.slice(cursor, edit.start) + content;
    cursor = edit.end;
  }

  return result + source.slice(cursor);
};
