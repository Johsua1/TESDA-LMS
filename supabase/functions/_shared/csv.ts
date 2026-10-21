// ===========================================================================
// CSV helpers for the trainer-feedback export.
//
// Kept dependency-free and Deno-free so they can be unit-tested with Node's
// type stripping (see scripts/test-backend.mjs).
// ===========================================================================

export const CSV_BOM = '\uFEFF'

/**
 * Escape one CSV cell.
 *
 *  - Always quote, so commas, quotes and line breaks survive.
 *  - Double embedded quotes.
 *  - Strip NUL (some spreadsheet importers truncate at it).
 *  - Prefix a single quote when the value could be interpreted as a formula
 *    (=, +, -, @, tab, CR). Excel/Sheets evaluate those even inside quotes.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""'

  let text = value instanceof Date ? value.toISOString() : String(value)
  text = text.replace(/\u0000/g, '')

  const probe = text.replace(/^[\s\uFEFF]+/, '')
  if (/^[=+\-@\t\r]/.test(probe)) {
    text = "'" + text
  }

  return '"' + text.replace(/"/g, '""') + '"'
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

export interface CsvColumn<T> {
  header: string
  value: (row: T) => unknown
}

/** Build a CRLF CSV (RFC 4180) with a UTF-8 BOM for Excel. */
export function buildCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [csvRow(columns.map((c) => c.header))]
  for (const row of rows) {
    lines.push(csvRow(columns.map((c) => c.value(row))))
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}
