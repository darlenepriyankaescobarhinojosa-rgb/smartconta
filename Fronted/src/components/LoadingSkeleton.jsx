export default function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
      ))}
    </div>
  )
}
