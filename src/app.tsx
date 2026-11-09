import { useEffect } from "react";
import { Moon01, Sun } from "@untitledui/icons";
import { Tabs } from "@/components/application/tabs/tabs";
import { Button } from "@/components/base/buttons/button";
import { ExportTab } from "@/features/export/export-tab";
import { InputPanel } from "@/features/input/input-panel";
import { PreviewTab } from "@/features/preview/preview-tab";
import { TokensTab } from "@/features/tokens/tokens-tab";
import { useAppStore } from "@/store/use-app-store";
import { useParsedTokens } from "@/store/use-parsed-tokens";

export function App() {
    const theme = useAppStore((s) => s.theme);
    const toggleTheme = useAppStore((s) => s.toggleTheme);
    const result = useParsedTokens();

    useEffect(() => {
        document.documentElement.classList.toggle("dark-mode", theme === "dark");
    }, [theme]);

    return (
        <div className="min-h-dvh bg-primary text-primary">
            <a
                href="#main"
                className="sr-only rounded-lg bg-brand-solid px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
            >
                Skip to content
            </a>
            <header className="border-b border-secondary">
                <div className="mx-auto flex max-w-container items-center justify-between gap-4 px-4 py-4 md:px-8">
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-primary md:text-xl">Tokens to Tailwind</h1>
                        <p className="text-sm text-tertiary">Design tokens in, Tailwind CSS 4 theme out. Runs entirely in your browser.</p>
                    </div>
                    <Button
                        color="secondary"
                        size="sm"
                        iconLeading={theme === "dark" ? Sun : Moon01}
                        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        onClick={toggleTheme}
                    />
                </div>
            </header>

            <main id="main" className="mx-auto grid max-w-container gap-8 px-4 py-6 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <InputPanel result={result} />

                <section aria-label="Results" className="min-w-0">
                    <Tabs defaultSelectedKey="tokens">
                        <Tabs.List type="underline" size="md" aria-label="Result views" className="overflow-x-auto">
                            <Tabs.Item id="tokens" label="Tokens" />
                            <Tabs.Item id="preview" label="Preview" />
                            <Tabs.Item id="export" label="Export" />
                        </Tabs.List>
                        <Tabs.Panel id="tokens" className="pt-6">
                            <TokensTab tokens={result.tokens} />
                        </Tabs.Panel>
                        <Tabs.Panel id="preview" className="pt-6">
                            <PreviewTab tokens={result.tokens} />
                        </Tabs.Panel>
                        <Tabs.Panel id="export" className="pt-6">
                            <ExportTab result={result} />
                        </Tabs.Panel>
                    </Tabs>
                </section>
            </main>

            <footer className="mx-auto max-w-container px-4 pb-8 text-sm text-tertiary md:px-8">
                Built by Eylül Güneş with React, Tailwind CSS 4 and Untitled UI.{" "}
                <a
                    className="font-semibold text-brand-secondary underline underline-offset-2"
                    href="https://github.com/eylulg/tokens-to-tailwind"
                >
                    Source on GitHub
                </a>
            </footer>
        </div>
    );
}
