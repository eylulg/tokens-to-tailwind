import { useEffect, useMemo, useRef, useState } from "react";
import { Copy01, Download01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Label } from "@/components/base/input/label";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import type { ColorFormat, Naming } from "@/generator";
import type { ParseResult } from "@/model/tokens";
import type { ExportFormat } from "@/store/use-app-store";
import { useAppStore } from "@/store/use-app-store";
import { EXPORT_FILES, renderExport } from "./export-output";

function download(text: string, fileName: string, mime: string) {
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

export function ExportTab({ result }: { result: ParseResult }) {
    const { naming, colorFormat, preserveAliases, exportFormat } = useAppStore();
    const { setNaming, setColorFormat, setPreserveAliases, setExportFormat } = useAppStore();
    const [announcement, setAnnouncement] = useState("");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const output = useMemo(
        () => renderExport(exportFormat, result.tokens, { naming, colorFormat, preserveAliases, source: result.format }),
        [exportFormat, result, naming, colorFormat, preserveAliases],
    );
    const file = EXPORT_FILES[exportFormat];
    const isEmpty = result.tokens.length === 0;

    const announce = (message: string) => {
        setAnnouncement(message);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAnnouncement(""), 4000);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(output);
            announce(`${file.fileName} copied to the clipboard`);
        } catch {
            announce("Copy failed. Select the code and copy it manually.");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-3">
                <RadioGroup value={exportFormat} onChange={(v) => setExportFormat(v as ExportFormat)}>
                    <Label>Output format</Label>
                    {(Object.keys(EXPORT_FILES) as ExportFormat[]).map((key) => (
                        <RadioButton key={key} value={key} label={EXPORT_FILES[key].label} />
                    ))}
                </RadioGroup>
                <RadioGroup value={naming} onChange={(v) => setNaming(v as Naming)} isDisabled={exportFormat === "json"}>
                    <Label>Variable naming</Label>
                    <RadioButton value="path" label="Keep full path" hint="color.brand.500 to --color-brand-500" />
                    <RadioButton value="leaf" label="Shorten to leaf" hint="semantic.bg.primary to --color-bg-primary" />
                </RadioGroup>
                <div className="flex flex-col gap-4">
                    <RadioGroup value={colorFormat} onChange={(v) => setColorFormat(v as ColorFormat)} isDisabled={exportFormat === "json"}>
                        <Label>Color format</Label>
                        <RadioButton value="oklch" label="oklch()" />
                        <RadioButton value="hex" label="Hex" />
                    </RadioGroup>
                    <Checkbox
                        label="Keep aliases as var()"
                        isSelected={preserveAliases}
                        onChange={setPreserveAliases}
                        isDisabled={exportFormat === "json"}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-sm font-semibold text-primary">{file.fileName}</h3>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" color="secondary" iconLeading={Copy01} onClick={copy} isDisabled={isEmpty}>
                        Copy
                    </Button>
                    <Button
                        size="sm"
                        color="primary"
                        iconLeading={Download01}
                        onClick={() => download(output, file.fileName, file.mime)}
                        isDisabled={isEmpty}
                    >
                        Download {file.fileName}
                    </Button>
                </div>
            </div>
            <p role="status" className="min-h-5 text-sm text-success-primary">
                {announcement}
            </p>

            {isEmpty ? (
                <p className="rounded-xl bg-secondary p-6 text-sm text-tertiary">Load tokens to generate {file.fileName}.</p>
            ) : (
                <pre
                    // Scrollable code must be reachable by keyboard (axe: scrollable-region-focusable).
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    tabIndex={0}
                    role="region"
                    aria-label={`Generated ${file.fileName}`}
                    className="max-h-[36rem] overflow-auto rounded-xl bg-primary_alt p-4 font-mono text-xs leading-5 text-secondary ring-1 ring-secondary outline-focus-ring ring-inset focus-visible:outline-2"
                >
                    <code>{output}</code>
                </pre>
            )}
        </div>
    );
}
