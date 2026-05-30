export default function MetricTrend({ label, value, trend, tone = "info" }) {
  const colors = {
    success: "text-[#16A34A]",
    warning: "text-[#F59E0B]",
    danger: "text-[#DC2626]",
    info: "text-[#2563EB]",
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-lg font-bold text-slate-900">{value}</p>
        {trend && <p className={`text-sm font-semibold ${colors[tone] || colors.info}`}>{trend}</p>}
      </div>
    </div>
  )
}
