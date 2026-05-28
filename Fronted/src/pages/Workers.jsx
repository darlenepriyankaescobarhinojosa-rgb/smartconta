import { Copy, Plus, RefreshCw, Send, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { api } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

const fallback = []
const BOT_LINK = import.meta.env.VITE_TELEGRAM_BOT_LINK || "https://t.me/smartconta_empresa_bot"

export default function Workers() {
  const { data, error, reload } = useApiResource("/workers", fallback)
  const [form, setForm] = useState({ name: "", phone: "" })
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState("")

  async function createWorker(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setMessage("Escribe el nombre del trabajador.")
      return
    }
    setCreating(true)
    setMessage("")
    try {
      const { data: worker } = await api.post("/workers", form)
      setForm({ name: "", phone: "" })
      setMessage(`Trabajador creado. Codigo: ${worker.invite_code}`)
      await reload()
    } catch (err) {
      setMessage(err.response?.data?.detail || "No se pudo crear el trabajador.")
    } finally {
      setCreating(false)
    }
  }

  async function copyInvite(row) {
    const text = `Hola ${row.name}. Entra al bot de SmartConta:\n${BOT_LINK}\n\nLuego escribe:\n/start ${row.invite_code}\n\nDespues podras reportar ventas, gastos y vouchers por Telegram.`
    await navigator.clipboard.writeText(text)
    setMessage("Mensaje de invitacion copiado.")
  }

  async function resetWorker(row) {
    try {
      const { data: worker } = await api.post(`/workers/${row.id}/reactivate`)
      await reload()
      setMessage(`Conexion reiniciada. Nuevo codigo para ${worker.name}: ${worker.invite_code}`)
    } catch (err) {
      setMessage(err.response?.data?.detail || "No se pudo reiniciar la conexion.")
    }
  }

  async function disableWorker(row) {
    try {
      await api.delete(`/workers/${row.id}`)
      await reload()
      setMessage(`${row.name} fue desactivado.`)
    } catch (err) {
      setMessage(err.response?.data?.detail || "No se pudo desactivar el trabajador.")
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Equipo operativo"
        title="Trabajadores"
        description="Cada trabajador se asocia a una empresa mediante codigo de invitacion y reporta solo por Telegram."
        action={<span className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-muted">Bot: {BOT_LINK.replace("https://t.me/", "@")}</span>}
      />
      {error && <p className="mb-4 rounded-2xl border border-[#CFEF8A] bg-white/70 px-4 py-3 text-sm text-muted">{error}</p>}
      {message && <p className="mb-4 rounded-2xl border border-white/80 bg-brand/40 px-4 py-3 text-sm font-semibold text-ink">{message}</p>}

      <form onSubmit={createWorker} className="glass-panel mb-6 rounded-[2.4rem] p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-ink">
            <Plus size={18} />
          </span>
          <div>
            <h3 className="text-2xl font-semibold text-ink">Crear trabajador</h3>
            <p className="mt-1 text-sm text-muted">El sistema generara un codigo unico para conectar Telegram con esta empresa.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="soft-input rounded-2xl px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Nombre</span>
            <input
              className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="Ej. Juan Perez"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label className="soft-input rounded-2xl px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Telefono</span>
            <input
              className="mt-1 w-full bg-transparent text-sm font-semibold text-ink outline-none"
              placeholder="+51 999 999 999"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>
          <button className="pastel-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition" disabled={creating}>
            <Send size={16} />
            {creating ? "Creando..." : "Crear"}
          </button>
        </div>
      </form>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Trabajadores" value={data.length} helper="Cuentas operativas" />
        <StatCard label="Activos" value={data.filter((item) => item.status === "active").length} helper="Telegram conectado" tone="cyan" />
        <StatCard label="Invitados" value={data.filter((item) => item.status === "invited").length} helper="Pendientes de /start" tone="amber" />
      </div>
      <DataTable
        columns={[
          { key: "name", label: "Nombre" },
          { key: "phone", label: "Telefono" },
          { key: "status", label: "Estado", render: (row) => <StatusBadge value={row.status} /> },
          {
            key: "invite_code",
            label: "Codigo",
            render: (row) => (
              <button onClick={() => copyInvite(row)} className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 font-mono text-xs text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-brand">
                {row.invite_code}
                <Copy size={13} className="text-muted" />
              </button>
            ),
          },
          {
            key: "actions",
            label: "Acciones",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => resetWorker(row)}
                  className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-brand disabled:opacity-50"
                >
                  <RefreshCw size={13} className="text-muted" />
                  Reiniciar
                </button>
                <button
                  onClick={() => disableWorker(row)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#f0dbe1] bg-[#fff6f8] px-3 py-1 text-xs font-semibold text-[#9a6675] shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                  disabled={row.status === "disabled"}
                >
                  <Trash2 size={13} />
                  Desactivar
                </button>
              </div>
            ),
          },
        ]}
        rows={data}
      />
    </>
  )
}
