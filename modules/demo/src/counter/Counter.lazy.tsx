import { createLazyRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button.tsx";

export const Route = createLazyRoute("/counter")({
    component: () => <Button onPress={() => alert("pressed")}>React Aria Button</Button>
});
