import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { EmptyState } from './primitives'
import { SearchInput } from './Form'

export function Table({ className, children }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-collapse text-left text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children }) {
  return <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">{children}</thead>
}

export function Th({ children, className, ...props }) {
  return (
    <th className={cn('whitespace-nowrap px-4 py-3 font-semibold', className)} {...props}>
      {children}
    </th>
  )
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function Tr({ children, className, ...props }) {
  return (
    <tr className={cn('transition-colors hover:bg-slate-50/70', className)} {...props}>
      {children}
    </tr>
  )
}

export function Td({ children, className, ...props }) {
  return (
    <td className={cn('px-4 py-3 align-middle text-slate-700', className)} {...props}>
      {children}
    </td>
  )
}

/**
 * DataTable — generic table with optional search, sorting and pagination.
 * columns: [{ key, header, render?, sortable?, className?, headerClassName?, sortValue? }]
 */
export function DataTable({
  columns,
  data,
  searchable = false,
  searchPlaceholder = 'Search…',
  searchKeys = [],
  pageSize = 8,
  emptyState,
  toolbar,
  onRowClick,
  rowKey = 'id',
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!query.trim()) return data
    const q = query.toLowerCase()
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key)
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q)),
    )
  }, [data, query, searchKeys, columns])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    const accessor = col?.sortValue || ((row) => row[sort.key])
    return [...filtered].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, totalPages)
  const paged = sorted.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  return (
    <div>
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {searchable ? (
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v)
                setPage(1)
              }}
              placeholder={searchPlaceholder}
              className="sm:max-w-xs"
            />
          ) : (
            <div />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <Table>
        <THead>
          <tr>
            {columns.map((col) => (
              <Th key={col.key} className={col.headerClassName}>
                {col.sortable ? (
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 transition hover:text-slate-700"
                  >
                    {col.header}
                    {sort.key === col.key ? (
                      sort.dir === 'asc' ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </Th>
            ))}
          </tr>
        </THead>
        <TBody>
          {paged.map((row, i) => (
            <Tr
              key={row[rowKey] ?? i}
              className={onRowClick ? 'cursor-pointer' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <Td key={col.key} className={col.className}>
                  {col.render ? col.render(row) : row[col.key]}
                </Td>
              ))}
            </Tr>
          ))}
        </TBody>
      </Table>

      {paged.length === 0 &&
        (emptyState || <EmptyState title="No records found" description="Try adjusting your search or filters." />)}

      {sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-slate-600">
              {current} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
