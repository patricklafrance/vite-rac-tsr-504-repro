import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(() => ({
    server: {
        port: 5173
    },
    resolve: {
        tsconfigPaths: true
    },
    // WORKAROUND: uncomment to fix the 504. Without it, navigating to /counter reproducibly
    // fails with "Failed to fetch dynamically imported module" because Vite's dep optimizer
    // bumps the per-subpath `?v=` hash for react-aria-components/Button between the time
    // the home page is served (which eagerly imports `react-aria-components/Link` via the
    // intent-ui Link wrapper) and the time modules/demo/src/counter/Counter.lazy.tsx is
    // evaluated on the client.
    //
    // optimizeDeps: {
    //     include: [
    //         "react-aria-components/Button",
    //         "react-aria-components/FieldError",
    //         "react-aria-components/Group",
    //         "react-aria-components/Input",
    //         "react-aria-components/Label",
    //         "react-aria-components/Link",
    //         "react-aria-components/Text",
    //         "react-aria-components/TextField",
    //         "react-aria-components/composeRenderProps"
    //     ]
    // },
    plugins: [
        tailwindcss(),
        tanstackStart({
            router: {
                enableRouteGeneration: false
            }
        }),
        // React's plugin must come after start's vite plugin.
        viteReact(),
        netlify()
    ]
}));
