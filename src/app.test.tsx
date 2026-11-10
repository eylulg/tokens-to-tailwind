import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { App } from "@/app";
import { EXAMPLES } from "@/examples";
import { fixture } from "@/parsers/__fixtures__/load";
import { useAppStore } from "@/store/use-app-store";

function setup() {
    const user = userEvent.setup();
    const view = render(<App />);
    return { user, ...view };
}

beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
});

const tokensField = () => screen.getByRole("textbox", { name: "Tokens JSON" });
const status = () => screen.getAllByRole("status").find((el) => el.textContent?.match(/detected|error|No tokens/)) as HTMLElement;

describe("App", () => {
    it("renders the empty state without accessibility violations", async () => {
        const { container } = setup();
        expect(screen.getByRole("heading", { level: 1, name: "Tokens to Tailwind" })).toBeInTheDocument();
        expect(screen.getByText(/No tokens yet/)).toBeInTheDocument();
        expect(await axe(container)).toHaveNoViolations();
    });

    it("shows swatches after pasting a valid tokens file", async () => {
        const { user, container } = setup();
        await user.click(tokensField());
        await user.paste(fixture("w3c.tokens.json"));

        expect(await screen.findByRole("heading", { name: /Colors/ })).toBeInTheDocument();
        expect(screen.getAllByText("#444ce7").length).toBeGreaterThan(0);
        expect(screen.getByText("W3C Design Tokens")).toBeInTheDocument();
        expect(status()).toHaveTextContent("W3C Design Tokens detected");
        expect(await axe(container)).toHaveNoViolations();
    });

    it("filters swatches with the search field", async () => {
        const { user } = setup();
        await user.click(screen.getByRole("button", { name: "Load W3C DTCG example" }));
        await user.type(await screen.findByRole("textbox", { name: "Search tokens" }), "success");
        expect(await screen.findByText(/1 of \d+ tokens match/)).toBeInTheDocument();
        expect(screen.getByText("color.success.500")).toBeInTheDocument();
        expect(screen.queryByText("color.gray.50")).not.toBeInTheDocument();
    });

    it("announces an error for invalid JSON", async () => {
        const { user, container } = setup();
        await user.click(tokensField());
        await user.paste('{ "color": ');

        const errors = await screen.findByRole("list", { name: "Errors" });
        expect(within(errors).getByText(/The input is not valid JSON/)).toBeInTheDocument();
        expect(status()).toHaveTextContent(/^1 error\. The input is not valid JSON/);
        expect(await axe(container)).toHaveNoViolations();
    });

    it("lists alias problems as errors", async () => {
        const { user } = setup();
        await user.click(tokensField());
        await user.paste(fixture("w3c-cycle.json"));
        const errors = await screen.findByRole("list", { name: "Errors" });
        expect(within(errors).getAllByRole("listitem")).toHaveLength(3);
        expect(within(errors).getAllByText(/Alias cycle detected/)).toHaveLength(3);
    });

    it.each(EXAMPLES.map((e) => [e.label, e] as const))("loads the %s example", async (_label, example) => {
        const { user } = setup();
        await user.click(screen.getByRole("button", { name: `Load ${example.label} example` }));
        expect(tokensField()).toHaveValue(example.text);
        expect(await screen.findByText(/tokens parsed/)).toBeInTheDocument();
        expect(screen.getByText(`Loaded from ${example.label} example.`, { exact: false })).toBeInTheDocument();
    });

    it("shows the generated theme.css on the Export tab and copies it", async () => {
        const { user, container } = setup();
        await user.click(screen.getByRole("button", { name: "Load Figma Variables example" }));
        await user.click(screen.getByRole("tab", { name: "Export" }));

        const code = await screen.findByRole("group", { name: "Generated theme.css" });
        expect(code).toHaveTextContent("@theme {");
        expect(code).toHaveTextContent("--color-brand-600: oklch(57.2% 0.2076 258.93);");
        expect(code).toHaveTextContent("@layer base { .dark-mode {");

        await user.click(screen.getByRole("button", { name: "Copy theme.css" }));
        expect(await screen.findByText("theme.css copied to the clipboard")).toBeInTheDocument();
        expect(await navigator.clipboard.readText()).toBe(code.textContent);

        expect(await axe(container)).toHaveNoViolations();
    });

    it("switches export format and naming", async () => {
        const { user } = setup();
        await user.click(screen.getByRole("button", { name: "Load W3C DTCG example" }));
        await user.click(screen.getByRole("tab", { name: "Export" }));

        await user.click(screen.getByRole("radio", { name: /Shorten to leaf/ }));
        await user.click(screen.getByRole("radio", { name: "Hex" }));
        const theme = screen.getByRole("group", { name: "Generated theme.css" });
        expect(theme).toHaveTextContent("--color-bg-primary: var(--color-white);");
        expect(theme).toHaveTextContent("--color-brand-600: #444ce7;");

        await user.click(screen.getByRole("radio", { name: "CSS custom properties" }));
        expect(screen.getByRole("group", { name: "Generated tokens.css" })).toHaveTextContent(":root {");

        await user.click(screen.getByRole("radio", { name: "Normalised JSON" }));
        const json = screen.getByRole("group", { name: "Generated tokens.json" });
        expect(JSON.parse(json.textContent ?? "")[0]).toMatchObject({ name: "color.base.white", type: "color" });
    });

    it("renders the themed preview", async () => {
        const { user, container } = setup();
        await user.click(screen.getByRole("button", { name: "Load Tokens Studio example" }));
        await user.click(screen.getByRole("tab", { name: "Preview" }));

        const scope = await screen.findByTestId("preview-scope");
        expect(within(scope).getByRole("button", { name: "Get started" })).toBeInTheDocument();
        const style = container.querySelector("style");
        expect(style?.textContent).toContain(`#${scope.id} {`);
        expect(style?.textContent).toContain("--color-brand-600: var(--color-violet-600);");

        await user.click(screen.getByRole("switch", { name: "Dark preview" }));
        expect(scope).toHaveClass("dark-mode");
        expect(await axe(container)).toHaveNoViolations();
    });
});
