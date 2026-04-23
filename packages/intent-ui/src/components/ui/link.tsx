"use client";

import {
    Link as LinkPrimitive,
    type LinkProps as LinkPrimitiveProps
} from "react-aria-components/Link";

export function Link(props: LinkPrimitiveProps) {
    return <LinkPrimitive {...props} />;
}
