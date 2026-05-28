export default function StatCard({ label, value, helper, icon: Icon, tone = "brand" }) {
  const tones = {
    brand: "text-ink bg-brand",
    cyan: "text-ink bg-[#CFEF8A]",
    rose: "text-ink bg-[#E8EFE9]",
    amber: "text-ink bg-[#F4F7F4]",
  }

  return (
    <article className="metric-card rounded-[2.2rem] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
          <strong className="display-font mt-4 block text-3xl font-semibold leading-none text-ink">{value}</strong>
        </div>
        {Icon && (
          <span className={`flex size-11 items-center justify-center rounded-2xl shadow-sm ${tones[tone]}`}>
            <Icon size={19} />
          </span>
        )}
      </div>
      {helper && <p className="mt-5 text-[13px] leading-6 text-muted">{helper}</p>}
    </article>
  )
}
