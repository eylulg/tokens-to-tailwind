import { useId } from "react";
import { AlertCircle, AlertTriangle, UploadCloud02 } from "@untitledui/icons";
import type { DropZoneProps as AriaDropZoneProps } from "react-aria-components";
import {
    DropZone as AriaDropZone,
    FileTrigger as AriaFileTrigger,
    Text as AriaText,
    TextField as AriaTextField,
} from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import { Label } from "@/components/base/input/label";
import { TextAreaBase } from "@/components/base/textarea/textarea";
import { EXAMPLES } from "@/examples";
import type { ParseResult } from "@/model/tokens";
import { FORMAT_LABELS, countTokens } from "@/model/tokens";
import { useAppStore } from "@/store/use-app-store";
import { cx } from "@/utils/cx";

type DropEvent = Parameters<NonNullable<AriaDropZoneProps["onDrop"]>>[0];

const ACCEPTED_TYPES = ["application/json", "text/plain", ".json"];

async function readDrop(event: DropEvent): Promise<{ text: string; name: string } | null> {
    for (const item of event.items) {
        if (item.kind === "file") return { text: await item.getText(), name: item.name };
        if (item.kind === "text" && item.types.has("text/plain")) return { text: await item.getText("text/plain"), name: "Dropped text" };
    }
    return null;
}

function statusMessage(result: ParseResult, hasSource: boolean): string {
    if (!hasSource) return "No tokens loaded yet.";
    if (result.errors.length) {
        const count = result.errors.length === 1 ? "1 error" : `${result.errors.length} errors`;
        return `${count}. ${result.errors[0].message}`;
    }
    const format = result.format ? FORMAT_LABELS[result.format] : "Unknown format";
    return `${format} detected, ${countTokens(result.tokens)} tokens parsed.`;
}

export function InputPanel({ result }: { result: ParseResult }) {
    const source = useAppStore((s) => s.source);
    const sourceName = useAppStore((s) => s.sourceName);
    const setSource = useAppStore((s) => s.setSource);
    const hintId = useId();

    const loadFile = async (file: File) => setSource(await file.text(), file.name);

    return (
        <section aria-labelledby="input-heading" className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1">
                <h2 id="input-heading" className="text-lg font-semibold text-primary">
                    Input
                </h2>
                <p className="text-sm text-tertiary">Paste a tokens file, drop one in, or start from an example.</p>
            </div>

            <div role="group" aria-labelledby="examples-label" className="flex flex-col gap-2">
                <span id="examples-label" className="text-sm font-medium text-secondary">
                    Load example
                </span>
                <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => (
                        <Button
                            key={example.format}
                            size="sm"
                            color="secondary"
                            aria-label={`Load ${example.label} example`}
                            onClick={() => setSource(example.text, `${example.label} example`)}
                        >
                            {example.label}
                        </Button>
                    ))}
                </div>
            </div>

            <AriaDropZone
                getDropOperation={(types) => (ACCEPTED_TYPES.some((t) => types.has(t)) || types.has("text/plain") ? "copy" : "cancel")}
                onDrop={async (event) => {
                    const dropped = await readDrop(event);
                    if (dropped) setSource(dropped.text, dropped.name);
                }}
                className={({ isDropTarget, isFocusVisible }) =>
                    cx(
                        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-primary bg-primary px-4 py-5 text-center transition duration-100 ease-linear",
                        isDropTarget && "border-brand bg-brand-primary",
                        isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                    )
                }
            >
                <UploadCloud02 aria-hidden="true" className="size-6 text-fg-quaternary" />
                <AriaText slot="label" className="text-sm text-tertiary">
                    Drop a <span className="font-medium text-secondary">.json</span> tokens file here, or
                </AriaText>
                <AriaFileTrigger
                    acceptedFileTypes={ACCEPTED_TYPES}
                    onSelect={(files) => {
                        const file = files?.[0];
                        if (file) void loadFile(file);
                    }}
                >
                    <Button size="sm" color="secondary">
                        Choose file
                    </Button>
                </AriaFileTrigger>
            </AriaDropZone>

            <AriaTextField
                value={source}
                onChange={(value) => setSource(value, null)}
                className="flex flex-col gap-1.5"
                aria-describedby={hintId}
            >
                <Label>Tokens JSON</Label>
                <TextAreaBase
                    rows={16}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    placeholder='{ "color": { "brand": { "$type": "color", "$value": "#444ce7" } } }'
                    className="min-h-64 resize-y font-mono text-sm leading-5 whitespace-pre"
                />
                <p id={hintId} className="text-sm text-tertiary">
                    {sourceName ? `Loaded from ${sourceName}. ` : ""}W3C DTCG, Figma Variables and Tokens Studio JSON are detected
                    automatically.
                </p>
            </AriaTextField>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary">Format</span>
                {result.format ? (
                    <Badge type="pill-color" color="brand" size="md">
                        {FORMAT_LABELS[result.format]}
                    </Badge>
                ) : (
                    <Badge type="pill-color" color="gray" size="md">
                        {source.trim() ? "Not recognised" : "Waiting for input"}
                    </Badge>
                )}
                {result.format && (
                    <Badge type="pill-color" color="gray" size="md">
                        {countTokens(result.tokens)} tokens
                    </Badge>
                )}
            </div>

            <p role="status" className="sr-only">
                {statusMessage(result, source.trim() !== "")}
            </p>

            {result.errors.length > 0 && (
                <div className="rounded-xl bg-error-primary p-4 ring-1 ring-error_subtle ring-inset">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-error-primary">
                        <AlertCircle aria-hidden="true" className="size-5" />
                        {result.errors.length === 1 ? "1 error" : `${result.errors.length} errors`}
                    </h3>
                    <ul aria-label="Errors" className="mt-2 flex list-disc flex-col gap-1 pl-7 text-sm break-words text-error-primary">
                        {result.errors.map((error, index) => (
                            <li key={`${error.code}-${index}`}>{error.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {result.warnings.length > 0 && (
                <div className="ring-warning_subtle rounded-xl bg-warning-primary p-4 ring-1 ring-inset">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <AlertTriangle aria-hidden="true" className="size-5 text-fg-warning-primary" />
                        {result.warnings.length === 1 ? "1 warning" : `${result.warnings.length} warnings`}
                    </h3>
                    <ul aria-label="Warnings" className="mt-2 flex list-disc flex-col gap-1 pl-7 text-sm break-words text-secondary">
                        {result.warnings.map((warning, index) => (
                            <li key={`${warning.code}-${index}`}>{warning.message}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
