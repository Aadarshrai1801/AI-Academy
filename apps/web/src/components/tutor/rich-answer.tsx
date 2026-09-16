"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { Tex } from "@/components/tutor/tex";
import { cn } from "@/lib/cn";

/**
 * Renders an AI answer with the structure it actually has: fenced code,
 * display/inline maths, and prose.
 *
 * A full markdown pipeline (react-markdown + remark + rehype + a highlighter)
 * would be four more dependencies for output this product controls, so the
 * parser handles exactly the three shapes the API produces and nothing else.
 * Streaming is block-aware: prose reveals progressively, while maths and code
 * commit atomically — re-running KaTeX on every character would be both slow
 * and visually noisy.
 */
type Block =
  | { kind: "code"; lang: string; content: string }
  | { kind: "math"; content: string }
  | { kind: "prose"; content: string };

const FENCE = /```([\w+-]*)\n?([\s\S]*?)```/g;

/** Split answer text into code / display-math / prose blocks. */
export function parseAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  let cursor = 0;

  FENCE.lastIndex = 0;
  for (let match = FENCE.exec(text); match !== null; match = FENCE.exec(text)) {
    if (match.index > cursor) {
      blocks.push(...splitMath(text.slice(cursor, match.index)));
    }
    blocks.push({ kind: "code", lang: match[1] || "text", content: match[2].replace(/\n$/, "") });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) {
    blocks.push(...splitMath(text.slice(cursor)));
  }
  return blocks.filter((block) => block.kind !== "prose" || block.content.trim().length > 0);
}

/** Split a non-code chunk on `$$…$$`, preserving prose in between. */
function splitMath(chunk: string): Block[] {
  const out: Block[] = [];
  const parts = chunk.split(/\$\$([\s\S]+?)\$\$/g);
  parts.forEach((part, index) => {
    if (index % 2 === 1) out.push({ kind: "math", content: part.trim() });
    else if (part.length > 0) out.push({ kind: "prose", content: part });
  });
  return out;
}

/** Render prose with inline `$…$` maths interleaved. */
function ProseText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="text-sm leading-relaxed text-fg">
          {paragraph.split(/\$([^$\n]+?)\$/g).map((part, partIndex) =>
            partIndex % 2 === 1 ? (
              <Tex key={partIndex} latex={part} />
            ) : (
              <span key={partIndex} className="whitespace-pre-wrap">
                {part}
              </span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="my-3 overflow-hidden rounded-card border border-line bg-surface-0">
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">{lang}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(content).then(
              () => setCopied(true),
              () => undefined,
            );
          }}
          aria-label={copied ? "Copied" : "Copy code"}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] text-fg-muted transition-colors hover:bg-surface-4 hover:text-fg"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1 font-medium text-fg"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                Copied
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
                Copy
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[11px] leading-5 text-fg">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export interface RichAnswerProps {
  text: string;
  /** Characters revealed so far while streaming; omit to render everything. */
  revealChars?: number;
  className?: string;
}

export function RichAnswer({ text, revealChars, className }: RichAnswerProps) {
  const reduced = useReducedMotion();
  const blocks = useMemo(() => parseAnswer(text), [text]);

  // Absolute character offsets let the reveal span block boundaries.
  const offsets = useMemo(() => {
    const out: Array<{ start: number; end: number }> = [];
    blocks.reduce((cursor, block) => {
      const length =
        block.kind === "code"
          ? block.content.length + block.lang.length + 8
          : block.kind === "math"
            ? block.content.length + 4
            : block.content.length;
      out.push({ start: cursor, end: cursor + length });
      return cursor + length;
    }, 0);
    return out;
  }, [blocks]);

  const streaming = revealChars !== undefined && revealChars < (offsets.at(-1)?.end ?? 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {blocks.map((block, index) => {
        const { start, end } = offsets[index];
        const limit = revealChars ?? Number.POSITIVE_INFINITY;
        if (start >= limit) return null;
        const partial = end > limit;

        if (block.kind === "code") {
          return <CodeBlock key={index} lang={block.lang} content={block.content} />;
        }
        if (block.kind === "math") {
          return (
            <Tex
              key={index}
              latex={block.content}
              display
              className={partial && !reduced ? "opacity-80" : undefined}
            />
          );
        }
        return (
          <ProseText
            key={index}
            text={partial ? block.content.slice(0, Math.max(limit - start, 0)) : block.content}
          />
        );
      })}

      {streaming && !reduced && (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-1.5 animate-caret rounded-sm bg-fg shadow-xs align-text-bottom"
        />
      )}
    </div>
  );
}
