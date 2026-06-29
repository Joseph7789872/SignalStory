"use client";

/** Tiny dependency-free SVG line chart for a trend series. */
export function Sparkline({
  points,
  labels,
  width = 280,
  height = 48,
}: {
  points: number[];
  labels?: string[];
  width?: number;
  height?: number;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map(
    (v, i) => [i * stepX, height - ((v - min) / range) * height] as const,
  );
  const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg width={width} height={height} className="text-primary">
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth={2} />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill="currentColor" />
        ))}
      </svg>
      {labels && labels.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{labels[0]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}
