# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install
```

**Note**: feel free to use the package manager of your choice.

## Local Development

```bash
pnpm start
```

This command builds the library (`pnpm --dir .. build`) and the iframe demos (`pnpm build:demos`), clears the Docusaurus cache, then starts a local development server and opens up a browser window.

Changes under `docs/` and `src/` are reflected live. Changes to the library itself (`../src`) are not: the site consumes the built `../dist` through `link:..`, and the bundler neither watches it nor invalidates its persistent cache for it. Stop the server and run `pnpm start` again. For demo-only changes (`../demos`), `pnpm build:demos` and a browser refresh are enough.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true npm run deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> npm run deploy
```

If you are using GitHub Pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
