import { Tags } from "lucide-react"
import { useMemo, useState } from "react"
import { api, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import { useApiResource } from "../hooks/useApiResource"

export default function Prices() {
  const products = useApiResource("/products", [])
  const prices = useApiResource("/inventory/price-history", [])
  const [form, setForm] = useState({ product_id: "", cost: 0, price: 0, notes: "" })
  const [message, setMessage] = useState("")
  const productMap = useMemo(() => Object.fromEntries(products.data.map((item) => [item.id, item.name])), [products.data])
  const avgMargin = products.data.length
    ? products.data.reduce((sum, item) => sum + (Number(item.price || 0) - Number(item.cost || 0)), 0) / products.data.length
    : 0

  async function submit(event) {
    event.preventDefault()
    await api.post("/inventory/price-history", { ...form, product_id: Number(form.product_id), cost: Number(form.cost), price: Number(form.price) })
    setForm({ product_id: "", cost: 0, price: 0, notes: "" })
    setMessage("Precio actualizado y guardado en historial.")
    products.reload()
    prices.reload()
  }

  return (
    <>
      <PageHeader eyebrow="Precios" title="Historial de costos y precios" description="Guarda cuanto cambia el costo y precio de cada producto por dia." />
      {message && <p className="mb-4 rounded-2xl bg-brand/50 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={Tags} label="Productos" value={products.data.length} helper="Con precio actual" />
        <StatCard label="Cambios" value={prices.data.length} helper="Registros historicos" tone="cyan" />
        <StatCard label="Margen prom." value={formatMoney(avgMargin)} helper="Precio menos costo promedio" tone="amber" />
      </div>
      <form onSubmit={submit} className="glass-panel mb-6 rounded-[2.4rem] p-6">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
          <label className="soft-input rounded-2xl px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Producto</span>
            <select className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} required>
              <option value="">Seleccionar</option>
              {products.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <Field label="Costo" type="number" value={form.cost} onChange={(value) => setForm({ ...form, cost: value })} />
          <Field label="Precio" type="number" value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
          <Field label="Nota" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          <button className="pastel-button rounded-2xl px-5 py-3 text-sm font-bold">Guardar</button>
        </div>
      </form>
      <DataTable
        columns={[
          { key: "occurred_on", label: "Fecha" },
          { key: "product_id", label: "Producto", render: (row) => productMap[row.product_id] || row.product_id },
          { key: "cost", label: "Costo", render: (row) => formatMoney(row.cost) },
          { key: "price", label: "Precio", render: (row) => formatMoney(row.price) },
          { key: "margin", label: "Margen", render: (row) => formatMoney(Number(row.price || 0) - Number(row.cost || 0)) },
          { key: "notes", label: "Notas" },
        ]}
        rows={prices.data}
      />
    </>
  )
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="soft-input rounded-2xl px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
      <input className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

