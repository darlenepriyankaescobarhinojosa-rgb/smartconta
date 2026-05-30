export default function StatCard({ label, value, helper, icon: Icon, tone = "brand" }) {
  const tones = {
    brand: "bg-blue-50 text-blue-700",
    cyan: "bg-sky-50 text-[#0284C7]",
    rose: "bg-red-50 text-[#DC2626]",
    amber: "bg-amber-50 text-[#F59E0B]",
  }

  return (
    <article className="metric-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
          <strong className="mt-3 block text-2xl font-bold leading-none text-slate-900">{value}</strong>
        </div>
        {Icon && (
          <span className={`flex size-11 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon size={19} />
          </span>
        )}
      </div>
      {helper && <p className="mt-4 text-sm leading-6 text-slate-500">{helper}</p>}
    </article>
  )
}
