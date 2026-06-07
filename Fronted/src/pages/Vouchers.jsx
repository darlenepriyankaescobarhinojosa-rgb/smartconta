import { FileText, ShieldCheck } from "lucide-react"
import DataTable from "../components/DataTable"
import EmptyState from "../components/EmptyState"
import LoadingSkeleton from "../components/LoadingSkeleton"
import PageHeader from "../components/PageHeader"
import StatCard from "../components/StatCard"
import StatusBadge from "../components/StatusBadge"
import { formatMoney } from "../api"
import { useApiResource } from "../hooks/useApiResource"

const fallback = []

export default function Vouchers() {
  const { data, loading } = useApiResource("/vouchers", fallback)

  return (
    <>
      <PageHeader
        eyebrow="Auditoria"
        title="Vouchers"
        description="Imagenes recibidas por Telegram con OCR, monto detectado y estado de validacion."
      />
      {loading ? (
        <div className="grid gap-4">
          <LoadingSkeleton rows={3} />
          <LoadingSkeleton rows={5} />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <StatCard icon={FileText} label="Vouchers" value={data.length} helper="Recibidos" />
            <StatCard icon={ShieldCheck} label="Validados" value={data.filter((item) => item.status === "validated").length} helper="OCR consistente" />
            <StatCard label="Pendientes" value={data.filter((item) => item.status === "pending").length} helper="Revision requerida" tone="amber" />
          </div>
          {data.length === 0 ? (
            <EmptyState title="No hay vouchers registrados todavía." description="Los comprobantes recibidos por Telegram aparecerán aquí con su OCR y estado." />
          ) : (
            <DataTable
              columns={[
                { key: "file_url", label: "Archivo" },
                { key: "detected_amount", label: "Monto OCR", render: (row) => formatMoney(row.detected_amount) },
                { key: "status", label: "Estado", render: (row) => <StatusBadge value={row.status} /> },
                { key: "validation_notes", label: "Notas" },
                { key: "created_at", label: "Fecha" },
              ]}
              rows={data}
            />
          )}
        </>
      )}
    </>
  )
}
