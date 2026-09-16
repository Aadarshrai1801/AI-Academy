"use client";

/**
 * Minimal dependency-free sparkline — kept for the leaderboard's compact rank
 * trend, where an interactive chart would be overkill. Token-migrated so it
 * reads correctly on the new surfaces.
 */
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
  if (values.length === 0) {
    return <p className="text-xs text-fg-muted">No data yet.</p>;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  const y = (value: number) => height - 4 - ((value - min) / span) * (height - 8);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");

  return (
    <figure>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label ?? "trend"}
        className="text-fg overflow-visible"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((value, index) => (
          <circle key={index} cx={index * step} cy={y(value)} r="2.5" fill="currentColor" stroke="var(--surface-0)" strokeWidth="1.5" />
        ))}
      </svg>
      {label && <figcaption className="mt-1 font-mono text-[11px] text-fg-muted">{label}</figcaption>}
    </figure>
  );
}
