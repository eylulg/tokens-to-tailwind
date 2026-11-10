import { useMemo } from "react";
import { Button } from "@eylulg/ui/button";
import { Checkbox } from "@eylulg/ui/checkbox";
import { CodeBlock } from "@eylulg/ui/code-block";
import { Radio, RadioGroup } from "@eylulg/ui/radio-group";
import { Download } from "lucide-react";
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
    const output = useMemo(
        () => renderExport(exportFormat, result.tokens, { naming, colorFormat, preserveAliases, source: result.format }),
        [exportFormat, result, naming, colorFormat, preserveAliases],
    );
    const file = EXPORT_FILES[exportFormat];
    const isEmpty = result.tokens.length === 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-3">
                <RadioGroup label="Output format" value={exportFormat} onChange={(v) => setExportFormat(v as ExportFormat)}>
                    {(Object.keys(EXPORT_FILES) as ExportFormat[]).map((key) => (
                        <Radio key={key} value={key}>
                            {EXPORT_FILES[key].label}
                        </Radio>
                    ))}
                </RadioGroup>
                <RadioGroup
                    label="Variable naming"
                    value={naming}
                    onChange={(v) => setNaming(v as Naming)}
                    isDisabled={exportFormat === "json"}
                >
                    <Radio value="path" hint="color.brand.500 to --color-brand-500">
                        Keep full path
                    </Radio>
                    <Radio value="leaf" hint="semantic.bg.primary to --color-bg-primary">
                        Shorten to leaf
                    </Radio>
                </RadioGroup>
                <div className="flex flex-col gap-4">
                    <RadioGroup
                        label="Color format"
                        value={colorFormat}
                        onChange={(v) => setColorFormat(v as ColorFormat)}
                        isDisabled={exportFormat === "json"}
                    >
                        <Radio value="oklch">oklch()</Radio>
                        <Radio value="hex">Hex</Radio>
                    </RadioGroup>
                    <Checkbox isSelected={preserveAliases} onChange={setPreserveAliases} isDisabled={exportFormat === "json"}>
                        Keep aliases as var()
                    </Checkbox>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-mono text-sm font-semibold text-primary">{file.fileName}</h3>
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        iconLeading={Download}
                        onPress={() => download(output, file.fileName, file.mime)}
                        isDisabled={isEmpty}
                    >
                        Download {file.fileName}
                    </Button>
                </div>
            </div>

            {isEmpty ? (
                <p className="rounded-xl bg-secondary p-6 text-sm text-tertiary">Load tokens to generate {file.fileName}.</p>
            ) : (
                <CodeBlock
                    label={`Generated ${file.fileName}`}
                    copyable
                    copyLabel={`Copy ${file.fileName}`}
                    copiedLabel={`${file.fileName} copied to the clipboard`}
                    className="max-h-[36rem] overflow-auto"
                >
                    {output}
                </CodeBlock>
            )}
        </div>
    );
}
