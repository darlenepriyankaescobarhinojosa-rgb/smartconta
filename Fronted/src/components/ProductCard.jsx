import { formatMoney } from "../api"
import { costTrend, formatPercent, marginInfo, priceTrend, productStatus } from "../lib/productMetrics"

export default function ProductCard({ product, priceHistory = [], movements = [], onReview }) {
  const stock = Number(product.stock || 0)
  const minStock = Number(product.min_stock || 0)
  const margin = marginInfo(product)
  const cost = costTrend(product, priceHistory)
  const price = priceTrend(product, priceHistory)
  const status = productStatus(product, priceHistory, movements)
  const marginLabel = margin.level === "high" ? "margen alto" : margin.level === "medium" ? "margen medio" : "margen bajo"
  const stockCritical = stock <= minStock
  const costIncreasing = cost.isIncreasing
  const lowMargin = margin.marginPct < 20

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-slate-900">{product.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{product.category || "Sin categoria"} · {product.unit}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(status.tone)}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {stockCritical && <Badge tone="danger">Stock crítico</Badge>}
        {costIncreasing && <Badge tone="warning">Costo subiendo</Badge>}
        {lowMargin && <Badge tone="warning">Margen bajo</Badge>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Stock" value={formatQuantity(stock)} helper={`Min. ${formatQuantity(minStock)}`} />
        <Metric label="Costo actual" value={formatMoney(cost.currentCost)} helper={cost.hasComparison ? `${formatPercent(cost.changePct)} vs anterior` : "sin comparativo"} emphasis={cost.changePct > 0 ? "danger" : "success"} />
        <Metric label="Precio venta" value={formatMoney(price.currentPrice)} helper={price.hasComparison ? `${formatPercent(price.changePct)} vs anterior` : "sin comparativo"} />
        <Metric label="Margen" value={formatMoney(margin.margin)} helper={`${Math.round(margin.marginPct)}% · ${marginLabel}`} emphasis={margin.level === "low" ? "danger" : margin.level === "medium" ? "warning" : "success"} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        Estado: <strong className="text-slate-900">{status.reason}</strong> · Rentabilidad: <strong className="text-slate-900">{margin.marginPct >= 30 ? "alta" : margin.marginPct >= 15 ? "media" : "revisar"}</strong>
      </div>

      {onReview && (
        <button
          type="button"
          onClick={() => onReview(product)}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          Revisar
        </button>
      )}
    </article>
  )
}

function Metric({ label, value, helper, emphasis }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
      <p className={`text-xs ${emphasisClass(emphasis)}`}>{helper}</p>
    </div>
  )
}

function formatQuantity(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function statusClass(tone) {
  if (tone === "danger") return "bg-red-50 text-[#DC2626]"
  if (tone === "warning") return "bg-amber-50 text-[#F59E0B]"
  return "bg-emerald-50 text-[#16A34A]"
}

function Badge({ tone, children }) {
  const classes = {
    danger: "bg-red-50 text-[#DC2626]",
    warning: "bg-amber-50 text-[#F59E0B]",
    success: "bg-emerald-50 text-[#16A34A]",
  }

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${classes[tone] || classes.warning}`}>{children}</span>
}

function emphasisClass(tone) {
  if (tone === "danger") return "font-semibold text-[#DC2626]"
  if (tone === "warning") return "font-semibold text-[#F59E0B]"
  if (tone === "success") return "font-semibold text-[#16A34A]"
  return "text-slate-500"
}
