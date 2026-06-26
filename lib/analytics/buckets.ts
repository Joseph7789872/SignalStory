// Pure time-bucketing for analytics trends (Prisma can't group by week without
// raw SQL, so the endpoint fetches modest per-org rows and buckets in JS).

export type Bucket = "day" | "week" | "month";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Stable sortable key for the bucket containing `date` (UTC; week = ISO Monday). */
export function bucketKey(date: Date | string, bucket: Bucket): string {
  const d = new Date(date);
  if (bucket === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const day = startOfUtcDay(d);
  if (bucket === "week") {
    const dow = (day.getUTCDay() + 6) % 7; // 0 = Monday … 6 = Sunday
    day.setUTCDate(day.getUTCDate() - dow);
  }
  return isoDate(day);
}

/** Group rows into ordered buckets by their date. */
export function bucketSeries<T>(
  rows: T[],
  dateFn: (t: T) => Date | string,
  bucket: Bucket,
): { key: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = bucketKey(dateFn(r), bucket);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, rs]) => ({ key, rows: rs }));
}
