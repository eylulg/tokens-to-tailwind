const TOKEN = /\s*(?:(\d*\.?\d+)(px)?|([-+*/()]))/y;

interface Operand {
    value: number;
    px: boolean;
}

/** Reads `+ - * /`, parentheses, unary minus, numbers and px. Anything else makes the expression unevaluable. */
function evaluate(text: string): Operand | null {
    const tokens: Array<Operand | string> = [];
    TOKEN.lastIndex = 0;
    while (TOKEN.lastIndex < text.length) {
        const match = TOKEN.exec(text);
        if (!match) return text.slice(TOKEN.lastIndex).trim() === "" ? finish() : null;
        tokens.push(match[3] ?? { value: Number(match[1]), px: match[2] === "px" });
    }
    return finish();

    function finish(): Operand | null {
        let index = 0;

        const primary = (): Operand | null => {
            const token = tokens[index++];
            if (typeof token === "object") return token;
            if (token === "-") {
                const inner = primary();
                return inner && { ...inner, value: -inner.value };
            }
            if (token !== "(") return null;
            const inner = sum();
            return tokens[index++] === ")" ? inner : null;
        };

        const product = (): Operand | null => {
            let left = primary();
            while (left && (tokens[index] === "*" || tokens[index] === "/")) {
                const operator = tokens[index++];
                const right = primary();
                if (!right || (operator === "/" && right.value === 0)) return null;
                left = {
                    value: operator === "*" ? left.value * right.value : left.value / right.value,
                    px: left.px || right.px,
                };
            }
            return left;
        };

        const sum = (): Operand | null => {
            let left = product();
            while (left && (tokens[index] === "+" || tokens[index] === "-")) {
                const operator = tokens[index++];
                const right = product();
                if (!right) return null;
                left = { value: operator === "+" ? left.value + right.value : left.value - right.value, px: left.px || right.px };
            }
            return left;
        };

        const result = sum();
        return result && index === tokens.length ? result : null;
    }
}

/** True when the text is only numbers, px and operators, with an operator between operands: `4 * 2`, `8px + 4px`. */
export function isMathExpression(text: string): boolean {
    return /^[\d.\s+\-*/()px]+$/.test(text) && /(?:[\d.)]|px)\s*[+*/]\s*[\d.(-]|(?:[\d.)]|px)\s-\s+[\d.(]/.test(text);
}

/** Evaluates a Tokens Studio math expression whose references are already replaced. Null when it cannot be evaluated. */
export function evaluateMath(text: string): string | null {
    const result = evaluate(text.trim());
    if (!result || !Number.isFinite(result.value)) return null;
    const rounded = Number(result.value.toFixed(4));
    return result.px ? `${rounded}px` : String(rounded);
}
