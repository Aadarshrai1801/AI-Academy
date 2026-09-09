"use client";

/** Minimal dependency-free sparkline (Phase 7: Pro trend graphs without chart deps). */
export function Sparkline({
  values,
  width = 220,
  height = 52,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length === 0) return <p className="text-xs text-zinc-500">No data yet.</p>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <figure>
      <svg width={width} height={height} role="img" aria-label={label ?? "trend"}>
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={i * step}
            cy={height - 4 - ((v - min) / span) * (height - 8)}
            r="2.5"
            fill="currentColor"
          />
        ))}
      </svg>
      {label && <figcaption className="mt-1 text-xs text-zinc-500">{label}</figcaption>}
    </figure>
  );
}

/** Horizontal bar list for per-topic accuracy/scores. */
export function BarList({
  rows,
}: {
  rows: Array<{ label: string; value: number; hint?: string }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="font-mono text-xs">{r.label}</span>
            <span className="text-xs text-zinc-500">{r.hint ?? r.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-950 dark:bg-white"
              style={{ width: `${Math.round((r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
