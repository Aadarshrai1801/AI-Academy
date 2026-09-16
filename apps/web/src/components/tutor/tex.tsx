"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * KaTeX rendering, loaded lazily.
 *
 * AI answers are full of LaTeX (`\frac`, `\nabla`, `O(n^2)`) and the previous
 * implementation dumped it into a `<p>` as raw text, so proofs rendered as
 * backslash soup. KaTeX is imported on first use rather than bundled: it only
 * matters on the Tutor page, and the CSS/font payload should not ride along on
 * every route.
 */
type KatexModule = { renderToString: (tex: string, options?: Record<string, unknown>) => string };

let katexPromise: Promise<KatexModule> | null = null;

function loadKatex(): Promise<KatexModule> {
  katexPromise ??= import("katex").then((mod) => {
    // The package is CJS: the namespace may carry the API directly or under
    // `default` depending on the interop path the bundler chose.
    const candidate = (mod as unknown as { default?: KatexModule }).default ?? (mod as unknown as KatexModule);
    return candidate;
  });
  return katexPromise;
}

/** Warm the import while the user is still typing. */
export function prefetchKatex(): void {
  void loadKatex();
  void import("katex/dist/katex.css");
}

export function Tex({
  latex,
  display = false,
  className,
}: {
  latex: string;
  display?: boolean;
  className?: string;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // The stylesheet has to be present before the markup paints, otherwise
    // KaTeX output flashes as unstyled HTML.
    void import("katex/dist/katex.css");
    void loadKatex()
      .then((katex) => {
        if (!live) return;
        setHtml(
          katex.renderToString(latex, {
            displayMode: display,
            throwOnError: false,
            strict: false,
            output: "html",
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [latex, display]);

  if (!html) {
    // Placeholder keeps the raw source readable rather than showing a gap.
    return (
      <code
        className={cn(
          "rounded bg-surface-4 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted",
          display && "my-2 block",
          className,
        )}
      >
        {latex}
      </code>
    );
  }

  return (
    <span
      className={cn(display ? "my-3 block overflow-x-auto" : "inline-block align-middle", className)}
      // KaTeX emits its own trusted markup from a sanitised token stream.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
