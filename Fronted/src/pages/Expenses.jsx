import { Download, Eye, Filter, Plus, ReceiptText, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { downloadCsv, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

const fallback = []

export default function Expenses() {
  const { data } = useApiResource("/expenses", fallback)
  const [filters, setFilters] = useState({
    query: "",
    category: "Todas",
    source: "Todos",
    from: "",
    to: "",
  })

  const normalizedRows = data.map((item) => ({
    worker_name: "Sin trabajador",
    payment_method: "No indicado",
    supplier: "No indicado",
    voucher_url: "",
    voucher_status: "pending",
    ...item,
  }))

  const categories = ["Todas", ...new Set(normalizedRows.map((item) => item.category || "Sin categoria"))]
  const sources = ["Todos", ...new Set(normalizedRows.map((item) => item.source || "web"))]

  const filtered = useMemo(() => {
    return normalizedRows.filter((item) => {
      const text = `${item.description} ${item.category} ${item.worker_name} ${item.supplier}`.toLowerCase()
      const queryMatch = text.includes(filters.query.toLowerCase())
      const categoryMatch = filters.category === "Todas" || item.category === filters.category
      const sourceMatch = filters.source === "Todos" || item.source === filters.source
      const fromMatch = !filters.from || item.occurred_on >= filters.from
      const toMatch = !filters.to || item.occurred_on <= filters.to
      return queryMatch && categoryMatch && sourceMatch && fromMatch && toMatch
    })
  }, [normalizedRows, filters])

  const total = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const materialRows = filtered.filter((item) => ["Materia prima", "Materiales"].includes(item.category))
  const materialTotal = materialRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const highest = [...filtered].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0]

  function exportReport() {
    downloadCsv(
      `smartconta-gastos-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((item) => ({
        fecha: item.occurred_on,
        descripcion: item.description,
        categoria: item.category,
        monto: item.amount,
        trabajador: item.worker_name,
        proveedor: item.supplier,
        metodo_pago: item.payment_method,
        origen: item.source,
        voucher: item.voucher_url || "sin voucher",
        estado_voucher: item.voucher_status,
      })),
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Control financiero"
        title="Gastos"
        description="Filtra, revisa vouchers y descarga un reporte entendible de todo lo que gasto la empresa."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportReport} className="pastel-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition">
              <Download size={16} /> Descargar reporte
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-slate-300/30">
              <Plus size={16} /> Nuevo gasto
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={ReceiptText} label="Total filtrado" value={formatMoney(total)} helper="Suma solo los gastos que ves en la tabla" tone="rose" />
        <StatCard label="Materiales" value={formatMoney(materialTotal)} helper="Materia prima y materiales del periodo" tone="amber" />
        <StatCard label="Gasto mas alto" value={highest ? formatMoney(highest.amount) : "S/ 0.00"} helper={highest?.description || "No hay registros"} />
      </div>

      <section className="glass-panel mb-6 rounded-[2rem] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-muted" />
          <h3 className="font-semibold text-ink">Filtros para encontrar gastos rapido</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="soft-input rounded-2xl px-4 py-3">
            <span className="text-xs text-muted">Buscar</span>
            <span className="mt-1 flex items-center gap-2">
              <Search size={15} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm text-ink outline-none"
                placeholder="gasolina, leche, proveedor..."
                value={filters.query}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              />
            </span>
          </label>

          <Select label="Categoria" value={filters.category} options={categories} onChange={(value) => setFilters({ ...filters, category: value })} />
          <Select label="Origen" value={filters.source} options={sources} onChange={(value) => setFilters({ ...filters, source: value })} />
          <DateInput label="Desde" value={filters.from} onChange={(value) => setFilters({ ...filters, from: value })} />
          <DateInput label="Hasta" value={filters.to} onChange={(value) => setFilters({ ...filters, to: value })} />
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        <Insight title="Que significa esta tabla" text="Cada fila es un gasto reportado por Telegram o registrado en la web. Sirve para saber quien gasto, en que, cuando y si tiene voucher." />
        <Insight title="Materiales por periodo" text={`Con los filtros actuales, materiales y materia prima suman ${formatMoney(materialTotal)}. Cambia las fechas para comparar dia contra mes.`} />
        <Insight title="Voucher" text="Si aparece el boton Ver, significa que hay una foto o archivo asociado al gasto para auditoria." />
      </section>

      <DataTable
        columns={[
          { key: "occurred_on", label: "Fecha" },
          { key: "category", label: "Categoria" },
          { key: "description", label: "Detalle" },
          { key: "worker_name", label: "Trabajador" },
          { key: "supplier", label: "Proveedor" },
          { key: "payment_method", label: "Pago" },
          { key: "amount", label: "Monto", render: (row) => formatMoney(row.amount) },
          { key: "source", label: "Origen", render: (row) => <StatusBadge value={row.source} /> },
          {
            key: "voucher_url",
            label: "Voucher",
            render: (row) =>
              row.voucher_url ? (
                <button className="inline-flex items-center gap-1 rounded-full bg-[#dcebf2] px-3 py-1 text-xs font-semibold text-[#577c8f] shadow-sm">
                  <Eye size={13} /> Ver
                </button>
              ) : (
                <span className="text-xs text-muted">Sin foto</span>
              ),
          },
          { key: "voucher_status", label: "Estado", render: (row) => <StatusBadge value={row.voucher_status} /> },
        ]}
        rows={filtered}
      />
    </>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="soft-input rounded-2xl px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <select className="mt-1 w-full bg-transparent text-sm text-ink outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} className="bg-cream" value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function DateInput({ label, value, onChange }) {
  return (
    <label className="soft-input rounded-2xl px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <input className="mt-1 w-full bg-transparent text-sm text-ink outline-none" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function Insight({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-white/70 bg-white/52 p-4 shadow-lg shadow-slate-300/20">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}
