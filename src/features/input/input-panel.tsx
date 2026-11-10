import { Badge } from "@eylulg/ui/badge";
import { Button } from "@eylulg/ui/button";
import { FileDropZone } from "@eylulg/ui/file-drop-zone";
import { Textarea } from "@eylulg/ui/textarea";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { EXAMPLES } from "@/examples";
import type { ParseResult } from "@/model/tokens";
import { FORMAT_LABELS, countTokens } from "@/model/tokens";
import { useAppStore } from "@/store/use-app-store";

const tokenCount = (count: number) => (count === 1 ? "1 token" : `${count} tokens`);

const ACCEPTED_TYPES = [".json", "application/json", "text/plain"];

function statusMessage(result: ParseResult, hasSource: boolean): string {
    if (!hasSource) return "No tokens loaded yet.";
    if (result.errors.length) {
        const count = result.errors.length === 1 ? "1 error" : `${result.errors.length} errors`;
        return `${count}. ${result.errors[0]?.message ?? ""}`;
    }
    const format = result.format ? FORMAT_LABELS[result.format] : "Unknown format";
    return `${format} detected, ${tokenCount(countTokens(result.tokens))} parsed.`;
}

export function InputPanel({ result }: { result: ParseResult }) {
    const source = useAppStore((s) => s.source);
    const sourceName = useAppStore((s) => s.sourceName);
    const setSource = useAppStore((s) => s.setSource);

    const loadFile = async (files: File[]) => {
        const file = files[0];
        if (file) setSource(await file.text(), file.name);
    };

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
                            variant="secondary"
                            aria-label={`Load ${example.label} example`}
                            onPress={() => setSource(example.text, `${example.label} example`)}
                        >
                            {example.label}
                        </Button>
                    ))}
                </div>
            </div>

            <FileDropZone label="Drop a .json tokens file here, or" acceptedFileTypes={ACCEPTED_TYPES} onSelect={loadFile} />

            <Textarea
                label="Tokens JSON"
                value={source}
                onChange={(value) => setSource(value, null)}
                hint={`${sourceName ? `Loaded from ${sourceName}. ` : ""}W3C DTCG, Figma Variables and Tokens Studio JSON are detected automatically.`}
                rows={16}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                font="data"
                placeholder='{ "color": { "brand": { "$type": "color", "$value": "#444ce7" } } }'
                textareaClassName="min-h-64 whitespace-pre"
            />

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-secondary">Format</span>
                {result.format ? (
                    <Badge color="brand">{FORMAT_LABELS[result.format]}</Badge>
                ) : (
                    <Badge>{source.trim() ? "Not recognised" : "Waiting for input"}</Badge>
                )}
                {result.format && <Badge>{tokenCount(countTokens(result.tokens))}</Badge>}
            </div>

            <p role="status" className="sr-only">
                {statusMessage(result, source.trim() !== "")}
            </p>

            {result.errors.length > 0 && (
                <div className="rounded-xl border border-error bg-error-subtle p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-error">
                        <CircleAlert aria-hidden="true" className="size-5" />
                        {result.errors.length === 1 ? "1 error" : `${result.errors.length} errors`}
                    </h3>
                    <ul aria-label="Errors" className="mt-2 flex list-disc flex-col gap-1 pl-7 text-sm break-words text-error">
                        {result.errors.map((error, index) => (
                            <li key={`${error.code}-${index}`}>{error.message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {result.warnings.length > 0 && (
                <div className="rounded-xl border border-default bg-warning-subtle p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <TriangleAlert aria-hidden="true" className="size-5 text-fg-warning" />
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
