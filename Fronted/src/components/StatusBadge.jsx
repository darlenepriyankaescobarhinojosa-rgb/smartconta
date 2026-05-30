export default function StatusBadge({ value }) {
  const styles = {
    active: "bg-emerald-50 text-[#16A34A]",
    invited: "bg-blue-50 text-[#0284C7]",
    disabled: "bg-slate-100 text-slate-500",
    pending: "bg-violet-50 text-[#7C3AED]",
    approved: "bg-emerald-50 text-[#16A34A]",
    corrected: "bg-blue-50 text-[#0284C7]",
    validated: "bg-emerald-50 text-[#16A34A]",
    rejected: "bg-red-50 text-[#DC2626]",
    telegram: "bg-violet-50 text-[#7C3AED]",
    telegram_review: "bg-violet-50 text-[#7C3AED]",
    web: "bg-slate-100 text-slate-600",
    sale: "bg-emerald-50 text-[#16A34A]",
    expense: "bg-amber-50 text-[#F59E0B]",
    stock: "bg-blue-50 text-[#2563EB]",
    entry: "bg-emerald-50 text-[#16A34A]",
    adjustment: "bg-blue-50 text-[#0284C7]",
    loss: "bg-red-50 text-[#DC2626]",
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[value] || "bg-slate-100 text-slate-600"}`}>
      {value}
    </span>
  )
}
