# Contributing to RepoLens

Thanks for your interest in building RepoLens with us! RepoLens is a
hackathon project for the **Build with Paritok: The Token-Efficiency
Hackathon**, and contributions of all sizes are welcome.

This is a small, friendly project — please be respectful in issues, PRs, and
reviews.

---

## Getting Started

1. **Fork** the repository and clone your fork.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. Make your changes. Keep commits small and focused.

## Development Workflow

Run the dev server while you work:

```bash
npm run dev
```

Before opening a pull request, please make sure all of the following pass:

```bash
npm run type-check   # TypeScript strict mode
npm run lint         # ESLint (Next.js config)
npm run format       # Prettier (writes)
npm run build        # Production build sanity check
```

## Project Conventions

- **Language:** TypeScript with `strict: true`. Avoid `any`; prefer precise
  types or `unknown` + narrowing.
- **Styling:** Tailwind utility classes only. Keep components small and
  presentational; lift state to pages or dedicated hooks later.
- **Imports:** Use the `@/...` path alias for cross-folder imports.
- **File naming:** React components in `PascalCase.tsx`; utilities/types in
  `camelCase.ts`.
- **Commits:** Imperative mood, ≤ 72 chars in the subject
  (e.g. `Add FeatureCard hover state`).
- **Phase discipline:** This is **Phase 1 (scaffold)**. Please don't add
  GitHub / Paritok / OpenAI integrations here — those land in later phases.

## Folder Map

| Folder | Purpose |
|--------|---------|
| `app/` | App Router routes (pages, layouts, API routes) |
| `components/` | Reusable presentational components |
| `lib/` | Pure utilities and integration placeholders |
| `types/` | Shared TypeScript types |
| `public/` | Static assets served at the site root |
| `docs/` | Project documentation |

## Reporting Issues

- Use GitHub Issues.
- Include reproduction steps, expected vs. actual behavior, and screenshots
  when relevant.
- For security issues, please contact a maintainer directly rather than
  opening a public issue.

## Code of Conduct

Be kind. Assume good faith. Focus on the work, not the person.

## License

By contributing, you agree that your contributions will be licensed under
the [Apache License 2.0](./LICENSE).
