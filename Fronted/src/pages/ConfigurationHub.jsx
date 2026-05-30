import { Link } from "react-router-dom"
import { createElement } from "react"
import { FileText, Settings, Users } from "lucide-react"
import SectionHeader from "../components/SectionHeader"
import { getStoredSession } from "../lib/auth"

export default function ConfigurationHub() {
  const company = getStoredSession()?.user?.company

  return (
    <>
      <SectionHeader
        eyebrow="Configuracion"
        title={company?.name || "SmartConta"}
        description="Administración del negocio, trabajadores, vouchers y parámetros del workspace."
      />
      <section className="grid gap-4 lg:grid-cols-3">
        <ModuleLink to="/settings" title="Empresa" text="Ver módulos activos, tipo de negocio e integración Telegram." icon={Settings} />
        <ModuleLink to="/workers" title="Trabajadores" text="Gestionar usuarios operativos conectados por Telegram." icon={Users} />
        <ModuleLink to="/vouchers" title="Vouchers" text="Consultar imágenes recibidas y estado de validación." icon={FileText} />
      </section>
    </>
  )
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
