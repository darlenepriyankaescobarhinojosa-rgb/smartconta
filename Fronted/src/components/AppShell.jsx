import { createElement } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { BarChart3, Bot, Boxes, CircleDollarSign, LayoutDashboard, LogOut, MessageSquareText, Settings } from "lucide-react"
import { clearSession, getStoredSession } from "../lib/auth"
import MobileBottomNav from "./MobileBottomNav"

const links = [
  { to: "/", label: "Resumen", icon: LayoutDashboard },
  { to: "/finanzas", label: "Finanzas", icon: CircleDollarSign },
  { to: "/productos", label: "Productos", icon: Boxes },
  { to: "/telegram", label: "Telegram", icon: MessageSquareText },
  { to: "/reports", label: "Reportes", icon: BarChart3 },
  { to: "/configuracion", label: "Configuracion", icon: Settings },
]

const mobileLinks = [
  { to: "/", label: "Resumen", icon: LayoutDashboard },
  { to: "/productos", label: "Productos", icon: Boxes },
  { to: "/telegram", label: "Telegram", icon: MessageSquareText },
  { to: "/finanzas", label: "Finanzas", icon: CircleDollarSign },
  { to: "/configuracion", label: "Mas", icon: Settings },
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
    <div className="min-h-screen bg-slate-50 pb-24 lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 lg:p-5 lg:pb-5">
      <aside className="hidden border-r border-slate-200 bg-white px-5 py-5 lg:sticky lg:top-0 lg:block lg:h-[calc(100vh-2.5rem)] lg:rounded-3xl lg:border lg:shadow-sm">
        <div className="flex items-center justify-between lg:block">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-blue-600">SmartConta AI</p>
              <h1 className="mt-1 text-lg font-bold leading-tight text-slate-900">{company}</h1>
            </div>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-[14px] font-semibold transition duration-200 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              {createElement(link.icon, { size: 18 })}
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-bold uppercase text-blue-700">Decision panel</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Revisa ganancias, productos críticos y mensajes pendientes antes de operar.
          </p>
        </div>

        <button
          onClick={logout}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut size={16} />
          Cerrar sesion
        </button>
      </aside>

      <main className="px-4 py-5 sm:px-6 lg:px-0 lg:py-1">
        <header className="mb-5 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-blue-600">SmartConta</p>
              <p className="text-sm font-semibold text-slate-900">{company}</p>
            </div>
          </div>
          <button onClick={logout} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600" aria-label="Cerrar sesion">
            <LogOut size={18} />
          </button>
        </header>
        <Outlet />
      </main>
      <MobileBottomNav links={mobileLinks} />
    </div>
  )
}
