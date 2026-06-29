/** Consistent page header for authenticated app pages. */
export function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <span className="text-sm font-semibold uppercase tracking-wider text-brand">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
