import { LineChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useMemo, useState } from "react"
import { formatMoney } from "../api"
import EmptyState from "../components/EmptyState"
import LoadingSkeleton from "../components/LoadingSkeleton"
import { ExplainedChart } from "../components/ExplainedChart"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import { useApiResource } from "../hooks/useApiResource"
import { prettyTooltip } from "../lib/chartStyle"
import { costTrend, marginInfo } from "../lib/productMetrics"

const emptySummary = {
  revenue: 0,
  expenses: 0,
  profit: 0,
  active_workers: 0,
  vouchers_pending: 0,
  stock_units: 0,
  monthly_series: [],
  daily_series: [],
  categories: [],
  recent_movements: [],
}

export default function Reports() {
  const { data, loading } = useApiResource("/dashboard/summary", emptySummary)
  const products = useApiResource("/products", [])
  const priceHistory = useApiResource("/inventory/price-history", [])
  const [costFilter, setCostFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [productSearch, setProductSearch] = useState("")
  const hasManyProducts = products.data.length > 10
  const productOptions = useMemo(
    () => [{ key: "all", label: "Todos" }, ...products.data.map((product) => ({ key: productKey(product), label: product.name, product }))],
    [products.data],
  )
  const filteredProducts = useMemo(
    () => filterProducts(products.data, costFilter, productSearch, priceHistory.data),
    [products.data, costFilter, productSearch, priceHistory.data],
  )
  const visibleProducts = hasManyProducts ? filteredProducts.slice(0, 10) : costFilter === "all" ? products.data : filteredProducts
  const productCostRows = useMemo(() => buildProductCostRows(visibleProducts, priceHistory.data), [visibleProducts, priceHistory.data])
  const filteredMaterialCosts = useMemo(() => {
    const rows = productCostRows
    if (periodFilter === "last3") return rows.slice(-3)
    if (periodFilter === "last6") return rows.slice(-6)
    return rows
  }, [productCostRows, periodFilter])
  const selectedMaterialLabel = selectedFilterLabel(costFilter, productOptions, hasManyProducts)

  return (
    <>
      <PageHeader
        eyebrow="Inteligencia empresarial"
        title="Reportes"
        description="Resumen ejecutivo para tomar decisiones: rentabilidad, categorias de gasto y evolucion mensual."
      />
      {loading ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
        </div>
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Ingresos" value={formatMoney(data.revenue)} helper="Ventas acumuladas" />
          <StatCard label="Egresos" value={formatMoney(data.expenses)} helper="Gastos acumulados" tone="rose" />
          <StatCard label="Margen" value={`${Math.round((data.profit / Math.max(data.revenue, 1)) * 100)}%`} helper="Rentabilidad operativa" tone="cyan" />
        </div>
      )}

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <Explain title="Ventas" text="Es todo el dinero que entro por ventas registradas." />
        <Explain title="Gastos" text="Es todo lo que salio: materiales, gasolina, servicios y otros costos." />
        <Explain title="Margen" text="Es el porcentaje que queda despues de restar gastos. Mientras mas alto, mejor." />
      </section>

      <div className="mb-6">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : (
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
        )}
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <ExplainedChart
          title={`Como cambiaron los costos: ${selectedMaterialLabel}`}
          subtitle="Filtra por producto real de la empresa para ver su comportamiento individual o compara grupos relevantes."
          accent="sky"
          legend={visibleProducts.map((product, index) => ({ label: product.name, color: materialColor(product.id, index) }))}
          insights={[
            { title: "Filtro aplicado", text: costFilter === "all" ? "Estas comparando productos registrados por la empresa." : `Estas viendo ${selectedMaterialLabel}. Asi puedes analizar costos sin datos genericos.` },
            { title: "Si una linea baja", text: "Ese costo esta mejorando. Puede ser buen momento para comprar mas o mantener proveedor." },
            { title: "Comparar meses", text: "Mira de izquierda a derecha. Asi ves si el cambio fue gradual o si hubo un salto fuerte en un mes." },
            { title: "Uso para precios", text: "Si tus materiales suben varios meses seguidos, tal vez debes ajustar precio de venta." },
          ]}
        >
          {products.data.length === 0 ? (
            <EmptyState title="No hay productos registrados todavía." description="Cuando registres productos, este reporte mostrará costos, stock y márgenes reales de la empresa." />
          ) : (
            <>
              <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
                <div className="rounded-[1.6rem] bg-white/70 p-2">
                  <div className="flex flex-wrap gap-2">
                    {(hasManyProducts ? reportFilterOptions : productOptions).map((item) => (
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
                  {hasManyProducts && (
                    <input
                      className="mt-3 w-full rounded-full border border-white/70 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none placeholder:text-muted"
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Buscar producto"
                    />
                  )}
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
              {visibleProducts.length === 0 ? (
                <EmptyState title="No hay productos para este filtro" description="Prueba con otro filtro o cambia el texto de búsqueda." />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredMaterialCosts}>
                      <CartesianGrid stroke="rgba(110,117,110,.14)" vertical={false} />
                      <XAxis dataKey="period" stroke="#6E756E" tickLine={false} axisLine={false} />
                      <YAxis stroke="#6E756E" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={prettyTooltip()} formatter={(value) => formatMoney(value)} />
                      {visibleProducts.map((product, index) => (
                        <Line
                          key={productKey(product)}
                          type="monotone"
                          dataKey={productKey(product)}
                          name={product.name}
                          stroke={materialColor(product.id, index)}
                          strokeWidth={4}
                          dot={{ r: 5, fill: materialColor(product.id, index), stroke: "#fff", strokeWidth: 2 }}
                          activeDot={{ r: 8, fill: materialColor(product.id, index), stroke: "#1D1D1D", strokeWidth: 2 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </ExplainedChart>
      )}
    </>
  )
}

const reportFilterOptions = [
  { key: "all", label: "Todos" },
  { key: "cost_up", label: "Costos subiendo" },
  { key: "critical_stock", label: "Stock crítico" },
  { key: "high_margin", label: "Mayor margen" },
  { key: "low_margin", label: "Menor margen" },
]

function filterProducts(products, filter, search, priceHistory) {
  const query = search.trim().toLowerCase()
  let rows = products.filter((product) => !query || product.name.toLowerCase().includes(query))

  if (filter === "cost_up") {
    rows = rows.filter((product) => costTrend(product, priceHistory).isIncreasing)
  } else if (filter === "critical_stock") {
    rows = rows.filter((product) => Number(product.stock || 0) <= Number(product.min_stock || 0))
  } else if (filter === "high_margin") {
    rows = [...rows].sort((left, right) => marginInfo(right).marginPct - marginInfo(left).marginPct)
  } else if (filter === "low_margin") {
    rows = [...rows].sort((left, right) => marginInfo(left).marginPct - marginInfo(right).marginPct)
  } else if (filter !== "all") {
    rows = rows.filter((product) => productKey(product) === filter)
  }

  return rows
}

function buildProductCostRows(products, priceHistory) {
  const periods = new Set(["Actual"])
  for (const row of priceHistory) {
    if (products.some((product) => sameId(product.id, row.product_id))) {
      periods.add(periodLabel(row.occurred_on || row.created_at))
    }
  }

  return Array.from(periods).map((period) => {
    const row = { period }
    for (const product of products) {
      const historyItem = latestCostForPeriod(product, priceHistory, period)
      row[productKey(product)] = Number(historyItem?.cost ?? product.cost ?? 0)
    }
    return row
  })
}

function latestCostForPeriod(product, priceHistory, period) {
  return priceHistory
    .filter((item) => sameId(item.product_id, product.id) && periodLabel(item.occurred_on || item.created_at) === period)
    .sort((a, b) => new Date(a.occurred_on || a.created_at || 0) - new Date(b.occurred_on || b.created_at || 0))
    .at(-1)
}

function selectedFilterLabel(filter, productOptions, hasManyProducts) {
  if (hasManyProducts) return reportFilterOptions.find((item) => item.key === filter)?.label || "Todos"
  return productOptions.find((item) => item.key === filter)?.label || "Todos"
}

function materialColor(id, index) {
  const colors = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED", "#0891B2", "#84CC16", "#F97316", "#DB2777", "#475569"]
  return colors[Number(id || index) % colors.length]
}

function productKey(product) {
  return `product_${product.id}`
}

function sameId(left, right) {
  return String(left) === String(right)
}

function periodLabel(value) {
  if (!value) return "Actual"
  return String(value).slice(0, 7)
}

function Explain({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/52 p-4 shadow-lg shadow-slate-300/20">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}
