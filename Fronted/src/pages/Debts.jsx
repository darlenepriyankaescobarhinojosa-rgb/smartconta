import { CircleDollarSign, Plus } from "lucide-react"
import { useState } from "react"
import { api, formatMoney } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

export default function Debts() {
  const debts = useApiResource("/debts", [])
  const [form, setForm] = useState({ type: "receivable", counterparty: "", original_amount: 0, notes: "" })
  const [payment, setPayment] = useState({ debt_id: "", amount: 0, notes: "" })
  const [message, setMessage] = useState("")

  const receivable = debts.data.filter((item) => item.type === "receivable").reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const payable = debts.data.filter((item) => item.type === "payable").reduce((sum, item) => sum + Number(item.balance || 0), 0)
  const pending = debts.data.filter((item) => item.status !== "paid").length

  async function createDebt(event) {
    event.preventDefault()
    await api.post("/debts", { ...form, original_amount: Number(form.original_amount) })
    setForm({ type: "receivable", counterparty: "", original_amount: 0, notes: "" })
    setMessage("Deuda registrada.")
    debts.reload()
  }

  async function addPayment(event) {
    event.preventDefault()
    await api.post(`/debts/${payment.debt_id}/payments`, { amount: Number(payment.amount), notes: payment.notes })
    setPayment({ debt_id: "", amount: 0, notes: "" })
    setMessage("Pago registrado.")
    debts.reload()
  }

  return (
    <>
      <PageHeader eyebrow="Deudas" title="Cuentas por cobrar y pagar" description="Controla quien te debe, a quien debes y los pagos parciales." />
      {message && <p className="mb-4 rounded-2xl bg-brand/50 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={CircleDollarSign} label="Me deben" value={formatMoney(receivable)} helper="Cuentas por cobrar" />
        <StatCard label="Debo" value={formatMoney(payable)} helper="Cuentas por pagar" tone="rose" />
        <StatCard label="Pendientes" value={pending} helper="Deudas abiertas o parciales" tone="amber" />
      </div>
      <section className="mb-6 grid gap-5 xl:grid-cols-2">
        <form onSubmit={createDebt} className="glass-panel rounded-[2.4rem] p-6">
          <FormTitle icon={Plus} title="Registrar deuda" text="Guarda deudas de clientes o proveedores." />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="soft-input rounded-2xl px-4 py-3">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Tipo</span>
              <select className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="receivable">Me deben</option>
                <option value="payable">Debo pagar</option>
              </select>
            </label>
            <Field label="Persona/proveedor" value={form.counterparty} onChange={(value) => setForm({ ...form, counterparty: value })} required />
            <Field label="Monto" type="number" value={form.original_amount} onChange={(value) => setForm({ ...form, original_amount: value })} />
            <Field label="Notas" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
          </div>
          <button className="pastel-button mt-4 rounded-full px-5 py-3 text-sm font-bold">Guardar deuda</button>
        </form>
        <form onSubmit={addPayment} className="glass-panel rounded-[2.4rem] p-6">
          <FormTitle icon={CircleDollarSign} title="Registrar pago" text="Reduce el saldo pendiente de una deuda." />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="soft-input rounded-2xl px-4 py-3 md:col-span-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Deuda</span>
              <select className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none" value={payment.debt_id} onChange={(event) => setPayment({ ...payment, debt_id: event.target.value })} required>
                <option value="">Seleccionar</option>
                {debts.data.filter((item) => item.status !== "paid").map((item) => <option key={item.id} value={item.id}>{item.counterparty} - {formatMoney(item.balance)}</option>)}
              </select>
            </label>
            <Field label="Monto pagado" type="number" value={payment.amount} onChange={(value) => setPayment({ ...payment, amount: value })} />
            <Field label="Notas" value={payment.notes} onChange={(value) => setPayment({ ...payment, notes: value })} />
          </div>
          <button className="pastel-button mt-4 rounded-full px-5 py-3 text-sm font-bold">Guardar pago</button>
        </form>
      </section>
      <DataTable
        columns={[
          { key: "counterparty", label: "Persona/proveedor" },
          { key: "type", label: "Tipo", render: (row) => row.type === "receivable" ? "Me deben" : "Debo" },
          { key: "original_amount", label: "Original", render: (row) => formatMoney(row.original_amount) },
          { key: "balance", label: "Saldo", render: (row) => formatMoney(row.balance) },
          { key: "status", label: "Estado", render: (row) => <StatusBadge value={row.status} /> },
          { key: "notes", label: "Notas" },
        ]}
        rows={debts.data}
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

