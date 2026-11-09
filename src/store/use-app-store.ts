import { create } from "zustand";
import type { ColorFormat, Naming } from "@/generator";

export type ExportFormat = "tailwind" | "css" | "json";
export type Theme = "light" | "dark";

const THEME_KEY = "tokens-to-tailwind:theme";

function initialTheme(): Theme {
    try {
        const saved = window.localStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark") return saved;
    } catch {
        // Storage can be blocked; fall through to the system preference.
    }
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export interface AppState {
    source: string;
    /** File name or example name the source came from, if any. */
    sourceName: string | null;
    naming: Naming;
    colorFormat: ColorFormat;
    preserveAliases: boolean;
    exportFormat: ExportFormat;
    theme: Theme;
    previewDark: boolean;
    setSource: (source: string, sourceName?: string | null) => void;
    setNaming: (naming: Naming) => void;
    setColorFormat: (colorFormat: ColorFormat) => void;
    setPreserveAliases: (preserveAliases: boolean) => void;
    setExportFormat: (exportFormat: ExportFormat) => void;
    toggleTheme: () => void;
    setPreviewDark: (previewDark: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    source: "",
    sourceName: null,
    naming: "path",
    colorFormat: "oklch",
    preserveAliases: true,
    exportFormat: "tailwind",
    theme: initialTheme(),
    previewDark: false,
    setSource: (source, sourceName = null) => set({ source, sourceName }),
    setNaming: (naming) => set({ naming }),
    setColorFormat: (colorFormat) => set({ colorFormat }),
    setPreserveAliases: (preserveAliases) => set({ preserveAliases }),
    setExportFormat: (exportFormat) => set({ exportFormat }),
    toggleTheme: () =>
        set((state) => {
            const theme: Theme = state.theme === "dark" ? "light" : "dark";
            try {
                window.localStorage.setItem(THEME_KEY, theme);
            } catch {
                // Not persisted; the toggle still works for this visit.
            }
            return { theme };
        }),
    setPreviewDark: (previewDark) => set({ previewDark }),
}));
