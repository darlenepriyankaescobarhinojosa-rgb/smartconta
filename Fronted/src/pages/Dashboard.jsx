import { AlertTriangle, Bot, Boxes, CircleDollarSign, ReceiptText, TrendingDown, TrendingUp } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatMoney } from "../api"
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

export default function Dashboard() {
  const { data, loading, error } = useApiResource("/dashboard/summary", emptySummary)
  const debts = useApiResource("/debts", [])
  const products = useApiResource("/products", [])
  const prices = useApiResource("/inventory/price-history", [])
  const movements = useApiResource("/inventory/stock-movements", [])
  const queue = useApiResource("/telegram/review-queue", [])

  const criticalProducts = useMemo(
    () => products.data.filter((item) => Number(item.stock || 0) <= Number(item.min_stock || 0)),
    [products.data],
  )
  const pendingDebt = debts.data.filter((item) => item.status !== "paid").reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const mainSeries = data.daily_series?.length ? data.daily_series : data.monthly_series || []
  const lowMarginProducts = useMemo(() => products.data.filter((item) => marginInfo(item).marginPct < 20), [products.data])
  const costIncreasingProducts = useMemo(() => products.data.filter((item) => costTrend(item, prices.data).isIncreasing), [products.data, prices.data])
  const productsWithoutMovement = useMemo(
    () => products.data.filter((item) => !movements.data.some((movement) => movement.product_id === item.id)),
    [movements.data, products.data],
  )
  const topDebt = [...debts.data].filter((item) => item.status !== "paid").sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))[0]
  const attentionProducts = useMemo(
    () =>
      products.data
        .map((product) => ({
          product,
          stockCritical: Number(product.stock || 0) <= Number(product.min_stock || 0),
          costIncreasing: costTrend(product, prices.data).isIncreasing,
          margin: marginInfo(product).marginPct,
        }))
        .sort((left, right) => {
          const leftScore = attentionScore(left)
          const rightScore = attentionScore(right)
          return rightScore - leftScore
        })
        .filter((item) => item.stockCritical || item.costIncreasing || item.margin < 20)
        .slice(0, 5),
    [products.data, prices.data],
  )
  const alerts = [
    ...criticalProducts.slice(0, 2).map((product) => ({
      title: `${product.name} tiene stock crítico`,
      text: `Stock actual ${formatQuantity(product.stock)}. Mínimo recomendado ${formatQuantity(product.min_stock)}.`,
      tone: "danger",
      icon: Boxes,
    })),
    ...costIncreasingProducts.slice(0, 2).map((product) => ({
      title: `${product.name} tiene costo aumentando`,
      text: `El costo actual es ${formatMoney(costTrend(product, prices.data).currentCost)}. Revisa si el proveedor cambió.`,
      tone: "warning",
      icon: TrendingUp,
    })),
    ...(queue.data.length ? [{ title: `${queue.data.length} mensajes Telegram pendientes`, text: "Revisa y aprueba solo lo que esté claro.", tone: "pending", icon: Bot }] : []),
    ...(topDebt ? [{ title: `${topDebt.counterparty} debe ${formatMoney(topDebt.balance)}`, text: "Prioriza la cobranza o registra un pago parcial.", tone: "warning", icon: ReceiptText }] : []),
    ...lowMarginProducts.slice(0, 1).map((product) => ({
      title: `${product.name} tiene margen bajo`,
      text: `Margen actual ${Math.round(marginInfo(product).marginPct)}%. Revisa costo o precio de venta.`,
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
    costIncreasingProducts.length ? `Revisar costo de ${costIncreasingProducts.length} productos` : null,
    lowMarginProducts.length ? `Revisar margen de ${lowMarginProducts.length} productos` : null,
    productsWithoutMovement.length ? `Evaluar ${productsWithoutMovement.length} productos sin movimiento` : null,
  ].filter(Boolean)
  const salesTrend = trendLabel(mainSeries, "revenue")
  const expenseTrend = trendLabel(mainSeries, "expenses")
  const riskCount = queue.data.length + criticalProducts.length + lowMarginProducts.length + costIncreasingProducts.length + (pendingDebt ? 1 : 0)
  const businessStateInfo =
    riskCount === 0 && data.profit > 0
      ? { label: "Excelente", tone: "success", text: "Tienes rentabilidad positiva y sin señales urgentes. Puedes operar con calma." }
      : riskCount <= 1 && data.profit >= 0
        ? { label: "Estable", tone: "info", text: "La operación se ve sana. Mantén el seguimiento de caja y productos clave." }
        : riskCount <= 3
          ? { label: "Atención", tone: "warning", text: "Hay señales para revisar hoy: deudas, productos o mensajes pendientes." }
          : { label: "Riesgo", tone: "danger", text: "La operación necesita intervención prioritaria para evitar pérdida de caja." }

  return (
    <>
      <SectionHeader
        eyebrow="Resumen"
        title="Estado del negocio en 10 segundos"
        description="Primero lo urgente: dinero, deudas, productos críticos y mensajes pendientes."
        action={<span className={`rounded-full px-3 py-1.5 text-sm font-bold ${stateBadgeClass(businessStateInfo.tone)}`}>{businessStateInfo.label}</span>}
      />
      {error && <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

      {loading ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <LoadingSkeleton rows={2} />
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <LoadingSkeleton rows={3} />
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">ESTADO DEL NEGOCIO</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-3xl font-bold">{businessStateInfo.label}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{businessStateInfo.text}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${stateBadgeClass(businessStateInfo.tone)}`}>{riskCount} señales</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <StateMetric label="Ganancia" value={formatMoney(data.profit)} tone={data.profit >= 0 ? "success" : "danger"} />
              <StateMetric label="Deuda abierta" value={formatMoney(pendingDebt)} tone={pendingDebt ? "warning" : "success"} />
              <StateMetric label="Productos críticos" value={String(criticalProducts.length)} tone={criticalProducts.length ? "danger" : "success"} />
              <StateMetric label="Telegram pendiente" value={String(queue.data.length)} tone={queue.data.length ? "warning" : "success"} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">HOY DEBERÍAS REVISAR</p>
            {priorities.length ? (
              <ol className="mt-4 space-y-3">
                {priorities.slice(0, 3).map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm font-semibold text-slate-800">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">{index + 1}</span>
                    <span className="pt-1">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Nada urgente por revisar" description="Puedes revisar reportes o seguir operando con normalidad." />
            )}
          </div>
        </section>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={CircleDollarSign} label="Ganancia" value={formatMoney(data.profit)} helper="Ventas menos gastos" tone={data.profit >= 0 ? "success" : "danger"} />
          <SummaryCard icon={TrendingUp} label="Ventas" value={formatMoney(data.revenue)} helper="Dinero que entro" tone="info" />
          <SummaryCard icon={ReceiptText} label="Deudas pendientes" value={formatMoney(pendingDebt)} helper={`${debts.data.filter((item) => item.status !== "paid").length} abiertas`} tone={pendingDebt ? "warning" : "success"} />
          <SummaryCard icon={Boxes} label="Productos criticos" value={criticalProducts.length} helper="Stock bajo o al minimo" tone={criticalProducts.length ? "danger" : "success"} />
        </section>
      )}

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
          <SectionHeader title="Salud del negocio" description="Lectura rápida en lenguaje empresarial." />
          <div className="grid gap-3">
            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : (
              <>
                <MetricTrend label="Tendencia ventas" value={salesTrend.value} trend={salesTrend.trend} tone={salesTrend.tone} />
                <MetricTrend label="Tendencia gastos" value={expenseTrend.value} trend={expenseTrend.trend} tone={expenseTrend.tone} />
                <MetricTrend label="Estado general" value={businessStateInfo.label} trend={riskCount ? `${riskCount} señales` : "sin alertas"} tone={businessStateInfo.tone} />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title="Productos que requieren atención" description="Prioridad por stock crítico, costo aumentando y margen bajo." />
        {attentionProducts.length ? (
          <div className="grid gap-3">
            {attentionProducts.map(({ product, stockCritical, costIncreasing, margin }) => (
              <AlertCard
                key={product.id}
                icon={stockCritical ? Boxes : costIncreasing ? TrendingUp : TrendingDown}
                tone={stockCritical ? "danger" : costIncreasing ? "warning" : "pending"}
                title={product.name}
                text={[
                  stockCritical ? `Stock crítico (${formatQuantity(product.stock)} / min ${formatQuantity(product.min_stock)})` : null,
                  costIncreasing ? `Costo aumentando (${formatMoney(costTrend(product, prices.data).currentCost)})` : null,
                  `Margen ${Math.round(margin)}%`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No hay productos que requieran atención" description="Los productos críticos, con costo al alza o margen bajo aparecerán aquí." />
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Ventas vs gastos" description={loading ? "Sincronizando datos..." : "Comparacion principal del negocio."} />
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : (
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
        )}
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

function attentionScore(entry) {
  return (entry.stockCritical ? 3 : 0) + (entry.costIncreasing ? 2 : 0) + (entry.margin < 20 ? 1 : 0)
}

function stateBadgeClass(tone) {
  const classes = {
    success: "bg-emerald-50 text-[#16A34A]",
    info: "bg-blue-50 text-blue-700",
    warning: "bg-amber-50 text-[#F59E0B]",
    danger: "bg-red-50 text-[#DC2626]",
  }

  return classes[tone] || classes.info
}

function StateMetric({ label, value, tone }) {
  const classes = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    info: "bg-slate-100 text-slate-700",
  }

  return (
    <div className={`rounded-2xl px-4 py-3 ${classes[tone] || classes.info}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  )
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
