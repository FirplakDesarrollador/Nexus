import { createHash } from 'crypto'

// Fechas en texto "dd/mm/aaaa" tal como llegan en la tabla del correo.
export function ddmmyyyyToDate(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!m) return null
    const [, dd, mm, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export function parseCurrency(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string' || value.trim() === '') return null
    const cleaned = value.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '')
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? null : n
}

export function parseNumber(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string' || value.trim() === '') return null
    const cleaned = value.replace('%', '').trim()
    const n = parseFloat(cleaned)
    if (Number.isNaN(n)) return null
    // El correo trae el porcentaje como texto ("-10%"); el Excel ya lo trae como fracción (-0.1).
    return value.includes('%') ? n / 100 : n
}

// Cantidad en el correo viene en formato "1,000.00" (coma de miles, punto decimal) —
// distinto al de las columnas de moneda del mismo correo (punto de miles, sin decimales).
export function parsePlainNumber(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string' || value.trim() === '') return null
    const cleaned = value.replace(/,/g, '').trim()
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? null : n
}

export function parseText(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const s = String(value).trim()
    return s === '' ? null : s
}

// Identidad estable de una fila, sin importar si vino del Excel o del correo — permite
// reconocerla entre sincronizaciones (seguimiento de "En proceso") y evitar duplicados.
export function computeSourceKey(record: Record<string, unknown>): string {
    const baseKey = [record.fecha_correo, record.tipo_documento, record.numero_documento, record.cod_item].join('|')
    return createHash('sha256').update(baseKey).digest('hex')
}
