export default function AlertCard({ title, text, icon: Icon, tone = "info", action }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-[#16A34A]",
    warning: "border-amber-200 bg-amber-50 text-[#F59E0B]",
    danger: "border-red-200 bg-red-50 text-[#DC2626]",
    pending: "border-violet-200 bg-violet-50 text-[#7C3AED]",
    info: "border-blue-200 bg-blue-50 text-[#0284C7]",
  }

  return (
    <article className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {Icon && (
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.info}`}>
          <Icon size={18} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </article>
  )
}
