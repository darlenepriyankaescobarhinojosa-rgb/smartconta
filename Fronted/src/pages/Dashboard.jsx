import { AlertTriangle, Bot, Boxes, CircleDollarSign, ReceiptText, TrendingDown, TrendingUp } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { demoSummary, formatMoney } from "../api"
import AlertCard from "../components/AlertCard"
import DataTable from "../components/DataTable"
import EmptyState from "../components/EmptyState"
import LoadingSkeleton from "../components/LoadingSkeleton"
import MetricTrend from "../components/MetricTrend"
import SectionHeader from "../components/SectionHeader"
import SummaryCard from "../components/SummaryCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"
import { prettyTooltip } from "../lib/chartStyle"

export default function Dashboard() {
  const { data, loading, error } = useApiResource("/dashboard/summary", demoSummary)
  const debts = useApiResource("/debts", [])
  const products = useApiResource("/products", [])
  const movements = useApiResource("/inventory/stock-movements", [])
  const queue = useApiResource("/telegram/review-queue", [])

  const criticalProducts = useMemo(
    () => products.data.filter((item) => Number(item.stock || 0) <= Number(item.min_stock || 0)),
    [products.data],
  )
  const pendingDebt = debts.data.filter((item) => item.status !== "paid").reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const mainSeries = data.daily_series?.length ? data.daily_series : data.monthly_series || []
  const lowMarginProducts = useMemo(() => products.data.filter((item) => marginPct(item) < 20), [products.data])
  const productsWithoutMovement = useMemo(
    () => products.data.filter((item) => !movements.data.some((movement) => movement.product_id === item.id)),
    [movements.data, products.data],
  )
  const topDebt = [...debts.data].filter((item) => item.status !== "paid").sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0]
  const alerts = [
    ...criticalProducts.slice(0, 2).map((product) => ({
      title: `${product.name} tiene stock crítico`,
      text: `Stock actual ${formatQuantity(product.stock)}. Mínimo recomendado ${formatQuantity(product.min_stock)}.`,
      tone: "danger",
      icon: Boxes,
    })),
    ...(queue.data.length ? [{ title: `${queue.data.length} mensajes Telegram pendientes`, text: "Revisa y aprueba solo lo que esté claro.", tone: "pending", icon: Bot }] : []),
    ...(topDebt ? [{ title: `${topDebt.counterparty} debe ${formatMoney(topDebt.balance)}`, text: "Prioriza la cobranza o registra un pago parcial.", tone: "warning", icon: ReceiptText }] : []),
    ...lowMarginProducts.slice(0, 1).map((product) => ({
      title: `${product.name} tiene margen bajo`,
      text: `Margen actual ${marginPct(product)}%. Revisa costo o precio de venta.`,
      tone: "warning",
      icon: TrendingDown,
    })),
    ...productsWithoutMovement.slice(0, 1).map((product) => ({
      title: `${product.name} no tiene movimiento reciente`,
      text: "Puede ser producto lento o necesita revisión de stock.",
      tone: "info",
      icon: AlertTriangle,
    })),
  ]
  const priorities = [
    queue.data.length ? `Aprobar ${queue.data.length} mensajes Telegram` : null,
    criticalProducts.length ? `Reponer ${criticalProducts.length} productos críticos` : null,
    pendingDebt ? `Cobrar o revisar ${formatMoney(pendingDebt)} en deudas` : null,
    lowMarginProducts.length ? `Revisar margen de ${lowMarginProducts.length} productos` : null,
    productsWithoutMovement.length ? `Evaluar ${productsWithoutMovement.length} productos sin movimiento` : null,
  ].filter(Boolean)
  const salesTrend = trendLabel(mainSeries, "revenue")
  const expenseTrend = trendLabel(mainSeries, "expenses")
  const riskCount = queue.data.length + criticalProducts.length + lowMarginProducts.length + (pendingDebt ? 1 : 0)
  const businessState = riskCount === 0 && data.profit >= 0 ? "Estable" : riskCount <= 2 ? "Atención" : "Riesgo"

  return (
    <>
      <SectionHeader
        eyebrow="Resumen"
        title="Estado del negocio en 10 segundos"
        description="Primero lo urgente: dinero, deudas, productos críticos y mensajes pendientes."
        action={<span className={`rounded-full px-3 py-1.5 text-sm font-bold ${businessState === "Estable" ? "bg-emerald-50 text-[#16A34A]" : "bg-amber-50 text-[#F59E0B]"}`}>{businessState}</span>}
      />
      {error && <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={CircleDollarSign} label="Ganancia" value={formatMoney(data.profit)} helper="Ventas menos gastos" tone={data.profit >= 0 ? "success" : "danger"} />
        <SummaryCard icon={TrendingUp} label="Ventas" value={formatMoney(data.revenue)} helper="Dinero que entro" tone="info" />
        <SummaryCard icon={ReceiptText} label="Deudas pendientes" value={formatMoney(pendingDebt)} helper={`${debts.data.filter((item) => item.status !== "paid").length} abiertas`} tone={pendingDebt ? "warning" : "success"} />
        <SummaryCard icon={Boxes} label="Productos criticos" value={criticalProducts.length} helper="Stock bajo o al minimo" tone={criticalProducts.length ? "danger" : "success"} />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div>
          <SectionHeader title="Alertas inteligentes" description="Acciones que conviene revisar primero." />
          <div className="grid gap-3">
            {products.loading || debts.loading || queue.loading ? (
              <LoadingSkeleton rows={4} />
            ) : alerts.length ? (
              alerts.map((alert) => <AlertCard key={alert.title} icon={alert.icon} title={alert.title} text={alert.text} tone={alert.tone} />)
            ) : (
              <EmptyState title="No hay alertas críticas" description="El negocio no tiene pendientes urgentes con los datos actuales." />
            )}
          </div>
        </div>

        <div>
          <SectionHeader title="Qué revisar hoy" description="Orden sugerido para tomar acción." />
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {priorities.length ? (
              <ol className="space-y-3">
                {priorities.slice(0, 5).map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm font-semibold text-slate-800">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">{index + 1}</span>
                    <span className="pt-1">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nada urgente por revisar" description="Puedes revisar reportes o seguir operando con normalidad." />
            )}
          </div>
          <SectionHeader title="Salud del negocio" description="Lectura rápida en lenguaje empresarial." />
          <div className="grid gap-3">
            <MetricTrend label="Tendencia ventas" value={salesTrend.value} trend={salesTrend.trend} tone={salesTrend.tone} />
            <MetricTrend label="Tendencia gastos" value={expenseTrend.value} trend={expenseTrend.trend} tone={expenseTrend.tone} />
            <MetricTrend label="Estado general" value={businessState} trend={riskCount ? `${riskCount} riesgos` : "sin alertas"} tone={businessState === "Estable" ? "success" : businessState === "Riesgo" ? "danger" : "warning"} />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Ventas vs gastos" description={loading ? "Sincronizando datos..." : "Comparacion principal del negocio."} />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mainSeries}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey={mainSeries[0]?.day ? "day" : "month"} stroke="#64748B" tickLine={false} axisLine={false} />
              <YAxis stroke="#64748B" tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => formatMoney(value)} contentStyle={prettyTooltip()} />
              <Bar dataKey="revenue" name="Ventas" fill="#2563EB" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenses" name="Gastos" fill="#93C5FD" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title="Ultimos movimientos" description="Registros recientes desde web o Telegram." />
        <DataTable
          columns={[
            { key: "description", label: "Movimiento" },
            { key: "type", label: "Tipo", render: (row) => <StatusBadge value={row.type} /> },
            { key: "amount", label: "Monto", render: (row) => formatMoney(row.amount) },
            { key: "source", label: "Origen", render: (row) => <StatusBadge value={row.source} /> },
          ]}
          rows={data.recent_movements || []}
        />
      </section>
    </>
  )
}

function marginPct(product) {
  const price = Number(product.price || 0)
  const cost = Number(product.cost || 0)
  if (price <= 0) return 0
  return Math.round(((price - cost) / price) * 100)
}

function formatQuantity(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

function trendLabel(rows, key) {
  const values = (rows || []).map((item) => Number(item[key] || 0)).filter((value) => value > 0)
  if (values.length < 2) return { value: "Sin tendencia", trend: "pocos datos", tone: "info" }
  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  if (current > previous) return { value: "Subiendo", trend: `+${Math.round(((current - previous) / previous) * 100)}%`, tone: key === "revenue" ? "success" : "warning" }
  if (current < previous) return { value: "Bajando", trend: `${Math.round(((current - previous) / previous) * 100)}%`, tone: key === "revenue" ? "warning" : "success" }
  return { value: "Estable", trend: "0%", tone: "info" }
}
