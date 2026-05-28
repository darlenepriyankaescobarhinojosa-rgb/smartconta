import { Building2, KeyRound, Send, Shield } from "lucide-react"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import { getStoredSession } from "../lib/auth"

const MODULE_LABELS = {
  sales: "Ventas",
  expenses: "Gastos",
  inventory: "Inventario",
  debts: "Deudas",
  production: "Produccion",
  vouchers: "Vouchers",
}

const BUSINESS_LABELS = {
  food_production: "Produccion de alimentos",
  retail: "Tienda / retail",
  distribution: "Distribuidora",
  services: "Servicios",
  other: "Otro",
}

export default function Settings() {
  const company = getStoredSession()?.user?.company

  return (
    <>
      <PageHeader
        eyebrow="Administracion SaaS"
        title="Configuracion"
        description="Parametros de empresa, integraciones y seguridad multi-tenant."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Empresa" value={company?.name || "SmartConta"} helper={company?.industry || "Industria no definida"} />
        <StatCard label="Tipo" value={BUSINESS_LABELS[company?.business_type] || "No definido"} helper="Contexto que usa el bot para interpretar mensajes" tone="amber" />
        <StatCard icon={Shield} label="Aislamiento" value="company_id" helper="Filtro obligatorio en API y DB" tone="cyan" />
        <StatCard icon={Send} label="Telegram" value="Webhook" helper="/telegram/webhook" tone="amber" />
        <StatCard icon={KeyRound} label="OpenAI" value="API Key" helper="Configurable por entorno" />
      </div>
      <section className="glass-panel mt-6 rounded-[2rem] p-5">
        <h3 className="text-lg font-semibold text-ink">Modulos activos</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          SmartConta usa estos modulos para decidir que pantallas, reportes y reglas debe usar cada empresa.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(company?.enabled_modules || []).map((module) => (
            <span key={module} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-ink">
              {MODULE_LABELS[module] || module}
            </span>
          ))}
        </div>
      </section>
      <section className="glass-panel mt-6 rounded-[2rem] p-5">
        <h3 className="text-lg font-semibold text-ink">Flujo recomendado</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {["Crear empresa", "Invitar trabajadores", "Conectar Telegram", "Revisar dashboard"].map((step, index) => (
            <div key={step} className="rounded-[1.5rem] border border-white/70 bg-white/54 p-4 shadow-lg shadow-slate-300/20">
              <span className="text-xs font-semibold text-muted">Paso {index + 1}</span>
              <p className="mt-2 text-sm font-medium text-ink">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
