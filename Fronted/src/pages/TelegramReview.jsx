import { AlertTriangle, Check, Eye, FileImage, Pencil, ReceiptText, X } from "lucide-react"
import { useState } from "react"
import { api, formatMoney } from "../api"
import EmptyState from "../components/EmptyState"
import LoadingSkeleton from "../components/LoadingSkeleton"
import PageHeader from "../components/PageHeader"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

export default function TelegramReview() {
  const queue = useApiResource("/telegram/review-queue", [])
  const [editing, setEditing] = useState(null)
  const [visionEditing, setVisionEditing] = useState(null)
  const [visionDrafts, setVisionDrafts] = useState({})
  const [previewImage, setPreviewImage] = useState(null)
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

  async function approveVision(item) {
    setMessage("")
    try {
      await api.post(`/telegram/review-queue/${item.id}/vision/approve`)
      setMessage("Comprobante aprobado y gasto registrado.")
      queue.reload()
    } catch (error) {
      setMessage(error.response?.data?.detail || "No se pudo aprobar el comprobante Vision.")
    }
  }

  function openVisionEdit(item) {
    const proposal = visionProposal(item, visionDrafts)
    setVisionEditing({
      item,
      supplier: proposal.supplier || "",
      date: proposal.date || "",
      total_amount: proposal.total_amount ?? "",
      items: proposal.items?.length ? proposal.items.map((product) => ({ ...product })) : [],
    })
  }

  function updateVisionItem(index, field, value) {
    setVisionEditing((current) => {
      const items = current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
      return { ...current, items }
    })
  }

  async function saveVisionDraft(event) {
    event.preventDefault()
    const payload = {
      supplier: visionEditing.supplier || null,
      date: visionEditing.date || null,
      total_amount: visionEditing.total_amount === "" ? null : Number(visionEditing.total_amount),
      currency: "PEN",
      items: visionEditing.items.map((item) => ({
        raw_name: item.raw_name || null,
        quantity: item.quantity === "" || item.quantity == null ? null : Number(item.quantity),
        unit: item.unit || null,
        unit_cost: item.unit_cost === "" || item.unit_cost == null ? null : Number(item.unit_cost),
        line_total: item.line_total === "" || item.line_total == null ? null : Number(item.line_total),
      })),
      warnings: [],
    }
    try {
      await api.post(`/telegram/review-queue/${visionEditing.item.id}/vision/corrections`, payload)
      setVisionDrafts((current) => ({ ...current, [visionEditing.item.id]: payload }))
      setVisionEditing(null)
      setMessage("Correcciones guardadas. No se aplicó ningún movimiento contable.")
      queue.reload()
    } catch (error) {
      setMessage(error.response?.data?.detail || "No se pudieron guardar las correcciones Vision.")
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
        {queue.loading && <LoadingSkeleton rows={3} />}

        {!queue.loading && queue.data.length === 0 && <EmptyState title="No hay revisiones pendientes" description="Los mensajes y comprobantes dudosos aparecerán aquí antes de registrarse." />}

        {!queue.loading && queue.data.map((item) => {
          if (isVisionItem(item)) {
            return (
              <VisionReviewCard
                key={item.id}
                item={item}
                proposal={visionProposal(item, visionDrafts)}
                onApprove={() => approveVision(item)}
                onEdit={() => openVisionEdit(item)}
                onReject={() => reject(item)}
                onPreview={setPreviewImage}
              />
            )
          }
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

      {visionEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/30 p-4">
          <form onSubmit={saveVisionDraft} className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-700">Editar comprobante</p>
                <h2 className="text-xl font-bold text-slate-900">Propuesta Vision</h2>
              </div>
              <button type="button" className="icon-action bg-slate-100 text-slate-900" onClick={() => setVisionEditing(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Proveedor" value={visionEditing.supplier} onChange={(value) => setVisionEditing({ ...visionEditing, supplier: value })} />
              <Field label="Fecha" type="date" value={visionEditing.date} onChange={(value) => setVisionEditing({ ...visionEditing, date: value })} />
              <Field label="Total" type="number" value={visionEditing.total_amount} onChange={(value) => setVisionEditing({ ...visionEditing, total_amount: value })} />
            </div>
            <div className="mt-5 space-y-3">
              <p className="text-sm font-bold text-slate-900">Productos detectados</p>
              {visionEditing.items.map((product, index) => (
                <div key={`${product.raw_name}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
                  <Field label="Producto" value={product.raw_name || ""} onChange={(value) => updateVisionItem(index, "raw_name", value)} />
                  <Field label="Cantidad" type="number" value={product.quantity ?? ""} onChange={(value) => updateVisionItem(index, "quantity", value)} />
                  <Field label="Costo" type="number" value={product.unit_cost ?? ""} onChange={(value) => updateVisionItem(index, "unit_cost", value)} />
                  <Field label="Total línea" type="number" value={product.line_total ?? ""} onChange={(value) => updateVisionItem(index, "line_total", value)} />
                </div>
              ))}
            </div>
            <button className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:w-auto">Guardar cambios en revisión</button>
          </form>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Comprobante ampliado" className="max-h-[90vh] max-w-full rounded-2xl bg-white object-contain shadow-2xl" />
        </div>
      )}
    </>
  )
}

function VisionReviewCard({ item, proposal, onApprove, onEdit, onReject, onPreview }) {
  const parsed = item.parsed_json || {}
  const ocr = parsed.ocr || {}
  const confidence = Number(proposal.confidence ?? item.confidence ?? 0)
  const warnings = visionWarnings(proposal, ocr)
  const fileUrl = parsed.file_id || parsed.file_url || parsed.voucher_file_url
  const canPreview = isImageUrl(fileUrl)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {canPreview ? (
              <button type="button" className="h-full w-full" onClick={() => onPreview(fileUrl)} aria-label="Ampliar comprobante">
                <img src={fileUrl} alt="Comprobante recibido" className="h-full max-h-[460px] w-full object-contain" />
              </button>
            ) : (
              <div className="px-5 text-center">
                <FileImage className="mx-auto text-slate-400" size={42} />
                <p className="mt-3 text-sm font-semibold text-slate-700">Foto recibida por Telegram</p>
                <p className="mt-1 break-all text-xs text-slate-500">{fileUrl || "Archivo sin referencia visible"}</p>
              </div>
            )}
          </div>
          {canPreview && (
            <button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900" onClick={() => onPreview(fileUrl)}>
              <Eye size={18} />
              Ampliar foto
            </button>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={item.status} />
            <ConfidenceBadge confidence={confidence} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Detail label="Proveedor" value={proposal.supplier || "Sin proveedor"} />
            <Detail label="Fecha" value={proposal.date || "Sin fecha"} />
            <Detail label="Total detectado" value={proposal.total_amount == null ? "Sin total" : formatMoney(proposal.total_amount)} />
            <Detail label="Moneda" value={proposal.currency || "PEN"} />
            <Detail label="Confianza OCR" value={`${Math.round(Number(ocr.confidence || 0) * 100)}%`} />
            <Detail label="Estado" value={item.status || "pending"} />
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertTriangle size={18} />
                Advertencias detectadas
              </div>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2">
              <ReceiptText size={18} className="text-blue-700" />
              <h3 className="text-base font-bold text-slate-900">Productos detectados</h3>
            </div>
            <div className="grid gap-3">
              {(proposal.items || []).length ? (
                proposal.items.map((product, index) => <VisionProductCard key={`${product.raw_name}-${index}`} product={product} />)
              ) : (
                <EmptyState title="Sin productos detectados" description="Puedes revisar el texto OCR para completar la propuesta manualmente." />
              )}
            </div>
          </div>

          <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">Ver texto OCR</summary>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{ocr.text || item.raw_text || "Sin texto OCR disponible."}</p>
          </details>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white" onClick={onApprove}>Aprobar</button>
            <button className="rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white" onClick={onEdit}>Editar</button>
            <button className="rounded-2xl bg-rose-100 px-5 py-4 text-sm font-bold text-rose-700" onClick={onReject}>Rechazar</button>
          </div>
        </div>
      </div>
    </article>
  )
}

function VisionProductCard({ product }) {
  const suggested = product.product_resolution?.product_id ? product.product_resolution?.normalized_name || product.raw_name : null
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-base font-bold text-slate-900">{product.raw_name || "Producto sin nombre"}</p>
      <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <p><span className="font-semibold text-slate-900">Cantidad:</span> {product.quantity ?? "-"} {product.unit || ""}</p>
        <p><span className="font-semibold text-slate-900">Costo:</span> {product.unit_cost == null ? "-" : formatMoney(product.unit_cost)}</p>
        <p><span className="font-semibold text-slate-900">Total:</span> {product.line_total == null ? "-" : formatMoney(product.line_total)}</p>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">Producto SmartConta:</span> {suggested || "Sin sugerencia segura"}
      </p>
    </div>
  )
}

function ConfidenceBadge({ confidence }) {
  const pct = Math.round(Number(confidence || 0) * 100)
  if (pct >= 90) return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Alta confianza {pct}%</span>
  if (pct >= 70) return <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Revisar {pct}%</span>
  return <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Baja confianza {pct}%</span>
}

function isVisionItem(item) {
  return item.decision_json?.source === "smartconta_vision" || item.parsed_json?.source === "smartconta_vision"
}

function visionProposal(item, drafts) {
  return drafts[item.id] || item.parsed_json?.proposal || {}
}

function visionWarnings(proposal, ocr) {
  const warnings = new Set([...(proposal.warnings || []), ...(ocr.warnings || [])])
  if (Number(proposal.confidence || 0) < 0.7) warnings.add("Confianza baja")
  if (!proposal.supplier) warnings.add("Proveedor no detectado")
  if (proposal.total_amount == null) warnings.add("Total no detectado")
  for (const product of proposal.items || []) {
    if (product.product_resolution?.action === "needs_review") warnings.add("Producto ambiguo")
  }
  return Array.from(warnings)
}

function isImageUrl(value) {
  return /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value || "")
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
