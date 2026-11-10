import { AppShell, BrandMark, ProjectSwitcher, SiteFooter, ThemeToggle, TopNav } from "@eylulg/ui/chrome";
import { PageHeader } from "@eylulg/ui/page-header";
import { Tab, TabList, TabPanel, Tabs } from "@eylulg/ui/tabs";
import { ExportTab } from "@/features/export/export-tab";
import { InputPanel } from "@/features/input/input-panel";
import { PreviewTab } from "@/features/preview/preview-tab";
import { TokensTab } from "@/features/tokens/tokens-tab";
import { useParsedTokens } from "@/store/use-parsed-tokens";

const PROJECT_ID = "tokens-to-tailwind";

export function App() {
    const result = useParsedTokens();

    return (
        <AppShell
            header={
                <TopNav
                    productName="Tokens to Tailwind"
                    logo={<BrandMark />}
                    homeHref="."
                    actions={
                        <>
                            <ProjectSwitcher currentId={PROJECT_ID} />
                            <ThemeToggle />
                        </>
                    }
                />
            }
            footer={<SiteFooter currentId={PROJECT_ID} />}
        >
            <div className="mx-auto flex max-w-6xl flex-col gap-8">
                <PageHeader
                    title="Tokens to Tailwind"
                    description="Design tokens in, Tailwind CSS 4 theme out. Runs entirely in your browser."
                />
                <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                    <InputPanel result={result} />

                    <section aria-labelledby="results-heading" className="min-w-0">
                        <h2 id="results-heading" className="sr-only">
                            Results
                        </h2>
                        <Tabs>
                            <TabList aria-label="Result views" className="overflow-x-auto">
                                <Tab id="tokens">Tokens</Tab>
                                <Tab id="preview">Preview</Tab>
                                <Tab id="export">Export</Tab>
                            </TabList>
                            <TabPanel id="tokens" className="pt-2">
                                <TokensTab tokens={result.tokens} />
                            </TabPanel>
                            <TabPanel id="preview" className="pt-2">
                                <PreviewTab tokens={result.tokens} />
                            </TabPanel>
                            <TabPanel id="export" className="pt-2">
                                <ExportTab result={result} />
                            </TabPanel>
                        </Tabs>
                    </section>
                </div>
            </div>
        </AppShell>
    );
}
