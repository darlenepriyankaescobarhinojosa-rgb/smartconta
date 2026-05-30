export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase text-blue-600">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-bold leading-tight text-slate-900 md:text-4xl">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
  )
}
