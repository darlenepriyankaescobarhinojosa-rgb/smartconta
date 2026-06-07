import { Boxes, Filter, Plus, RefreshCcw, Search, Tags } from "lucide-react"
import { createElement, useMemo, useState } from "react"
import { api, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import EmptyState from "../components/EmptyState"
import LoadingSkeleton from "../components/LoadingSkeleton"
import ProductCard from "../components/ProductCard"
import SectionHeader from "../components/SectionHeader"
import SummaryCard from "../components/SummaryCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"
import { costTrend, formatPercent, hasMovement, marginInfo, productStatus } from "../lib/productMetrics"

export default function Inventory() {
  const products = useApiResource("/products", [])
  const movements = useApiResource("/inventory/stock-movements", [])
  const prices = useApiResource("/inventory/price-history", [])
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [productForm, setProductForm] = useState({ name: "", category: "", unit: "unidad", cost: 0, price: 0, stock: 0, min_stock: 0 })
  const [stockForm, setStockForm] = useState({ product_id: "", type: "adjustment", quantity: 0, new_stock: "", reason: "" })
  const [priceForm, setPriceForm] = useState({ product_id: "", cost: 0, price: 0, notes: "" })
  const [reviewProduct, setReviewProduct] = useState(null)
  const [message, setMessage] = useState("")

  const productMap = useMemo(() => Object.fromEntries(products.data.map((item) => [item.id, item.name])), [products.data])
  const totalValue = products.data.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.cost || 0), 0)
  const criticalProducts = products.data.filter((item) => Number(item.stock || 0) <= Number(item.min_stock || 0))
  const averageMarginPct = products.data.length
    ? products.data.reduce((sum, item) => sum + marginInfo(item).marginPct, 0) / products.data.length
    : 0

  const filteredProducts = useMemo(() => {
    const result = products.data.filter((item) => {
      const text = `${item.name} ${item.category}`.toLowerCase()
      const queryMatch = text.includes(query.toLowerCase())
      const critical = Number(item.stock || 0) <= Number(item.min_stock || 0)
      const margin = marginInfo(item)
      const trend = costTrend(item, prices.data)
      const noMovement = !hasMovement(item, movements.data)
      const filterMatch =
        filter === "all" ||
        (filter === "critical" && critical) ||
        (filter === "low-margin" && margin.marginPct < 20) ||
        (filter === "slow" && noMovement) ||
        (filter === "cost-up" && trend.isIncreasing) ||
        (filter === "profitable" && margin.marginPct >= 30)
      return queryMatch && filterMatch
    })

    if (filter === "profitable") {
      return [...result].sort((a, b) => marginInfo(b).marginPct - marginInfo(a).marginPct)
    }

    return result
  }, [filter, movements.data, prices.data, products.data, query])

  async function createProduct(event) {
    event.preventDefault()
    setMessage("")
    await api.post("/products", productForm)
    setProductForm({ name: "", category: "", unit: "unidad", cost: 0, price: 0, stock: 0, min_stock: 0 })
    setMessage("Producto creado.")
    products.reload()
  }

  async function createStockMovement(event) {
    event.preventDefault()
    setMessage("")
    await api.post("/inventory/stock-movements", {
      ...stockForm,
      product_id: Number(stockForm.product_id),
      quantity: Number(stockForm.quantity || 0),
      new_stock: stockForm.new_stock === "" ? null : Number(stockForm.new_stock),
    })
    setStockForm({ product_id: "", type: "adjustment", quantity: 0, new_stock: "", reason: "" })
    setMessage("Stock actualizado.")
    products.reload()
    movements.reload()
  }

  async function updatePrice(event) {
    event.preventDefault()
    setMessage("")
    await api.post("/inventory/price-history", {
      ...priceForm,
      product_id: Number(priceForm.product_id),
      cost: Number(priceForm.cost),
      price: Number(priceForm.price),
    })
    setPriceForm({ product_id: "", cost: 0, price: 0, notes: "" })
    setMessage("Precio actualizado.")
    products.reload()
    prices.reload()
  }

  function openProductReview(product) {
    setReviewProduct(product)
  }

  function prepareProductForStock(product) {
    setStockForm({
      product_id: String(product.id),
      type: "adjustment",
      quantity: Number(product.stock || 0),
      new_stock: product.stock ?? "",
      reason: `Revisar ${product.name}`,
    })
    setReviewProduct(null)
    document.getElementById("stock-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function prepareProductForPrice(product) {
    setPriceForm({
      product_id: String(product.id),
      cost: Number(product.cost || 0),
      price: Number(product.price || 0),
      notes: `Revisar ${product.name}`,
    })
    setReviewProduct(null)
    document.getElementById("price-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
      <SectionHeader
        eyebrow="Productos"
        title="Centro de rentabilidad e inventario"
        description="Stock, costo, precio, margen y alertas de cada producto en una sola vista."
      />
      {message && <p className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Boxes} label="Productos" value={products.data.length} helper="Registrados" tone="info" />
        <SummaryCard icon={Filter} label="Criticos" value={criticalProducts.length} helper="Stock bajo o mínimo" tone={criticalProducts.length ? "danger" : "success"} />
        <SummaryCard icon={Tags} label="Valor stock" value={formatMoney(totalValue)} helper="Stock x costo" tone="info" />
        <SummaryCard label="Margen promedio" value={`${Math.round(averageMarginPct)}%`} helper="Sobre precio de venta" tone={averageMarginPct >= 20 ? "success" : "warning"} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="soft-input flex items-center gap-3 rounded-2xl px-4 py-3">
            <Search size={18} className="text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Buscar producto..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1">
            {[
              ["all", "Todos"],
              ["critical", "Criticos"],
              ["low-margin", "Bajo margen"],
              ["slow", "Sin movimiento"],
              ["cost-up", "Costos aumentando"],
              ["profitable", "Mas rentables"],
            ].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={`min-w-fit rounded-xl px-3 py-2 text-sm font-bold ${filter === key ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:hidden">
        {products.loading ? (
          <LoadingSkeleton rows={4} />
        ) : filteredProducts.length ? (
          filteredProducts.map((product) => <ProductCard key={product.id} product={product} priceHistory={prices.data} movements={movements.data} onReview={openProductReview} />)
        ) : (
          <EmptyState title="No hay productos para este filtro" description="Cambia el filtro o registra productos para ver alertas de rentabilidad e inventario." />
        )}
      </section>

      <section className="mt-6 hidden lg:block">
        {products.loading ? (
          <LoadingSkeleton rows={5} />
        ) : filteredProducts.length ? (
          <DataTable
            columns={[
              { key: "name", label: "Producto" },
              { key: "status", label: "Estado", render: (row) => <ProductStatusBadge status={productStatus(row, prices.data, movements.data)} /> },
              { key: "stock", label: "Stock", render: (row) => `${formatQuantity(Number(row.stock || 0))} / min ${formatQuantity(Number(row.min_stock || 0))}` },
              { key: "cost", label: "Costo", render: (row) => <TrendCell value={formatMoney(costTrend(row, prices.data).currentCost)} helper={costTrend(row, prices.data).hasComparison ? formatPercent(costTrend(row, prices.data).changePct) : "sin historial"} tone={costTrend(row, prices.data).changePct > 0 ? "danger" : "success"} /> },
              { key: "price", label: "Precio venta", render: (row) => formatMoney(row.price) },
              { key: "margin", label: "Margen", render: (row) => <TrendCell value={formatMoney(marginInfo(row).margin)} helper={`${Math.round(marginInfo(row).marginPct)}%`} tone={marginInfo(row).level === "low" ? "danger" : marginInfo(row).level === "medium" ? "warning" : "success"} /> },
              { key: "rotation", label: "Movimiento", render: (row) => hasMovement(row, movements.data) ? "Con actividad" : "Sin movimiento" },
            ]}
            rows={filteredProducts}
          />
        ) : (
          <EmptyState title="No hay productos para este filtro" description="Los filtros usan stock, historial de costos, margen y movimientos existentes." />
        )}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        <form onSubmit={createProduct} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FormTitle icon={Plus} title="Crear producto" />
          <div className="grid gap-3">
            <Field label="Nombre" value={productForm.name} onChange={(value) => setProductForm({ ...productForm, name: value })} required />
            <Field label="Categoria" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidad" value={productForm.unit} onChange={(value) => setProductForm({ ...productForm, unit: value })} />
              <Field label="Stock minimo" type="number" value={productForm.min_stock} onChange={(value) => setProductForm({ ...productForm, min_stock: Number(value) })} />
            </div>
          </div>
          <button className="pastel-button mt-4 rounded-xl px-4 py-3 text-sm font-bold">Guardar</button>
        </form>

        <form id="stock-form" onSubmit={createStockMovement} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FormTitle icon={RefreshCcw} title="Actualizar stock" />
          <ProductSelect products={products.data} value={stockForm.product_id} onChange={(value) => setStockForm({ ...stockForm, product_id: value })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Select label="Tipo" value={stockForm.type} onChange={(value) => setStockForm({ ...stockForm, type: value })} options={[["entry", "Entrada"], ["sale", "Salida"], ["adjustment", "Ajuste"], ["loss", "Perdida"]]} />
            <Field label="Cantidad" type="number" value={stockForm.quantity} onChange={(value) => setStockForm({ ...stockForm, quantity: Number(value) })} />
          </div>
          <Field label="Stock final opcional" type="number" value={stockForm.new_stock} onChange={(value) => setStockForm({ ...stockForm, new_stock: value })} />
          <button className="pastel-button mt-4 rounded-xl px-4 py-3 text-sm font-bold">Actualizar</button>
        </form>

        <form id="price-form" onSubmit={updatePrice} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <FormTitle icon={Tags} title="Actualizar precio" />
          <ProductSelect products={products.data} value={priceForm.product_id} onChange={(value) => setPriceForm({ ...priceForm, product_id: value })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Costo" type="number" value={priceForm.cost} onChange={(value) => setPriceForm({ ...priceForm, cost: value })} />
            <Field label="Precio venta" type="number" value={priceForm.price} onChange={(value) => setPriceForm({ ...priceForm, price: value })} />
          </div>
          <Field label="Nota" value={priceForm.notes} onChange={(value) => setPriceForm({ ...priceForm, notes: value })} />
          <button className="pastel-button mt-4 rounded-xl px-4 py-3 text-sm font-bold">Guardar precio</button>
        </form>
      </section>

      <section className="mt-6">
        <SectionHeader title="Movimientos de stock" description="Historial operativo por producto." />
        <DataTable
          columns={[
            { key: "occurred_on", label: "Fecha" },
            { key: "product_id", label: "Producto", render: (row) => productMap[row.product_id] || row.product_id },
            { key: "type", label: "Tipo", render: (row) => <StatusBadge value={row.type} /> },
            { key: "previous_stock", label: "Antes" },
            { key: "new_stock", label: "Despues" },
            { key: "quantity", label: "Cambio" },
          ]}
          rows={movements.data}
        />
      </section>

      {reviewProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 p-4 lg:items-center">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Revisar producto</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{reviewProduct.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {reviewProduct.category || "Sin categoria"} · {reviewProduct.unit}
                </p>
              </div>
              <button type="button" onClick={() => setReviewProduct(null)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
                Cerrar
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => prepareProductForStock(reviewProduct)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">
                Revisar stock
              </button>
              <button type="button" onClick={() => prepareProductForPrice(reviewProduct)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
                Revisar precio
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function FormTitle({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {createElement(Icon, { size: 18 })}
      </span>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
    </div>
  )
}

function ProductSelect({ products, value, onChange }) {
  return (
    <label className="soft-input block rounded-2xl px-4 py-3">
      <span className="text-xs font-bold uppercase text-slate-500">Producto</span>
      <select className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Seleccionar</option>
        {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="soft-input block rounded-2xl px-4 py-3">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <select className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="soft-input mt-3 block rounded-2xl px-4 py-3 first:mt-0">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      <input className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  )
}

function ProductStatusBadge({ status }) {
  const classes = {
    danger: "bg-red-50 text-[#DC2626]",
    warning: "bg-amber-50 text-[#F59E0B]",
    success: "bg-emerald-50 text-[#16A34A]",
  }

  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${classes[status.tone] || classes.success}`}>{status.label}</span>
}

function TrendCell({ value, helper, tone }) {
  const classes = {
    danger: "text-[#DC2626]",
    warning: "text-[#F59E0B]",
    success: "text-[#16A34A]",
  }

  return (
    <div>
      <p className="font-semibold text-slate-900">{value}</p>
      <p className={`text-xs font-semibold ${classes[tone] || "text-slate-500"}`}>{helper}</p>
    </div>
  )
}

function formatQuantity(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}
