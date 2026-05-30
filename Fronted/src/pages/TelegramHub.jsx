import { Link } from "react-router-dom"
import { createElement } from "react"
import { AlertTriangle, CheckCircle2, MessageSquareText, Percent, Send, UserCheck, Users, XCircle } from "lucide-react"
import AlertCard from "../components/AlertCard"
import SectionHeader from "../components/SectionHeader"
import SummaryCard from "../components/SummaryCard"
import { useApiResource } from "../hooks/useApiResource"

export default function TelegramHub() {
  const queue = useApiResource("/telegram/review-queue", [])
  const vouchers = useApiResource("/vouchers", [])
  const workers = useApiResource("/workers", [])
  const activeWorkers = workers.data.filter((item) => item.status === "active").length
  const visionItems = queue.data.filter(isVisionItem)
  const pendingVouchers = vouchers.data.filter((item) => item.status === "pending").length || visionItems.length
  const approvedVouchers = vouchers.data.filter((item) => item.status === "validated").length
  const rejectedVouchers = vouchers.data.filter((item) => item.status === "rejected").length
  const averageConfidence = visionItems.length
    ? Math.round((visionItems.reduce((sum, item) => sum + visionConfidence(item), 0) / visionItems.length) * 100)
    : 0
  const attention = visionAttention(visionItems)

  return (
    <>
      <SectionHeader
        eyebrow="Telegram"
        title="Mensajes operativos del negocio"
        description="Revisa lo que la IA no pudo guardar con seguridad y administra trabajadores conectados."
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={UserCheck} label="Vouchers pendientes" value={pendingVouchers} helper="Comprobantes por revisar" tone={pendingVouchers ? "pending" : "success"} />
        <SummaryCard icon={CheckCircle2} label="Vouchers aprobados" value={approvedVouchers} helper="Validados" tone="success" />
        <SummaryCard icon={XCircle} label="Vouchers rechazados" value={rejectedVouchers} helper="Descartados" tone={rejectedVouchers ? "danger" : "info"} />
        <SummaryCard icon={Percent} label="Confianza promedio" value={`${averageConfidence}%`} helper="Propuestas Vision pendientes" tone={averageConfidence >= 80 ? "success" : averageConfidence >= 70 ? "warning" : "danger"} />
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <SummaryCard icon={MessageSquareText} label="Mensajes pendientes" value={queue.data.length} helper="Todos los tipos de revisión" tone={queue.data.length ? "pending" : "success"} />
        <SummaryCard icon={Users} label="Trabajadores activos" value={activeWorkers} helper={`${workers.data.length} registrados`} tone="info" />
        <SummaryCard icon={MessageSquareText} label="Canal" value="Telegram" helper="Entrada principal de datos" tone="info" />
      </section>
      <section className="mt-6">
        <AlertCard
          title="Necesita atención"
          text={attention.length ? attention.join(" · ") : "No hay comprobantes Vision con señales críticas en este momento."}
          icon={AlertTriangle}
          tone={attention.length ? "warning" : "success"}
        />
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ModuleLink to="/revisar-telegram" title="Revisión Telegram" text="Revisar comprobantes Vision y mensajes ambiguos antes de registrar cualquier dato." icon={UserCheck} />
        <ModuleLink to="/workers" title="Trabajadores" text="Crear invitaciones, reiniciar conexión y desactivar usuarios operativos." icon={Send} />
      </section>
      <section className="mt-6">
        <AlertCard title="Regla de seguridad" text="Los mensajes dudosos no se registran automáticamente. Pasan por confirmación o revisión humana." icon={MessageSquareText} tone="pending" />
      </section>
    </>
  )
}

function isVisionItem(item) {
  return item.decision_json?.source === "smartconta_vision" || item.parsed_json?.source === "smartconta_vision"
}

function visionConfidence(item) {
  return Number(item.parsed_json?.proposal?.confidence ?? item.confidence ?? 0)
}

function visionAttention(items) {
  const lowConfidence = items.filter((item) => visionConfidence(item) < 0.7).length
  const withoutSupplier = items.filter((item) => !item.parsed_json?.proposal?.supplier).length
  const withoutTotal = items.filter((item) => item.parsed_json?.proposal?.total_amount == null).length
  return [
    lowConfidence ? `${lowConfidence} vouchers con baja confianza` : null,
    withoutSupplier ? `${withoutSupplier} vouchers sin proveedor` : null,
    withoutTotal ? `${withoutTotal} vouchers sin total detectado` : null,
  ].filter(Boolean)
}

function ModuleLink({ to, title, text, icon: Icon }) {
  return (
    <Link to={to} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {createElement(Icon, { size: 20 })}
      </span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </Link>
  )
}
