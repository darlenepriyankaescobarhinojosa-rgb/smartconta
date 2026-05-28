import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { BarChart3, Bell, Bot, Boxes, CircleDollarSign, FileText, LayoutDashboard, LogOut, ReceiptText, Search, Settings, ShoppingCart, Tags, Users } from "lucide-react"
import { clearSession, getStoredSession } from "../lib/auth"

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Gastos", icon: ReceiptText },
  { to: "/sales", label: "Ventas", icon: ShoppingCart },
  { to: "/workers", label: "Trabajadores", icon: Users },
  { to: "/inventory", label: "Inventario", icon: Boxes },
  { to: "/prices", label: "Precios", icon: Tags },
  { to: "/debts", label: "Deudas", icon: CircleDollarSign },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/vouchers", label: "Vouchers", icon: FileText },
  { to: "/settings", label: "Configuracion", icon: Settings },
]

export default function AppShell() {
  const navigate = useNavigate()
  const session = getStoredSession()
  const company = session?.user?.company?.name || "SmartConta"

  function logout() {
    clearSession()
    navigate("/login", { replace: true })
  }

  return (
    <div className="min-h-screen p-3 lg:grid lg:grid-cols-[304px_1fr] lg:gap-7 lg:p-6">
      <aside className="glass-panel sticky top-6 z-20 h-auto rounded-[2.4rem] px-5 py-5 lg:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-3xl bg-ink text-white shadow-lg shadow-slate-300/50">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">SmartConta AI</p>
              <h1 className="mt-1 text-xl font-semibold leading-tight text-ink">{company}</h1>
            </div>
          </div>
          <button className="rounded-2xl border border-white/70 bg-white/50 p-2 text-muted lg:hidden" onClick={logout} aria-label="Salir">
            <LogOut size={18} />
          </button>
        </div>

        <nav className="mt-7 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex min-w-fit items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold transition duration-200 ${
                  isActive
                    ? "bg-ink text-white shadow-lg shadow-slate-300/50"
                    : "text-ink/70 hover:bg-white/70 hover:text-ink"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 hidden rounded-[1.8rem] border border-white/70 bg-white/52 p-5 shadow-inner lg:block">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Telegram first</p>
          <p className="mt-3 text-[13px] leading-6 text-muted">
            Tus trabajadores reportan por chat. La IA normaliza, valida y separa datos por empresa.
          </p>
        </div>

        <button
          onClick={logout}
          className="mt-7 hidden w-full items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/56 px-3 py-3 text-sm font-semibold text-ink/70 transition hover:-translate-y-0.5 hover:bg-white lg:flex"
        >
          <LogOut size={16} />
          Salir
        </button>
      </aside>

      <main className="px-2 py-5 sm:px-4 lg:px-3">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="soft-input flex min-h-12 w-full max-w-xl items-center gap-3 rounded-full px-5 text-muted">
            <Search size={18} />
            <input className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted" placeholder="Buscar ventas, gastos, trabajadores..." />
          </label>
          <div className="flex items-center gap-3">
            <button className="flex size-12 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ink shadow-lg shadow-slate-300/30 transition hover:-translate-y-0.5 hover:bg-brand">
              <Bell size={18} />
            </button>
            <div className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-ink shadow-lg shadow-lime-200/50">
              AI listo
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
