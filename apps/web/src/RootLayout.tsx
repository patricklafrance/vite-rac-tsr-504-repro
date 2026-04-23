import type { ReactNode } from "react";
import { Link as IntentLink } from "@/components/ui/link.tsx";
import { createLink } from "@tanstack/react-router";

const Link = createLink(IntentLink);

interface RootLayoutProps {
    children: ReactNode;
}

export function RootLayout({ children }: RootLayoutProps) {
    return (
        <>
            <nav style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ccc" }}>
                <Link to="/">Home</Link>
                <Link to="/counter">Counter</Link>
            </nav>
            <main style={{ padding: 16 }}>{children}</main>
        </>
    );
}
