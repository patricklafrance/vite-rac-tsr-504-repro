# vite-rac-tsr-504-repro

Reproduction for a Vite 8 dev-server race: navigating to a lazy TanStack
Router route that imports `react-aria-components/Button` through a shared
workspace wrapper causes Vite's dep optimizer to bump the per-subpath `?v=`
hash **after** the lazy module has already been served referencing the
previous hash. The browser's subsequent fetch for the dep returns
`504 Outdated Optimize Dep`, which cascades into:

```
Uncaught TypeError: Failed to fetch dynamically imported module: .../Counter.lazy.tsx
```

## Versions

| Package                                | Version  |
|----------------------------------------|----------|
| vite                                   | 8.0.9    |
| @vitejs/plugin-react                   | 6.0.1    |
| @tanstack/react-start                  | 1.167.42 |
| @tanstack/react-router                 | 1.168.23 |
| @netlify/vite-plugin-tanstack-start    | 1.3.7    |
| @tailwindcss/vite                      | 4.2.4    |
| react-aria-components                  | 1.17.0   |
| tailwind-merge / tailwind-variants     | 3.x      |
| react, react-dom                       | 19.2.5   |
| Node                                   | 24       |
| OS                                     | Windows 11 |

## Setup

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173.

## Reproducing

1. Click the **Counter** link in the nav (direct URL hit works too).
2. Observe in DevTools Network tab:
   ```
   GET /node_modules/.vite/deps/react-aria-components_Button.js?v=<OLD>
       504 Outdated Optimize Dep
   ```
3. Observe in Console:
   ```
   Uncaught TypeError: Failed to fetch dynamically imported module:
       http://localhost:5173/@fs/…/modules/demo/src/counter/Counter.lazy.tsx
   ```

The first navigation after a cold start may succeed (~20% of the time in
our testing). Subsequent navigations reliably fail (~80%). Reload the page
or click between `/`, `/todos`, `/counter` a few times to surface it.

## Automated reproduction

`test-cdp.mjs` drives a headless Chrome over CDP and reports 504s seen:

```bash
# Terminal 1
pnpm dev

# Terminal 2 — start headless Chrome with remote debugging
chrome --headless=new --user-data-dir=/tmp/chrome-cdp --remote-debugging-port=9223

# Terminal 3 — run the harness repeatedly
for i in 1 2 3 4 5; do
  TARGET=http://localhost:5173 CLICK_HREF='/counter' node test-cdp.mjs | grep "504s observed"
done
```

Sample output (tested on 2026-04-22 on a fresh clone of this repo, Vite's
`.vite/deps` cache cleared before run 1):

```
504s observed: 0
504s observed: 1
504s observed: 1
504s observed: 1
504s observed: 1
```

## What's happening

### Initial Vite `.vite/deps/_metadata.json` after cold start

`react-aria-components_Button` is **not** optimized at cold start. Only
subpaths reachable from non-lazy imports (like
`react-aria-components/Link`, `react-aria-components/composeRenderProps`,
pulled in via `apps/web/src/RootLayout.tsx` → intent-ui `Link`) are in the
initial batch. This is because `@modules/demo` lists
`@tanstack/react-start` as a peer dep, so
`@tanstack/start-plugin-core`'s `crawlFrameworkPkgs` excludes it from
`optimizeDeps`, and the esbuild scanner doesn't follow imports into it.

### The race on first `/counter` navigation

1. Browser requests `Counter.lazy.tsx`.
2. Vite transforms it; the static `import { Button } from "@/components/ui/button.tsx"` resolves to the intent-ui wrapper.
3. The wrapper imports `react-aria-components/Button`, which is new.
4. Vite triggers on-the-fly dep optimization for `react-aria-components/Button`, assigning it hash `A`.
5. Vite serves the transformed wrapper with `?v=A` embedded.
6. Concurrently, the optimizer re-scans and promotes the new entry into a fresh batch, assigning hash `B` to the finalized chunk.
7. Browser fetches `.../react-aria-components_Button.js?v=A` → Vite returns **504 Outdated Optimize Dep** because the current hash is `B`.
8. The dynamic `import()` promise rejects → `Failed to fetch dynamically imported module`.

The window is milliseconds; whether it manifests depends on machine load
and optimizer timing. On the test machine, it reproduces ~4 / 5 times.

## Workaround

`apps/web/vite.config.ts` has a commented-out `optimizeDeps.include` block
listing every `react-aria-components/*` subpath the app uses. Uncomment it
to force discovery at cold start, removing the race.

```ts
optimizeDeps: {
    include: [
        "react-aria-components/Button",
        "react-aria-components/FieldError",
        "react-aria-components/Group",
        "react-aria-components/Input",
        "react-aria-components/Label",
        "react-aria-components/Link",
        "react-aria-components/Text",
        "react-aria-components/TextField",
        "react-aria-components/composeRenderProps"
    ]
}
```

It works, but the list has to be maintained by hand. Adding a new
intent-ui component that pulls a new RAC subpath re-opens the race until
someone updates the include list. No documented guidance from Vite,
TanStack Start, or React Aria tells users they need this.

## Structure

Extracted from a real-world monorepo; kept as close to the failing config
as possible:

```
vite-rac-tsr-504-repro/
├── pnpm-workspace.yaml
├── apps/
│   └── web/
│       ├── vite.config.ts             # tanstackStart() + viteReact() + tailwindcss() + netlify()
│       └── src/
│           ├── routes/__root.tsx
│           ├── RootLayout.tsx         # nav imports `@/components/ui/link.tsx` (eager)
│           ├── Home.tsx
│           ├── styles.css             # tailwind v4
│           └── router.tsx
├── modules/
│   └── demo/                          # has `@tanstack/react-start` in peerDeps → excluded from optimizeDeps
│       └── src/
│           ├── createDemoRoutes.tsx
│           ├── counter/               # /counter — lazy, imports intent-ui Button → RAC/Button
│           │   ├── createCounterRoutes.tsx
│           │   ├── Counter.tsx        # server fn for loader
│           │   └── Counter.lazy.tsx
│           └── todos/                 # extra lazy routes for weight
└── packages/
    ├── ts-configs/shared.json
    └── intent-ui/                     # shadcn-derived RAC wrappers with tailwind-variants + twMerge
        └── src/
            ├── lib/primitive.ts       # imports RAC/composeRenderProps
            └── components/ui/*.tsx    # each imports a different RAC subpath
```
