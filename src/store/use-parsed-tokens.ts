import { useDeferredValue, useMemo } from "react";
import { parseTokens } from "@/parsers";
import { useAppStore } from "./use-app-store";

/** Parses the current source. Deferred so typing in a large file stays responsive. */
export function useParsedTokens() {
    const source = useAppStore((s) => s.source);
    const deferred = useDeferredValue(source);
    return useMemo(() => parseTokens(deferred), [deferred]);
}
