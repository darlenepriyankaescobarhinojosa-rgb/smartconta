export default function StatusBadge({ value }) {
  const styles = {
    active: "bg-[#D8F36B] text-ink",
    invited: "bg-[#EEF3EF] text-muted",
    disabled: "bg-[#F4F7F4] text-muted",
    pending: "bg-[#CFEF8A] text-ink",
    validated: "bg-[#D8F36B] text-ink",
    rejected: "bg-[#EEF3EF] text-muted",
    telegram: "bg-[#CFEF8A] text-ink",
    web: "bg-[#F4F7F4] text-muted",
    sale: "bg-[#D8F36B] text-ink",
    expense: "bg-[#EEF3EF] text-muted",
  }

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${styles[value] || "bg-[#F4F7F4] text-muted"}`}>
      {value}
    </span>
  )
}
