export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="mb-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">{eyebrow}</p>}
        <h2 className="mt-3 text-4xl font-semibold leading-[1.02] text-ink md:text-5xl">{title}</h2>
        {description && <p className="mt-4 max-w-3xl text-[15px] leading-7 text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}
