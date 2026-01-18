## Commit Message Generation Guide

### Basic Rules

**Format**: `<emoji> <type>(<scope>): <subject>`

**Writing Language**: English

**Subject Line Rules**:

- Use imperative mood and present tense (e.g., "add" not "added" or "adds")
- Start with lowercase letter
- No period (.) at the end
- Keep it within 50 characters (English)

**Body Rules** (if needed):

- Add `-` before each bullet point
- Wrap at 72 characters (English) for readability
- Describe changes in detail

### Commit Type Selection

Choose the type that matches your changes:

- `feat`: Add a new feature
- `fix`: Fix a bug
- `docs`: Add or update documentation
- `style`: Change code style (formatting, semicolons, etc.)
- `refactor`: Improve code structure
- `perf`: Optimize performance
- `test`: Add or update tests
- `chore`: Other changes (build, dependencies, etc.)
- `ci`: Change CI/CD settings
- `build`: Change build system

### Scope Selection (Optional)

Use branch name if available, otherwise can be omitted:

- For hooks: `useBodyScrollLock`, `useDebounce`, `useLocalStorage`, etc.
- For UI: `components`, `styles`
- For configuration: `config`, `build`

### Gitmoji Selection

Choose the most appropriate emoji and add one space after it

**Main gitmoji**:
| emoji | Description |
|-------|-------------|
| ✨ | Add a new feature |
| 🐛 | Fix a bug |
| 📝 | Add or update documentation |
| 🎨 | Improve code structure/formatting |
| ♻️ | Refactor code |
| ⚡️ | Optimize performance |
| ✅ | Add or update tests |
| 🔧 | Change configuration files |
| 🚀 | Deploy |
| 🔥 | Delete code or files |
| ⬆️ | Upgrade dependencies |
| ⬇️ | Downgrade dependencies |
| 💚 | Fix CI build |
| 🚨 | Fix linter/compiler warnings |
| ✏️ | Fix typos |
| 💬 | Add or update text and literals |
| 💡 | Add or update source code comments |
| 🏗️ | Change architecture |
| 📱 | Work on responsive design |
| ♿️ | Improve accessibility |
| 💫 | Add or update animations/transitions |

**Example**:

```
✨ feat(useLocalStorage): add new local storage hook

- Implement custom hook wrapping LocalStorage API
- Include auto-sync and error handling features
- Provide TypeScript type safety
```
