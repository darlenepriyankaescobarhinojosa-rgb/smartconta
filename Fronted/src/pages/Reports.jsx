import { LineChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useMemo, useState } from "react"
import { demoSummary, formatMoney } from "../api"
import { ExplainedChart, prettyTooltip } from "../components/ExplainedChart"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import { useApiResource } from "../hooks/useApiResource"

export default function Reports() {
  const { data } = useApiResource("/dashboard/summary", demoSummary)
  const [costFilter, setCostFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const materialOptions = [
    { key: "all", label: "Todos" },
    { key: "milk", label: "Leche" },
    { key: "flour", label: "Harina" },
    { key: "fuel", label: "Combustible" },
  ]
  const visibleMaterialOptions = costFilter === "all" ? materialOptions.filter((item) => item.key !== "all") : materialOptions.filter((item) => item.key === costFilter)
  const filteredMaterialCosts = useMemo(() => {
    const rows = data.material_costs || []
    if (periodFilter === "last3") return rows.slice(-3)
    if (periodFilter === "last6") return rows.slice(-6)
    return rows
  }, [data.material_costs, periodFilter])
  const selectedMaterialLabel = materialOptions.find((item) => item.key === costFilter)?.label || "Todos"

  return (
    <>
      <PageHeader
        eyebrow="Inteligencia empresarial"
        title="Reportes"
        description="Resumen ejecutivo para tomar decisiones: rentabilidad, categorias de gasto y evolucion mensual."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Ingresos" value={formatMoney(data.revenue)} helper="Ventas acumuladas" />
        <StatCard label="Egresos" value={formatMoney(data.expenses)} helper="Gastos acumulados" tone="rose" />
        <StatCard label="Margen" value={`${Math.round((data.profit / Math.max(data.revenue, 1)) * 100)}%`} helper="Rentabilidad operativa" tone="cyan" />
      </div>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <Explain title="Ventas" text="Es todo el dinero que entro por ventas registradas." />
        <Explain title="Gastos" text="Es todo lo que salio: materiales, gasolina, servicios y otros costos." />
        <Explain title="Margen" text="Es el porcentaje que queda despues de restar gastos. Mientras mas alto, mejor." />
      </section>

      <div className="mb-6">
        <ExplainedChart
          title="Gastos por categoria"
          subtitle="Este grafico responde una pregunta simple: en que se esta yendo mas dinero."
          accent="pink"
          legend={[
            { label: "Altura de barra = monto gastado", color: "#D8F36B" },
            { label: "Categorias = tipos de gasto", color: "#1D1D1D" },
          ]}
          insights={[
            { title: "Que mirar primero", text: "Busca la barra mas alta. Esa categoria es la que mas afecta la caja de la empresa." },
            { title: "Como usarlo", text: "Si Materia prima sube mucho, revisa proveedores. Si Transporte sube, revisa rutas o combustible." },
            { title: "Decision sencilla", text: "Este grafico ayuda a decidir donde ahorrar sin revisar gasto por gasto." },
          ]}
        >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categories}>
              <defs>
                <linearGradient id="reportBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D8F36B" stopOpacity="1" />
                  <stop offset="100%" stopColor="#CFEF8A" stopOpacity="0.72" />
                </linearGradient>
                <filter id="reportShadow" x="-20%" y="-20%" width="140%" height="160%">
                  <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor="#1D1D1D" floodOpacity="0.12" />
                </filter>
              </defs>
              <CartesianGrid stroke="rgba(110,117,110,.14)" vertical={false} />
              <XAxis dataKey="name" stroke="#6E756E" tickLine={false} axisLine={false} />
              <YAxis stroke="#6E756E" tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatMoney(value)} contentStyle={prettyTooltip()} />
              <Bar dataKey="amount" fill="url(#reportBar)" radius={[18, 18, 10, 10]} barSize={46} filter="url(#reportShadow)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </ExplainedChart>
      </div>

      <ExplainedChart
        title={`Como cambiaron los costos: ${selectedMaterialLabel}`}
        subtitle="Filtra por material para ver su comportamiento individual o compara todos juntos para entender que insumo sube mas rapido."
        accent="sky"
        legend={visibleMaterialOptions.map((item) => ({ label: item.label, color: materialColor(item.key) }))}
        insights={[
          { title: "Filtro aplicado", text: costFilter === "all" ? "Estas comparando todos los materiales al mismo tiempo." : `Estas viendo solo ${selectedMaterialLabel}. Asi puedes analizarlo sin ruido.` },
          { title: "Si una linea baja", text: "Ese costo esta mejorando. Puede ser buen momento para comprar mas o mantener proveedor." },
          { title: "Comparar meses", text: "Mira de izquierda a derecha. Asi ves si el cambio fue gradual o si hubo un salto fuerte en un mes." },
          { title: "Uso para precios", text: "Si tus materiales suben varios meses seguidos, tal vez debes ajustar precio de venta." },
        ]}
      >
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap gap-2 rounded-[1.6rem] bg-white/70 p-2">
            {materialOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCostFilter(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  costFilter === item.key ? "bg-brand text-ink shadow-sm" : "text-muted hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-[1.6rem] bg-white/70 p-2">
            {[
              { key: "all", label: "Todo" },
              { key: "last6", label: "6 ultimos" },
              { key: "last3", label: "3 ultimos" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriodFilter(item.key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  periodFilter === item.key ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredMaterialCosts}>
              <CartesianGrid stroke="rgba(110,117,110,.14)" vertical={false} />
              <XAxis dataKey="period" stroke="#6E756E" tickLine={false} axisLine={false} />
              <YAxis stroke="#6E756E" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={prettyTooltip()} />
              {visibleMaterialOptions.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={materialColor(item.key)}
                  strokeWidth={item.key === "fuel" ? 3.5 : 4}
                  dot={{ r: 5, fill: materialColor(item.key), stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: item.key === "fuel" ? "#D8F36B" : materialColor(item.key), stroke: "#1D1D1D", strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ExplainedChart>
    </>
  )
}

function materialColor(key) {
  const colors = {
    milk: "#D8F36B",
    flour: "#CFEF8A",
    fuel: "#1D1D1D",
  }
  return colors[key] || "#6E756E"
}

function Explain({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/52 p-4 shadow-lg shadow-slate-300/20">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}
