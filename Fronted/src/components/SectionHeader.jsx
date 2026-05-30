export default function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>}
        <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
