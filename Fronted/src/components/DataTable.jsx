export default function DataTable({ columns, rows, empty = "Sin datos todavia" }) {
  return (
    <div className="glass-panel overflow-hidden rounded-[2rem]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/58 text-[11px] uppercase tracking-[0.18em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-4 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id || index} className="table-row">
                  {columns.map((column) => (
                    <td key={column.key} className="px-5 py-5 text-[14px] font-medium text-ink/88">
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
