import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bot, Building2, Lock, Mail } from "lucide-react"
import { api } from "../api"
import { storeSession } from "../lib/auth"

const BUSINESS_TYPES = [
  { value: "food_production", label: "Produccion de alimentos" },
  { value: "retail", label: "Tienda / retail" },
  { value: "distribution", label: "Distribuidora" },
  { value: "services", label: "Servicios" },
  { value: "other", label: "Otro" },
]

const MODULES = [
  { value: "sales", label: "Ventas" },
  { value: "expenses", label: "Gastos" },
  { value: "inventory", label: "Inventario" },
  { value: "debts", label: "Deudas" },
  { value: "production", label: "Produccion" },
  { value: "vouchers", label: "Vouchers" },
]

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState({
    company_name: "Quesos Marlene",
    industry: "Alimentos",
    name: "Marlene Admin",
    email: "admin@smartconta.pe",
    password: "smartconta123",
    business_type: "food_production",
    enabled_modules: ["sales", "expenses", "inventory", "production", "vouchers"],
  })
  const [error, setError] = useState("")

  async function submit(event) {
    event.preventDefault()
    setError("")
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register"
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form
      const { data } = await api.post(path, payload)
      storeSession(data)
      navigate("/", { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo iniciar sesion")
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="max-w-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-3xl bg-ink text-white shadow-lg shadow-slate-300/50">
              <Bot size={24} />
            </div>
            <div>
              <p className="text-sm text-muted">SmartConta AI</p>
              <h1 className="text-xl font-semibold text-ink">Contabilidad por Telegram</h1>
            </div>
          </div>
          <h2 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            La operacion diaria convertida en datos limpios.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted">
            Trabajadores escriben mensajes normales. SmartConta extrae ventas, gastos, productos y vouchers para cada empresa sin mezclar informacion entre clientes.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Multiempresa", "IA + OCR", "Dashboard SaaS"].map((item) => (
              <div key={item} className="rounded-[1.5rem] border border-white/70 bg-white/54 p-4 text-sm font-medium text-ink shadow-lg shadow-slate-300/20">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="glass-panel w-full max-w-md rounded-[2rem] p-6">
          <div className="mb-6 flex rounded-full bg-white/48 p-1 shadow-inner">
            <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${mode === "login" ? "bg-ink text-white shadow-lg shadow-slate-300/40" : "text-muted"}`}>
              Login
            </button>
            <button type="button" onClick={() => setMode("register")} className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold transition ${mode === "register" ? "bg-ink text-white shadow-lg shadow-slate-300/40" : "text-muted"}`}>
              Crear empresa
            </button>
          </div>

          {mode === "register" && (
            <>
              <Field icon={Building2} label="Empresa" value={form.company_name} onChange={(value) => setForm({ ...form, company_name: value })} />
              <Field label="Industria" value={form.industry} onChange={(value) => setForm({ ...form, industry: value })} />
              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-ink/70">Tipo de negocio</span>
                <span className="soft-input flex items-center rounded-2xl px-4">
                  <select
                    className="min-h-12 w-full bg-transparent text-sm text-ink outline-none"
                    value={form.business_type}
                    onChange={(event) => setForm({ ...form, business_type: event.target.value })}
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <div className="mb-4">
                <span className="mb-2 block text-sm font-medium text-ink/70">Modulos activos</span>
                <div className="grid grid-cols-2 gap-2">
                  {MODULES.map((module) => {
                    const active = form.enabled_modules.includes(module.value)
                    return (
                      <button
                        key={module.value}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            enabled_modules: active
                              ? form.enabled_modules.filter((item) => item !== module.value)
                              : [...form.enabled_modules, module.value],
                          })
                        }
                        className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                          active ? "border-brand bg-brand text-ink" : "border-white/80 bg-white/60 text-muted"
                        }`}
                      >
                        {module.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <Field label="Administrador" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            </>
          )}
          <Field icon={Mail} label="Gmail / email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Field icon={Lock} label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          {error && <p className="mb-4 rounded-2xl border border-[#f0dbe1] bg-[#fff6f8] px-4 py-3 text-sm text-[#9a6675]">{error}</p>}
          <button className="pastel-button w-full rounded-full px-4 py-3 font-semibold transition">
            {mode === "login" ? "Entrar al dashboard" : "Crear workspace"}
          </button>
        </form>
      </section>
    </main>
  )
}

function Field({ label, value, onChange, type = "text", icon: Icon }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-medium text-ink/70">{label}</span>
      <span className="soft-input flex items-center gap-2 rounded-2xl px-4 focus-within:border-brand">
        {Icon && <Icon size={17} className="text-muted" />}
        <input
          className="min-h-12 w-full bg-transparent text-sm text-ink outline-none"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  )
}
