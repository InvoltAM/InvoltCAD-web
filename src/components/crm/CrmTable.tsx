'use client'

import { ReactNode } from 'react'

interface CrmTableColumn<T> {
  key: string
  title: string
  width?: string
  render: (item: T, index: number) => ReactNode
}

interface CrmTableProps<T> {
  columns: CrmTableColumn<T>[]
  data: T[]
  onRowClick?: (item: T) => void
  loading?: boolean
  empty?: ReactNode
}

export default function CrmTable<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  loading,
  empty,
}: CrmTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-crm-bg-secondary border border-crm-border rounded-lg p-8 text-center">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    )
  }

  if (data.length === 0 && empty) {
    return <div className="bg-crm-bg-secondary border border-crm-border rounded-lg">{empty}</div>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-crm-border bg-crm-bg-secondary shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-crm-bg-tertiary">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-5 py-2.5 text-[12px] font-semibold text-crm-text-muted uppercase tracking-wider"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-crm-border">
            {data.map((item, index) => (
              <tr
                key={item.id ?? index}
                onClick={() => onRowClick?.(item)}
                className={`group ${onRowClick ? 'cursor-pointer hover:bg-crm-bg-tertiary/30' : ''} transition-colors`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-3 align-middle">
                    {col.render(item, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
