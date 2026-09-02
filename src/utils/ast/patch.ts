// Positional source patching: the write-side counterpart to `extract`'s
// read-side `loc`. `update` records the exact byte spans it wants to change
// and everything else is copied through verbatim, so an edit can no longer
// reformat code it didn't touch. See #239.
//
// Deliberately not `magic-string`: it is the usual tool for this, but it is
// only available here transitively (via Vite) and would have to become a
// real runtime dependency shipped to consumers' browsers. Its value is
// source maps and interleaved insert/move semantics — neither of which this
// needs. Edits here are non-overlapping span replacements applied in one
// forward pass, which is the whole implementation below.
export interface SourceEdit {
  start: number;
  end: number;
  content: string;
  // Re-indent `content`'s continuation lines to the indentation of the line
  // it lands on. Opt-in because it must apply to *generated* fragments only:
  // a generated fragment is printed from column zero and would otherwise
  // land ragged inside indented markup, whereas a raw user-authored value
  // (an innerHTML string, a hand-written JSX attribute) has to go in byte
  // for byte — re-indenting it would silently rewrite the value itself.
  //
  // Even within a generated fragment this is applied only when every
  // newline is provably layout; see `hasOnlyLayoutNewlines`.
  indent?: boolean;
}

// Whether every newline in generated code is layout rather than part of a
// value. Babel escapes newlines inside ordinary string literals, so the only
// newlines that carry meaning come from a template literal or from JSX text
// — and both announce themselves with a backtick or a `<`.
//
// This matters because indenting a value-newline silently rewrites the
// value, and the damage compounds: the built-in array editor re-serializes
// its own output and feeds it back through `update`, so an `innerHTML` leaf
// stored as a template literal would gain a level of indentation on every
// single edit.
//
// The scan is deliberately conservative. Quotes, comments and regex
// literals can all hide a backtick, and telling a regex from a division
// needs real parsing — so anything ambiguous returns false. A false
// "unsafe" only costs a fragment that isn't re-indented; a false "safe"
// corrupts the value.
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

// Index just past the closing quote, or -1 if the literal doesn't terminate
// before the end of its line. Valid generated JS never contains a bare
// newline inside a string literal, so hitting one means the scan has lost
// track of where it is and the caller should stop trusting it.
const skipStringLiteral = (content: string, start: number): number => {
  const quote = content[start];

  for (let index = start + 1; index < content.length; index++) {
    const char = content[index];

    if (char === '\\') {
      // A backslash immediately before a newline is a line continuation:
      // legal JS, and Babel re-emits it verbatim because it contributes
      // nothing to the value. The newline is then part of the literal's raw
      // text, so indenting it would rewrite the string — bail out instead
      // of treating the continuation as an ordinary escape.
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

// Babel always emits LF. Inserting that straight into a CRLF file leaves it
// with mixed endings, so a generated fragment adopts whichever the file
// already uses. Only ever applied alongside re-indentation, where the
// newlines are known to be layout rather than part of a value.
const lineTerminatorOf = (source: string): string => {
  return source.includes('\r\n') ? '\r\n' : '\n';
};

// Applies non-overlapping edits to `source` in a single forward pass.
// An edit with `start === end` is an insertion at that offset.
//
// Throws on overlapping or out-of-bounds edits rather than silently
// producing corrupt output: callers build spans from parsed node offsets,
// so an overlap means the caller's model of the tree is wrong, and a
// half-applied patch would be far harder to diagnose than a failure.
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
