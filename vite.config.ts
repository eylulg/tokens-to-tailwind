/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    base: "/tokens-to-tailwind/",
    plugins: [react(), tailwindcss()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
                    if (/node_modules\/(@react-aria|@react-stately|react-aria|react-aria-components|@internationalized)\//.test(id))
                        return "react-aria";
                    return undefined;
                },
            },
        },
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        globals: false,
        setupFiles: ["./src/test/setup.ts"],
        // theme.css is read with ?raw by the preview, so it must not be stubbed.
        css: { include: [/theme\.css/] },
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
