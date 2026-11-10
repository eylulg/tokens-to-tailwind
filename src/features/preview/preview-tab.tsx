import { useId, useMemo } from "react";
import { Badge } from "@eylulg/ui/badge";
import { Button } from "@eylulg/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@eylulg/ui/card";
import { cx } from "@eylulg/ui/cx";
import { Input } from "@eylulg/ui/input";
import { Switch } from "@eylulg/ui/switch";
import { Tab, TabList, TabPanel, Tabs } from "@eylulg/ui/tabs";
import { Mail } from "lucide-react";
import type { Token } from "@/model/tokens";
import { useAppStore } from "@/store/use-app-store";
import { buildPreview } from "./preview-css";

export function PreviewTab({ tokens }: { tokens: Token[] }) {
    const naming = useAppStore((s) => s.naming);
    const colorFormat = useAppStore((s) => s.colorFormat);
    const previewDark = useAppStore((s) => s.previewDark);
    const setPreviewDark = useAppStore((s) => s.setPreviewDark);
    const scopeId = `preview-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const hasDark = tokens.some((t) => t.mode === "dark");

    const { css, notes } = useMemo(
        () => buildPreview(tokens, `#${scopeId}`, { naming, colorFormat }),
        [tokens, scopeId, naming, colorFormat],
    );

    return (
        <div className="flex flex-col gap-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-prose text-sm text-tertiary">
                    Library components rendered with the generated variables, scoped to this panel only.
                    {notes.length > 0 && ` Mapped to library roles: ${notes.join(", ")}.`}
                    {!hasDark && " These tokens have no dark set, so dark mode falls back to the library defaults."}
                </p>
                <Switch isSelected={previewDark} onChange={setPreviewDark}>
                    Dark preview
                </Switch>
            </div>

            <style>{css}</style>
            <div
                id={scopeId}
                data-testid="preview-scope"
                className={cx(
                    "rounded-2xl bg-secondary p-4 font-sans text-primary ring-1 ring-default ring-inset sm:p-6",
                    previewDark && "dark-mode",
                )}
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge color="brand" size="sm" dot>
                                New release
                            </Badge>
                            <Badge color="success" size="sm">
                                Stable
                            </Badge>
                        </div>
                        <CardHeader title="Ship your design system" />
                        <CardBody>
                            Tokens flow from Figma into code. Colors, type, radius and shadows on this card all come from the file you
                            loaded.
                        </CardBody>
                        <CardFooter className="justify-start">
                            <Button>Get started</Button>
                            <Button variant="secondary">Learn more</Button>
                            <Button variant="tertiary">Changelog</Button>
                        </CardFooter>
                    </Card>

                    <Card>
                        <form aria-labelledby={`${scopeId}-form`} className="contents" onSubmit={(event) => event.preventDefault()}>
                            <CardHeader title={<span id={`${scopeId}-form`}>Join the newsletter</span>} />
                            <Input
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                iconLeading={Mail}
                                hint="One email a month. No spam."
                            />
                            <Switch>Send me product news</Switch>
                            <CardFooter className="justify-start">
                                <Button type="submit">Subscribe</Button>
                                <Button variant="tertiary">Cancel</Button>
                            </CardFooter>
                        </form>
                    </Card>
                </div>

                <Tabs className="mt-4">
                    <TabList aria-label="Sample sections">
                        <Tab id="overview">Overview</Tab>
                        <Tab id="activity">Activity</Tab>
                        <Tab id="billing">Billing</Tab>
                    </TabList>
                    <TabPanel id="overview">A summary of the project, using the body text color.</TabPanel>
                    <TabPanel id="activity">Recent changes appear here.</TabPanel>
                    <TabPanel id="billing">Invoices and payment methods.</TabPanel>
                </Tabs>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Badge color="brand">Brand</Badge>
                    <Badge>Neutral</Badge>
                    <Badge color="success">Success</Badge>
                    <Badge color="error">Error</Badge>
                    <Badge color="warning">Warning</Badge>
                </div>
            </div>
        </div>
    );
}
