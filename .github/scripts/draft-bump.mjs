import fs from 'node:fs';

// The highest bump the changeset draft bot may write on its own. A major
// release is a human decision: the model only sees a truncated diff and
// can't check what's actually exported, so it can't reliably tell an
// internal refactor from a breaking API change. It once drafted `major` for
// a behavior-neutral refactor, and the Version Packages PR moved to a new
// major version (pjb0811/live-editor#457, #459). A breaking change drafted
// as `minor` still gets a human look, since the author has to confirm the
// drafted changeset anyway, and can edit it to `major`.
export const MAX_DRAFT_BUMP = 'minor';

// Returns the bump to write, and whether the model's own choice was lowered.
export const capDraftBump = bump =>
  bump === 'major'
    ? { bump: MAX_DRAFT_BUMP, capped: true }
    : { bump, capped: false };

// Makes a lowered bump visible where a reviewer looks: the workflow reads
// `capped` from the step output to suffix the bot's commit message, and the
// run's step summary says what to do about it.
export const reportCappedBump = (filePath, env = process.env) => {
  const note =
    `The model suggested a major bump for ${filePath}. It was drafted as ` +
    `${MAX_DRAFT_BUMP}, the most the bot writes on its own. If this change ` +
    'really calls for a major bump, edit the file to `major`.';

  console.log(note);

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, 'capped=true\n');
  }

  if (env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `### Changeset draft\n\n${note}\n`,
    );
  }
};
