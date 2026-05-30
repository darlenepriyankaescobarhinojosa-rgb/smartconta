export default function SummaryCard({ label, value, helper, icon: Icon, tone = "info" }) {
  const tones = {
    success: "bg-emerald-50 text-[#16A34A]",
    warning: "bg-amber-50 text-[#F59E0B]",
    danger: "bg-red-50 text-[#DC2626]",
    pending: "bg-violet-50 text-[#7C3AED]",
    info: "bg-blue-50 text-[#2563EB]",
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        {Icon && (
          <span className={`flex size-10 items-center justify-center rounded-xl ${tones[tone] || tones.info}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      {helper && <p className="mt-3 text-sm text-slate-500">{helper}</p>}
    </article>
  )
}
