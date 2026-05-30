import { createElement } from "react"
import { NavLink } from "react-router-dom"

export default function MobileBottomNav({ links }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-2 pt-1 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold ${
                isActive ? "bg-blue-50 text-blue-700" : "text-slate-500"
              }`
            }
          >
            {createElement(link.icon, { size: 18 })}
            <span className="truncate">{link.mobileLabel || link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
