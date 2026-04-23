// Minimal wrapper that re-exports react-aria-components/Button. The workspace
// wrapper shape is what matters for the repro — styling is irrelevant.
"use client";

import {
    Button as ButtonPrimitive,
    type ButtonProps as ButtonPrimitiveProps
} from "react-aria-components/Button";

export function Button(props: ButtonPrimitiveProps) {
    return <ButtonPrimitive {...props} />;
}
