import { create } from "zustand";
import type { ColorFormat, Naming } from "@/generator";
import { loadSession, saveSession } from "./session";

export type ExportFormat = "tailwind" | "css" | "json";

export interface AppState {
    source: string;
    /** File name or example name the source came from, if any. */
    sourceName: string | null;
    naming: Naming;
    colorFormat: ColorFormat;
    preserveAliases: boolean;
    mapRoles: boolean;
    exportFormat: ExportFormat;
    previewDark: boolean;
    setSource: (source: string, sourceName?: string | null) => void;
    setNaming: (naming: Naming) => void;
    setColorFormat: (colorFormat: ColorFormat) => void;
    setPreserveAliases: (preserveAliases: boolean) => void;
    setMapRoles: (mapRoles: boolean) => void;
    setExportFormat: (exportFormat: ExportFormat) => void;
    setPreviewDark: (previewDark: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
    source: "",
    sourceName: null,
    naming: "path",
    colorFormat: "oklch",
    preserveAliases: true,
    mapRoles: true,
    exportFormat: "tailwind",
    previewDark: false,
    setSource: (source, sourceName = null) => set({ source, sourceName }),
    setNaming: (naming) => set({ naming }),
    setColorFormat: (colorFormat) => set({ colorFormat }),
    setPreserveAliases: (preserveAliases) => set({ preserveAliases }),
    setMapRoles: (mapRoles) => set({ mapRoles }),
    setExportFormat: (exportFormat) => set({ exportFormat }),
    setPreviewDark: (previewDark) => set({ previewDark }),
    ...loadSession(),
}));

useAppStore.subscribe(saveSession);
