import { Boxes, Plus, RefreshCcw } from "lucide-react"
import { useMemo, useState } from "react"
import { api, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

export default function Inventory() {
  const products = useApiResource("/products", [])
  const movements = useApiResource("/inventory/stock-movements", [])
  const [productForm, setProductForm] = useState({ name: "", category: "", unit: "unidad", cost: 0, price: 0, stock: 0, min_stock: 0 })
  const [stockForm, setStockForm] = useState({ product_id: "", type: "adjustment", quantity: 0, new_stock: "", reason: "" })
  const [message, setMessage] = useState("")

  const totalUnits = products.data.reduce((sum, item) => sum + Number(item.stock || 0), 0)
  const stockValue = products.data.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.cost || 0), 0)
  const lowStock = products.data.filter((item) => Number(item.stock || 0) <= Number(item.min_stock || 0)).length

  const productMap = useMemo(() => Object.fromEntries(products.data.map((item) => [item.id, item.name])), [products.data])

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

  return (
    <>
      <PageHeader
        eyebrow="Inventario"
        title="Stock y productos"
        description="Controla productos, stock actual e historial de movimientos sin perder los datos de dias anteriores."
      />
      {message && <p className="mb-4 rounded-2xl bg-brand/50 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={Boxes} label="Productos" value={products.data.length} helper="Productos activos en la empresa" />
        <StatCard label="Unidades" value={totalUnits} helper="Stock total actual" tone="cyan" />
        <StatCard label="Valor stock" value={formatMoney(stockValue)} helper={`${lowStock} productos en stock bajo`} tone="amber" />
      </div>

      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <form onSubmit={createProduct} className="glass-panel rounded-[2.4rem] p-6">
          <FormTitle icon={Plus} title="Crear producto" text="Registra productos para poder vender, ajustar stock y seguir costos." />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" value={productForm.name} onChange={(value) => setProductForm({ ...productForm, name: value })} required />
            <Field label="Categoria" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
            <Field label="Unidad" value={productForm.unit} onChange={(value) => setProductForm({ ...productForm, unit: value })} />
            <Field label="Stock inicial" type="number" value={productForm.stock} onChange={(value) => setProductForm({ ...productForm, stock: Number(value) })} />
            <Field label="Costo" type="number" value={productForm.cost} onChange={(value) => setProductForm({ ...productForm, cost: Number(value) })} />
            <Field label="Precio venta" type="number" value={productForm.price} onChange={(value) => setProductForm({ ...productForm, price: Number(value) })} />
          </div>
          <button className="pastel-button mt-4 rounded-full px-5 py-3 text-sm font-bold">Guardar producto</button>
        </form>

        <form onSubmit={createStockMovement} className="glass-panel rounded-[2.4rem] p-6">
          <FormTitle icon={RefreshCcw} title="Actualizar stock" text="Guarda entradas, salidas o ajustes y conserva el historial por fecha." />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="soft-input rounded-2xl px-4 py-3 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Producto</span>
              <select className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" value={stockForm.product_id} onChange={(event) => setStockForm({ ...stockForm, product_id: event.target.value })} required>
                <option value="">Seleccionar</option>
                {products.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="soft-input rounded-2xl px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Tipo</span>
              <select className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" value={stockForm.type} onChange={(event) => setStockForm({ ...stockForm, type: event.target.value })}>
                <option value="entry">Entrada</option>
                <option value="sale">Salida por venta</option>
                <option value="adjustment">Ajuste</option>
                <option value="loss">Perdida</option>
              </select>
            </label>
            <Field label="Cantidad" type="number" value={stockForm.quantity} onChange={(value) => setStockForm({ ...stockForm, quantity: Number(value) })} />
            <Field label="Stock final opcional" type="number" value={stockForm.new_stock} onChange={(value) => setStockForm({ ...stockForm, new_stock: value })} />
            <Field label="Motivo" value={stockForm.reason} onChange={(value) => setStockForm({ ...stockForm, reason: value })} />
          </div>
          <button className="pastel-button mt-4 rounded-full px-5 py-3 text-sm font-bold">Actualizar stock</button>
        </form>
      </section>

      <section className="mb-6">
        <DataTable
          columns={[
            { key: "name", label: "Producto" },
            { key: "category", label: "Categoria" },
            { key: "unit", label: "Unidad" },
            { key: "stock", label: "Stock" },
            { key: "cost", label: "Costo", render: (row) => formatMoney(row.cost) },
            { key: "price", label: "Precio", render: (row) => formatMoney(row.price) },
            { key: "status", label: "Estado", render: (row) => Number(row.stock || 0) <= Number(row.min_stock || 0) ? <StatusBadge value="pending" /> : <StatusBadge value="active" /> },
          ]}
          rows={products.data}
        />
      </section>

      <DataTable
        columns={[
          { key: "occurred_on", label: "Fecha" },
          { key: "product_id", label: "Producto", render: (row) => productMap[row.product_id] || row.product_id },
          { key: "type", label: "Tipo", render: (row) => <StatusBadge value={row.type} /> },
          { key: "previous_stock", label: "Antes" },
          { key: "new_stock", label: "Despues" },
          { key: "quantity", label: "Cambio" },
          { key: "reason", label: "Motivo" },
        ]}
        rows={movements.data}
      />
    </>
  )
}

function FormTitle({ icon: Icon, title, text }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-ink"><Icon size={18} /></span>
      <div>
        <h3 className="text-2xl font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-muted">{text}</p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="soft-input rounded-2xl px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
      <input className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  )
}

