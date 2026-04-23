# vite-rac-tsr-504-repro

Reproduction for a Vite 8 dev-server race: navigating to a lazy TanStack
Router route whose lazy chunk imports `react-aria-components/Button` through
a workspace-package wrapper returns `504 Outdated Optimize Dep` on the
optimized dep, and the browser reports:

```
Uncaught TypeError: Failed to fetch dynamically imported module: .../Counter.lazy.tsx
```

Reproduces 5/5 times on cold start.

## Versions

| Package                             | Version   |
|-------------------------------------|-----------|
| vite                                | 8.0.9     |
| @vitejs/plugin-react                | 6.0.1     |
| @tanstack/react-start               | 1.167.42  |
| @tanstack/react-router              | 1.168.23  |
| @netlify/vite-plugin-tanstack-start | 1.3.7     |
| @tailwindcss/vite                   | 4.2.4     |
| react-aria-components               | 1.17.0    |
| react, react-dom                    | 19.2.5    |
| Node                                | 24        |
| OS                                  | Windows 11|

## Setup

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173, then click the **Counter** link.

You'll see in DevTools:

- Network: `GET /node_modules/.vite/deps/react-aria-components_Button.js?v=<HASH>` → **504 Outdated Optimize Dep**
- Console: `Uncaught TypeError: Failed to fetch dynamically imported module: .../Counter.lazy.tsx`

## Automated reproduction (5/5)

`test-cdp.mjs` drives a headless Chrome over CDP and reports 504s.

```bash
# Terminal 1
pnpm dev

# Terminal 2 — headless Chrome with remote debugging on port 9223
chrome --headless=new --user-data-dir=/tmp/chrome-cdp --remote-debugging-port=9223

# Terminal 3
for i in 1 2 3 4 5; do
  TARGET=http://localhost:5173 CLICK_HREF='/counter' node test-cdp.mjs | grep "504s observed"
done
```

Sample output (fresh clone, `.vite/deps` cleared beforehand):

```
504s observed: 1
504s observed: 1
504s observed: 1
504s observed: 1
504s observed: 1
```

## What's happening

Vite's cold-start dep optimizer pre-bundles
`react-aria-components/composeRenderProps` and
`react-aria-components/Link` (reachable via `RootLayout.tsx` → intent-ui
Link wrapper, which is eager). It does **not** pre-bundle
`react-aria-components/Button`, because:

1. `Button` is only reachable through `modules/demo/src/counter/Counter.lazy.tsx`.
2. `modules/demo` declares `@tanstack/react-start` as a `peerDependency` in its `package.json`.
3. `@tanstack/start-plugin-core`'s `crawlFrameworkPkgs` treats that as a framework package and adds it to `optimizeDeps.exclude`.
4. With the workspace excluded, the esbuild scanner does not follow imports into it, so `Button` is never seen at cold start.

On first `/counter` navigation:

1. Browser requests `Counter.lazy.tsx`.
2. Vite transforms it, resolves `@/components/ui/button.tsx` → the wrapper imports `react-aria-components/Button`.
3. Vite triggers on-the-fly optimization; assigns Button hash `A`; embeds `?v=A` in the served wrapper.
4. Optimizer re-scans and produces hash `B` for the final chunk.
5. Browser fetches `.../react-aria-components_Button.js?v=A` → Vite serves **504** (current hash is `B`).
6. The lazy `import()` promise rejects.

The race window is milliseconds wide but reproduces deterministically in
this config (Tailwind v4 plugin + Netlify plugin + TanStack Start plugin
together appear to widen it enough to make every run fail).

## Workaround

Uncomment the `optimizeDeps.include` block in `apps/web/vite.config.ts`:

```ts
optimizeDeps: {
    include: ["react-aria-components/Button"]
}
```

Forces discovery of `Button` at cold start. The race goes away.

Brittle: every new `react-aria-components/*` subpath that gets imported
only through a workspace-package symlink that's been excluded by
`crawlFrameworkPkgs` has to be added to this list by hand. Nothing in
Vite's, TanStack Start's, or React Aria's docs tells users they need to do
this.

## Structure (26 files)

```
.
├── apps/
│   └── web/
│       ├── vite.config.ts               # tanstackStart() + viteReact() + tailwindcss() + netlify()
│       └── src/
│           ├── routes/__root.tsx
│           ├── RootLayout.tsx           # eagerly imports @/components/ui/link.tsx (→ RAC/Link)
│           ├── Home.tsx
│           ├── router.tsx
│           └── styles.css               # @import "tailwindcss"
├── modules/
│   └── demo/                            # `@tanstack/react-start` in peerDeps → excluded from optimizeDeps
│       ├── package.json
│       └── src/
│           ├── createDemoRoutes.tsx
│           └── counter/
│               ├── createCounterRoutes.tsx
│               └── Counter.lazy.tsx     # imports @/components/ui/button.tsx (→ RAC/Button)
└── packages/
    ├── ts-configs/shared.json
    └── intent-ui/
        └── src/components/ui/
            ├── button.tsx               # minimal re-export of react-aria-components/Button
            └── link.tsx                 # minimal re-export of react-aria-components/Link
```

## What was tried but is NOT required

Each of these was in the original failing monorepo but can be removed
without losing reproduction:

- `tailwind-merge`, `tailwind-variants`, `tw-animate-css`, `tailwindcss-react-aria-components`
- `createServerFn`, `node:fs` imports, TSR loaders in the lazy route
- Any intent-ui wrapper other than Button and Link
- Any additional RAC subpaths beyond Button, Link, composeRenderProps

The minimal ingredients to reproduce are: the four Vite plugins above, the
workspace boundary with a Start-peerdep'd module, and an eager vs lazy
RAC-subpath split.
