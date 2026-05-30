import { Link } from "react-router-dom"
import { createElement } from "react"
import { CircleDollarSign, ReceiptText, ShoppingCart } from "lucide-react"
import { demoSummary, formatMoney } from "../api"
import AlertCard from "../components/AlertCard"
import SectionHeader from "../components/SectionHeader"
import SummaryCard from "../components/SummaryCard"
import { useApiResource } from "../hooks/useApiResource"

export default function Finance() {
  const { data } = useApiResource("/dashboard/summary", demoSummary)

  return (
    <>
      <SectionHeader
        eyebrow="Finanzas"
        title="Dinero que entra, sale y queda"
        description="Accede rápido a ventas, gastos y deudas sin perder el foco en caja."
      />
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={ShoppingCart} label="Ventas" value={formatMoney(data.revenue)} helper="Ingresos acumulados" tone="success" />
        <SummaryCard icon={ReceiptText} label="Gastos" value={formatMoney(data.expenses)} helper="Egresos acumulados" tone="warning" />
        <SummaryCard icon={CircleDollarSign} label="Ganancia" value={formatMoney(data.profit)} helper="Ventas menos gastos" tone={data.profit >= 0 ? "info" : "danger"} />
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <ModuleLink to="/sales" title="Ventas" text="Revisa ingresos, unidades vendidas y origen de cada venta." icon={ShoppingCart} />
        <ModuleLink to="/expenses" title="Gastos" text="Filtra gastos, exporta CSV y revisa categorías." icon={ReceiptText} />
        <ModuleLink to="/debts" title="Deudas" text="Controla cuentas por cobrar, pagar y pagos parciales." icon={CircleDollarSign} />
      </section>
      <section className="mt-6">
        <AlertCard title="Prioridad financiera" text="Primero revisa deudas pendientes y gastos grandes. Luego compara ventas contra gastos por periodo." icon={CircleDollarSign} tone="info" />
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
