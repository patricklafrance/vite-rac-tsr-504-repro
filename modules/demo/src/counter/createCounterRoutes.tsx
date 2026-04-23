import { createRoute, type AnyRoute } from "@tanstack/react-router";

export function createCounterRoutes(parentRoute: AnyRoute) {
    const counterRoute = createRoute({
        getParentRoute: () => parentRoute,
        path: "/counter"
    }).lazy(() => import("./Counter.lazy.tsx").then(d => d.Route));

    return [counterRoute];
}
