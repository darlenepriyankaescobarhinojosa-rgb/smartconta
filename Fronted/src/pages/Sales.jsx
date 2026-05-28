import { PackageCheck, Plus, ShoppingCart } from "lucide-react"
import { formatMoney } from "../api"
import DataTable from "../components/DataTable"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { useApiResource } from "../hooks/useApiResource"

const fallback = []

export default function Sales() {
  const { data } = useApiResource("/sales", fallback)
  const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const units = data.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  return (
    <>
      <PageHeader
        eyebrow="Ingresos"
        title="Ventas"
        description="Ventas extraidas de lenguaje natural y conectadas con inventario."
        action={<button className="pastel-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition"><Plus size={16} /> Nueva venta</button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard icon={ShoppingCart} label="Total ventas" value={formatMoney(total)} helper="Periodo actual" />
        <StatCard icon={PackageCheck} label="Unidades vendidas" value={units} helper="Stock descontado automaticamente" tone="cyan" />
        <StatCard label="Ticket promedio" value={formatMoney(total / Math.max(data.length, 1))} helper="Por registro" tone="amber" />
      </div>
      <DataTable
        columns={[
          { key: "description", label: "Venta" },
          { key: "quantity", label: "Cantidad" },
          { key: "amount", label: "Monto", render: (row) => formatMoney(row.amount) },
          { key: "source", label: "Origen", render: (row) => <StatusBadge value={row.source} /> },
          { key: "occurred_on", label: "Fecha" },
        ]}
        rows={data}
      />
    </>
  )
}
