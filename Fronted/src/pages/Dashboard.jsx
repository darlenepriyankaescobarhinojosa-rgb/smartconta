import { Bot, HelpCircle, Package, ReceiptText, TrendingDown, TrendingUp, Users } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { createElement, useMemo, useState } from "react"
import { demoSummary, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import { ExplainedChart } from "../components/ExplainedChart"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"
import { prettyTooltip } from "../lib/chartStyle"

export default function Dashboard() {
  const { data, loading, error } = useApiResource("/dashboard/summary", demoSummary)
  const [mainView, setMainView] = useState("month")
  const monthlySeries = useMemo(() => (data.monthly_series || []).map((item) => ({ ...item, month: formatMonthLabel(item.month) })), [data.monthly_series])
  const dailySeries = useMemo(() => data.daily_series || [], [data.daily_series])
  const mainSeries = useMemo(() => mainView === "month" ? monthlySeries : dailySeries, [dailySeries, mainView, monthlySeries])
  const axisKey = mainView === "month" ? "month" : "day"
  const mainTotals = useMemo(() => {
    const revenue = mainSeries.reduce((sum, item) => sum + Number(item.revenue || 0), 0)
    const expenses = mainSeries.reduce((sum, item) => sum + Number(item.expenses || 0), 0)
    return { revenue, expenses, profit: revenue - expenses }
  }, [mainSeries])
  const movementMix = [
    { name: "Ventas", value: data.revenue, color: "#D8F36B" },
    { name: "Gastos", value: data.expenses, color: "#CFEF8A" },
    { name: "Ganancia", value: Math.max(data.profit, 0), color: "#1D1D1D" },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Centro de control"
        title="Dashboard empresarial"
        description="Ventas, gastos, stock y vouchers capturados desde Telegram y normalizados por IA."
        action={<span className="rounded-full border border-white/70 bg-white/62 px-4 py-2 text-sm font-semibold text-muted shadow-lg shadow-slate-300/30">{loading ? "Sincronizando" : "Actualizado"}</span>}
      />
      {error && <p className="mb-4 rounded-2xl border border-[#f0e7bc] bg-[#fffaf0] px-4 py-3 text-sm text-[#8b7544]">{error}</p>}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Ventas" value={formatMoney(data.revenue)} helper="Ingresos acumulados del periodo" />
        <StatCard icon={TrendingDown} label="Gastos" value={formatMoney(data.expenses)} helper="Clasificados por IA" tone="rose" />
        <StatCard icon={ReceiptText} label="Ganancia" value={formatMoney(data.profit)} helper="Ventas menos gastos" tone="cyan" />
        <StatCard icon={Users} label="Trabajadores activos" value={data.active_workers} helper={`${data.vouchers_pending} vouchers pendientes`} tone="amber" />
      </section>

      <section className="mt-8 grid gap-7 xl:grid-cols-[1.7fr_0.8fr]">
        <ExplainedChart
          title={mainView === "month" ? "Ventas vs gastos por mes" : "Ventas vs gastos por dia"}
          subtitle={mainView === "month" ? "Mira mes por mes cuanto dinero entro y cuanto salio. Los meses se muestran de forma simple para que sea facil comparar." : "Mira dia por dia cuanto vendiste, cuanto gastaste y cuanto quedo. Sirve para detectar los dias mas fuertes y los dias con mas gasto."}
          accent="violet"
          legend={[
            { label: "Ventas: dinero que entro", color: "#D8F36B" },
            { label: "Gastos: dinero que salio", color: "#CFEF8A" },
          ]}
          insights={[
            { title: mainView === "month" ? "Lectura mensual" : "Lectura diaria", text: mainView === "month" ? "Cada punto de abajo es un mes: Ene, Feb, Mar, Abr, May. Asi ya no se ve como 2026-01." : "Cada punto de abajo es un dia de la semana. Sirve para ver rapidamente que dia genero mas dinero." },
            { title: "Morado significa ventas", text: "Mientras mas alto este el morado, mas dinero entro al negocio." },
            { title: "Rosado significa gastos", text: "Mientras mas alto este el rosado, mas dinero salio. Si se acerca mucho al morado, la ganancia baja." },
          ]}
        >
          <div className="mb-5 flex flex-col gap-3 rounded-[1.8rem] bg-white/68 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[390px]">
              <MiniMetric label="Ventas" value={formatMoney(mainTotals.revenue)} color="text-ink" />
              <MiniMetric label="Gastos" value={formatMoney(mainTotals.expenses)} color="text-muted" />
              <MiniMetric label="Ganancia" value={formatMoney(mainTotals.profit)} color="text-ink" />
            </div>
            <div className="flex rounded-full bg-white/72 p-1 shadow-inner">
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mainView === "month" ? "bg-brand text-ink shadow-sm" : "text-muted hover:bg-white"}`}
                onClick={() => setMainView("month")}
              >
                Por mes
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${mainView === "day" ? "bg-brand text-ink shadow-sm" : "text-muted hover:bg-white"}`}
                onClick={() => setMainView("day")}
              >
                Por dia
              </button>
            </div>
          </div>
          <div className="h-[22rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={mainSeries} barGap={10}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D8F36B" stopOpacity={0.78} />
                    <stop offset="95%" stopColor="#CFEF8A" stopOpacity={0.36} />
                  </linearGradient>
                  <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E6ECE7" stopOpacity={0.98} />
                    <stop offset="95%" stopColor="#CDD7CE" stopOpacity={0.42} />
                  </linearGradient>
                  <filter id="barShadow" x="-20%" y="-20%" width="140%" height="160%">
                    <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#1D1D1D" floodOpacity="0.12" />
                  </filter>
                </defs>
                <CartesianGrid stroke="rgba(72,60,45,.12)" vertical={false} />
                <XAxis dataKey={axisKey} stroke="#8f8375" tickLine={false} axisLine={false} />
                <YAxis stroke="#8f8375" tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={prettyTooltip()} />
                <Bar dataKey="revenue" name="Ventas" fill="url(#revenue)" radius={[18, 18, 8, 8]} barSize={36} filter="url(#barShadow)" />
                <Bar dataKey="expenses" name="Gastos" fill="url(#expenses)" radius={[18, 18, 8, 8]} barSize={36} filter="url(#barShadow)" />
                <Line type="monotone" dataKey="revenue" name="Tendencia ventas" stroke="#1D1D1D" strokeWidth={3.5} dot={{ r: 5, fill: "#1D1D1D", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 8, fill: "#D8F36B", stroke: "#1D1D1D", strokeWidth: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ExplainedChart>

        <div className="glass-panel rounded-[2.4rem] p-6">
          <h3 className="text-2xl font-semibold text-ink">Alertas inteligentes</h3>
          <p className="mt-3 text-[14px] leading-7 text-muted">Mensajes simples para saber que revisar primero sin entrar a todos los datos.</p>
          <div className="mt-5 space-y-3">
            <Alert icon={Package} title="Stock bajo" text={`${data.stock_units} unidades registradas. Revisar productos con mayor rotacion.`} />
            <Alert icon={ReceiptText} title="Vouchers pendientes" text={`${data.vouchers_pending} imagenes necesitan validacion OCR.`} />
            <Alert icon={Bot} title="Confianza IA" text="Los registros de Telegram se guardan con score para auditoria." />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-7">
        <ExplainedChart
          title="En que se va el dinero"
          subtitle="Este grafico muestra las categorias donde mas se gasta. Ayuda a encontrar fugas de dinero y oportunidades para ahorrar."
          accent="pink"
          legend={[
            { label: "Cada barra es una categoria", color: "#D8F36B" },
            { label: "Mas alto significa mas gasto", color: "#1D1D1D" },
          ]}
          insights={[
            { title: "Barra mas alta", text: "Es la categoria que mas dinero consume. Empieza revisando esa primero." },
            { title: "Comparacion simple", text: "Si una categoria duplica a otra, quiere decir que pesa mucho mas en tus costos." },
            { title: "Decision practica", text: "Usa este grafico para negociar proveedores, cambiar precios o controlar compras." },
          ]}
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories}>
                <CartesianGrid stroke="rgba(72,60,45,.12)" vertical={false} />
                <XAxis dataKey="name" stroke="#8f8375" tickLine={false} axisLine={false} />
                <YAxis stroke="#8f8375" tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={prettyTooltip()} />
                <Bar dataKey="amount" radius={[18, 18, 10, 10]} barSize={44}>
                  {data.categories.map((_, index) => (
                    <Cell key={index} fill={["#D8F36B", "#CFEF8A", "#EEF3EF", "#BFDCC5", "#FFFFFF"][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExplainedChart>

        <ExplainedChart
          title="Resumen facil del negocio"
          subtitle="Este circulo resume todo en una vista: cuanto vendiste, cuanto gastaste y cuanto quedo como ganancia."
          accent="sky"
          legend={[
            { label: "Ventas", color: "#D8F36B" },
            { label: "Gastos", color: "#CFEF8A" },
            { label: "Ganancia", color: "#1D1D1D" },
          ]}
          insights={[
            { title: "Parte morada", text: "Representa el total vendido. Mientras mas grande sea, mas dinero entro." },
            { title: "Parte rosada", text: "Representa los gastos. Si esta parte crece demasiado, la ganancia se reduce." },
            { title: "Parte celeste", text: "Es lo que queda despues de pagar gastos. Es la salud real del negocio." },
          ]}
        >
          <div className="relative h-80">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/72 px-5 py-4 text-center shadow-lg shadow-slate-300/30">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Ganancia</p>
                <p className="mt-1 text-xl font-bold text-ink">{formatMoney(data.profit)}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={movementMix} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98} paddingAngle={4}>
                  {movementMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={prettyTooltip()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ExplainedChart>
      </section>

      <section className="mt-6">
        <DataTable
          columns={[
            { key: "description", label: "Movimiento" },
            { key: "type", label: "Tipo", render: (row) => <StatusBadge value={row.type} /> },
            { key: "amount", label: "Monto", render: (row) => formatMoney(row.amount) },
            { key: "source", label: "Origen", render: (row) => <StatusBadge value={row.source} /> },
            { key: "ai_confidence", label: "IA", render: (row) => `${Math.round((row.ai_confidence || 0) * 100)}%` },
          ]}
          rows={data.recent_movements || []}
        />
      </section>
    </>
  )
}

function formatMonthLabel(value) {
  if (!value) return ""
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const match = String(value).match(/(\d{4})-(\d{2})/)
  if (!match) return value
  return monthNames[Number(match[2]) - 1] || value
}

function MiniMetric({ label, value, color }) {
  return (
    <div className="rounded-[1.25rem] bg-white/78 px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-1 text-[15px] font-extrabold ${color}`}>{value}</p>
    </div>
  )
}

function Alert({ icon, title, text }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/80 bg-white/64 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white">
      <span className="flex size-10 items-center justify-center rounded-2xl bg-brand text-ink">
        {createElement(icon, { size: 17 })}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
      </div>
    </div>
  )
}
