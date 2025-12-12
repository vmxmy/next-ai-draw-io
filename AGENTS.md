# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, and API routes. UI entrypoints live here.
- `components/`: Reusable React UI components (shadcn/ui + Radix). Keep components small and composable.
- `contexts/`: React context providers and hooks for cross‑cutting state.
- `lib/`: Client/server utilities, AI provider adapters, and shared helpers.
- `public/`: Static assets (icons, images). Refer via `/` paths.
- `docs/`: Project notes and design docs.

## Build, Test, and Development Commands
Install deps: `npm install`
- `npm run dev`: Start local dev server on port `6002` with Turbopack.
- `npm run build`: Production build. Use this before opening a PR.
- `npm run start`: Run the built app on port `6001`.
- `npm run lint`: Run Biome lints over the repo.
- `npm run format`: Auto‑format using Biome.
- `npm run check`: CI‑style Biome checks (no writes).

## Coding Style & Naming Conventions
- Language: TypeScript + React. Prefer functional components and hooks.
- Indentation: 2 spaces; keep files UTF‑8.
- Naming: `camelCase` for variables/functions, `PascalCase` for components, `kebab-case` for file names when appropriate.
- Styling: Tailwind CSS; avoid inline styles unless necessary.
- Formatting/Linting: Biome is the single source of truth. Run `npm run format` before commit.

## Testing Guidelines
There is no dedicated test suite yet. Validate changes by:
- Running `npm run lint` and `npm run build`.
- Manually checking key flows in `npm run dev`.
If you add tests, follow the existing folder structure and keep test files near the code they cover.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add export modal`, `fix: handle malformed XML`).
- PRs should include: a clear description, linked issue (if any), and screenshots/GIFs for UI changes.
- Keep PRs focused; avoid unrelated refactors.

## Security & Configuration Tips
- Do not commit secrets. Copy `env.example` to `.env.local` for local setup.
- When adding new AI providers or external APIs, document required env vars in `env.example` and `README.md`.
