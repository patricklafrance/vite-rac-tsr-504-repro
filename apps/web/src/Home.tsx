import { createRoute, type AnyRoute } from "@tanstack/react-router";

function Home() {
    return <p>Click the Counter link to reproduce the 504.</p>;
}

export function createHomeRoute(parentRoute: AnyRoute) {
    return createRoute({
        getParentRoute: () => parentRoute,
        path: "/",
        component: Home
    });
}
