import { Info, Sparkles } from "lucide-react"

export function ExplainedChart({ title, subtitle, children, insights = [], legend = [], accent = "violet" }) {
  const accents = {
    violet: "bg-brand text-ink shadow-lime-200/40",
    pink: "bg-[#CFEF8A] text-ink shadow-lime-200/30",
    sky: "bg-[#EEF3EF] text-ink shadow-slate-300/30",
  }

  return (
    <section className="glass-panel rounded-[2.6rem] p-6">
      <div className="grid gap-6 xl:grid-cols-[1.48fr_0.82fr]">
        <div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold leading-tight text-ink">{title}</h3>
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted">{subtitle}</p>
            </div>
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-3xl ${accents[accent]} shadow-lg`}>
              <Sparkles size={19} />
            </span>
          </div>
          <div className="rounded-[2.1rem] border border-white/80 bg-white/54 p-4 shadow-inner">
            {children}
          </div>
          {legend.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {legend.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2 rounded-full bg-white/68 px-3.5 py-2 text-[12px] font-semibold text-ink/70 shadow-sm transition hover:-translate-y-0.5 hover:bg-brand/50">
                  <span className="size-3 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-[2.1rem] border border-white/80 bg-white/76 p-5 shadow-lg shadow-slate-300/20">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-brand text-ink">
              <Info size={17} />
            </span>
            <p className="text-[15px] font-bold text-ink">Como leer este grafico</p>
          </div>
          <div className="mt-4 space-y-3">
            {insights.map((item, index) => (
              <div key={item.title} className="rounded-[1.45rem] bg-[#F7FAF7] p-4 transition duration-200 hover:-translate-y-0.5 hover:bg-brand/30">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Punto {index + 1}</p>
                <p className="mt-2 text-[14px] font-bold text-ink">{item.title}</p>
                <p className="mt-1.5 text-[13px] leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

export function prettyTooltip() {
  return {
    background: "rgba(255,255,255,.94)",
    border: "1px solid rgba(255,255,255,.95)",
    borderRadius: 24,
    color: "#28231f",
    boxShadow: "0 18px 44px rgba(36,47,37,.14)",
  }
}
