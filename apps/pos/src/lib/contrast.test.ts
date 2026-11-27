import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../../packages/ui/src/tokens.css", import.meta.url),
  "utf8",
);

function block(start: string, end: string): string {
  const from = css.indexOf(start);
  const to = end ? css.indexOf(end, from + start.length) : css.length;
  return css.slice(from, to);
}

function variables(source: string): Map<string, string> {
  return new Map(
    [...source.matchAll(/(--tj-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(
      (match) => [match[1]!, match[2]!],
    ),
  );
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const light = variables(block(":root", '[data-theme="dark"]'));
const dark = variables(
  block('[data-theme="dark"]', '[data-text-size="large"]'),
);

describe.each([
  ["light", light],
  ["dark", dark],
])("%s grace status contrast", (_name, tokens) => {
  it("meets WCAG AA for warning text on warning-soft", () => {
    const foreground = tokens.get("--tj-warning");
    const background = tokens.get("--tj-warning-soft");

    expect(foreground).toBeDefined();
    expect(background).toBeDefined();
    expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
  });
});
