import type { AnyRoute } from "@tanstack/react-router";
import { createCounterRoutes } from "./counter/createCounterRoutes.tsx";

export function createDemoRoutes(parentRoute: AnyRoute) {
    return [...createCounterRoutes(parentRoute)];
}
