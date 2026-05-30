export default function DataTable({ columns, rows, empty = "Sin datos todavia" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="block lg:hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">{empty}</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map((row, index) => (
              <article key={row.id || index} className="space-y-2 p-4">
                {columns.slice(0, 5).map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-4 text-sm">
                    <span className="shrink-0 font-semibold text-slate-500">{column.label}</span>
                    <span className="min-w-0 text-right font-medium text-slate-900">{column.render ? column.render(row) : row[column.key]}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-4 font-bold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id || index} className="table-row">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-5 text-[14px] font-medium text-slate-700">
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
