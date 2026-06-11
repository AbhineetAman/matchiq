export default function LoadingSkeleton({ variant = "card", count = 3, className = "" }) {
  const items = Array.from({ length: count });

  if (variant === "table") {
    return (
      <div className={`card p-4 space-y-3 ${className}`} role="status" aria-label="Loading">
        <div className="h-5 w-32 rounded bg-navy-700 animate-pulse" />
        {items.map((_, i) => (
          <div key={i} className="h-9 rounded bg-navy-700/70 animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === "line") {
    return (
      <div className={`space-y-2 ${className}`} role="status" aria-label="Loading">
        {items.map((_, i) => (
          <div key={i} className="h-4 rounded bg-navy-700 animate-pulse" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`} role="status" aria-label="Loading">
      {items.map((_, i) => (
        <div key={i} className="card p-5 space-y-4 animate-pulse">
          <div className="flex justify-between">
            <div className="h-4 w-16 rounded bg-navy-700" />
            <div className="h-4 w-12 rounded bg-navy-700" />
          </div>
          <div className="h-8 rounded bg-navy-700" />
          <div className="h-4 w-2/3 rounded bg-navy-700" />
        </div>
      ))}
    </div>
  );
}
