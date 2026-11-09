import { useId, useMemo } from "react";
import { Mail01 } from "@untitledui/icons";
import { Badge, BadgeWithDot } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { Toggle } from "@/components/base/toggle/toggle";
import type { Token } from "@/model/tokens";
import { useAppStore } from "@/store/use-app-store";
import { cx } from "@/utils/cx";
import { buildPreviewCss } from "./preview-css";

export function PreviewTab({ tokens }: { tokens: Token[] }) {
    const naming = useAppStore((s) => s.naming);
    const colorFormat = useAppStore((s) => s.colorFormat);
    const previewDark = useAppStore((s) => s.previewDark);
    const setPreviewDark = useAppStore((s) => s.setPreviewDark);
    const scopeId = `preview-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const hasDark = tokens.some((t) => t.mode === "dark");

    const css = useMemo(() => buildPreviewCss(tokens, `#${scopeId}`, { naming, colorFormat }), [tokens, scopeId, naming, colorFormat]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-prose text-sm text-tertiary">
                    Untitled UI components rendered with the generated variables, scoped to this panel only.
                    {!hasDark && " These tokens have no dark set, so dark mode falls back to the Untitled UI defaults."}
                </p>
                <Toggle label="Dark preview" isSelected={previewDark} onChange={setPreviewDark} />
            </div>

            <style>{css}</style>
            <div
                id={scopeId}
                data-testid="preview-scope"
                className={cx(
                    "rounded-2xl bg-secondary p-4 font-body text-primary ring-1 ring-secondary ring-inset sm:p-6",
                    previewDark && "dark-mode",
                )}
            >
                <div className="grid gap-4 lg:grid-cols-2">
                    <article
                        aria-labelledby={`${scopeId}-card`}
                        className="flex flex-col gap-4 rounded-xl bg-primary p-5 shadow-lg ring-1 ring-secondary ring-inset"
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <BadgeWithDot type="pill-color" color="brand" size="sm">
                                New release
                            </BadgeWithDot>
                            <Badge type="pill-color" color="success" size="sm">
                                Stable
                            </Badge>
                        </div>
                        <h3 id={`${scopeId}-card`} className="font-display text-display-xs font-semibold text-primary">
                            Ship your design system
                        </h3>
                        <p className="text-md text-tertiary">
                            Tokens flow from Figma into code. Colors, type, radius and shadows on this card all come from the file you
                            loaded.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button color="primary">Get started</Button>
                            <Button color="secondary">Learn more</Button>
                            <Button color="link-color">Changelog</Button>
                        </div>
                    </article>

                    <form
                        aria-labelledby={`${scopeId}-form`}
                        className="flex flex-col gap-4 rounded-xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset"
                        onSubmit={(event) => event.preventDefault()}
                    >
                        <h3 id={`${scopeId}-form`} className="text-lg font-semibold text-primary">
                            Join the newsletter
                        </h3>
                        <Input label="Email" type="email" placeholder="you@example.com" icon={Mail01} hint="One email a month. No spam." />
                        <Checkbox label="I agree to the privacy policy" />
                        <div className="flex flex-wrap gap-3">
                            <Button type="submit" color="primary">
                                Subscribe
                            </Button>
                            <Button color="tertiary">Cancel</Button>
                        </div>
                    </form>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <Badge type="color" color="brand">
                        Brand
                    </Badge>
                    <Badge type="color" color="gray">
                        Neutral
                    </Badge>
                    <Badge type="color" color="error">
                        Error
                    </Badge>
                    <Badge type="color" color="warning">
                        Warning
                    </Badge>
                    <Badge type="modern" color="gray">
                        Modern
                    </Badge>
                </div>
            </div>
        </div>
    );
}
