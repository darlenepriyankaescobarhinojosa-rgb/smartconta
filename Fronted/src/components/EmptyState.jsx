export default function EmptyState({ title = "Sin datos todavia", description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
