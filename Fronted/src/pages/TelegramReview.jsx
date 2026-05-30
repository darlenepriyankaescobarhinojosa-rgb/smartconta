import { Check, Pencil, X } from "lucide-react"
import { useState } from "react"
import { api, formatMoney } from "../api"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

export default function TelegramReview() {
  const queue = useApiResource("/telegram/review-queue", [])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ amount: "", product: "", category: "" })
  const [message, setMessage] = useState("")

  async function approve(item) {
    setMessage("")
    try {
      await api.post(`/telegram/review-queue/${item.id}/approve`)
      setMessage("Movimiento aprobado y guardado.")
      queue.reload()
    } catch (error) {
      setMessage(error.response?.data?.detail || "No se pudo aprobar. Corrige el monto antes de guardar.")
    }
  }

  async function reject(item) {
    setMessage("")
    try {
      await api.post(`/telegram/review-queue/${item.id}/reject`)
      setMessage("Registro rechazado.")
      queue.reload()
    } catch (error) {
      setMessage(error.response?.data?.detail || "No se pudo rechazar el registro.")
    }
  }

  function openEdit(item) {
    const parsed = item.parsed_json || {}
    setEditing(item)
    setForm({
      amount: parsed.amount ?? "",
      product: parsed.product || "",
      category: parsed.category || "",
    })
  }

  async function submitEdit(event) {
    event.preventDefault()
    const payload = {
      amount: form.amount === "" ? null : Number(form.amount),
      product: form.product || null,
      category: form.category || null,
    }
    try {
      await api.post(`/telegram/review-queue/${editing.id}/edit-and-approve`, payload)
      setEditing(null)
      setMessage("Correccion aprobada y guardada.")
      queue.reload()
    } catch (error) {
      setMessage(error.response?.data?.detail || "No se pudo guardar la correccion.")
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Telegram"
        title="Revision humana"
        description="Valida mensajes que la IA no pudo guardar con confianza suficiente."
      />

      {message && <p className="mb-4 rounded-2xl bg-brand/50 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}

      <section className="grid gap-4">
        {queue.data.length === 0 && (
          <div className="glass-panel rounded-[2.4rem] p-6 text-sm font-semibold text-muted">
            No hay mensajes pendientes de revision.
          </div>
        )}

        {queue.data.map((item) => {
          const parsed = item.parsed_json || {}
          return (
            <article key={item.id} className="glass-panel rounded-[2.4rem] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge value={item.status} />
                    <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-muted">
                      Confianza {Math.round(Number(item.confidence || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-sm font-bold text-ink">Mensaje original</p>
                  <p className="mt-1 break-words text-sm leading-6 text-muted">{item.raw_text}</p>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <Detail label="Monto" value={parsed.amount == null ? "Sin monto claro" : formatMoney(parsed.amount)} />
                    <Detail label="Producto" value={parsed.product || "No detectado"} />
                    <Detail label="Categoria" value={parsed.category || "General"} />
                    <Detail label="Tipo" value={parsed.type || "Sin tipo"} />
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button className="icon-action bg-brand text-ink disabled:cursor-not-allowed disabled:opacity-45" onClick={() => approve(item)} aria-label="Aprobar" disabled={parsed.amount == null}>
                    <Check size={18} />
                  </button>
                  <button className="icon-action bg-white text-ink" onClick={() => openEdit(item)} aria-label="Editar">
                    <Pencil size={18} />
                  </button>
                  <button className="icon-action bg-rose-100 text-rose-700" onClick={() => reject(item)} aria-label="Rechazar">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <form onSubmit={submitEdit} className="glass-panel w-full max-w-xl rounded-[2.4rem] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-ink">Editar y aprobar</h2>
              <button type="button" className="icon-action bg-white text-ink" onClick={() => setEditing(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3">
              <Field label="Monto" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required />
              <Field label="Producto" value={form.product} onChange={(value) => setForm({ ...form, product: value })} />
              <Field label="Categoria" value={form.category} onChange={(value) => setForm({ ...form, category: value })} />
            </div>
            <button className="pastel-button mt-5 rounded-2xl px-5 py-3 text-sm font-bold">Guardar correccion</button>
          </form>
        </div>
      )}
    </>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/60 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
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
