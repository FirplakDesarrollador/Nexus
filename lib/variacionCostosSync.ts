import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

// "Variacion del costo.xlsx" — sitio SharePoint "Negociacion", hoja "BD"
const DRIVE_ID = 'b!6NJx4VZLOkC1INBXc-QTpMJKfCLQ3nROht4eAt1Ijecs7lDMi_b8RIrvHaPceT1p'
const ITEM_ID = '01FFIDUVCHM32G2SHBKJEY3FD3WNOQBJSQ'
const SHEET = 'BD'
const BATCH_SIZE = 500

const COLUMNS = [
    'fecha_correo', 'tipo_documento', 'numero_documento', 'fecha_contabilizacion',
    'cod_proveedor', 'descripcion_proveedor', 'cod_item', 'descripcion_item',
    'precio', 'precio_prom_almacen', 'diferencia_precios', 'porc_variacion',
    'penultimo_precio_prov', 'dif_vs_penultimo_precio', 'porc_vs_penultimo',
    'cantidad', 'total_linea', 'precio_lista_precios', 'numero_lista_precio',
    'obs_nl', 'responsable', 'estado', 'avoidance_ahorro', 'si_no'
] as const

const DATE_COLUMNS = new Set(['fecha_correo', 'fecha_contabilizacion'])
const CURRENCY_COLUMNS = new Set([
    'precio', 'precio_prom_almacen', 'diferencia_precios', 'penultimo_precio_prov',
    'dif_vs_penultimo_precio', 'total_linea', 'precio_lista_precios'
])
const NUMBER_COLUMNS = new Set(['porc_variacion', 'porc_vs_penultimo', 'cantidad', 'avoidance_ahorro'])

async function getAccessToken(): Promise<string> {
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: 'https://graph.microsoft.com/.default'
        })
    })
    if (!res.ok) throw new Error(`Token error: ${await res.text()}`)
    const json = await res.json()
    return json.access_token
}

function excelSerialToDate(value: unknown): string | null {
    if (typeof value !== 'number') return null
    // Excel epoch: 1899-12-30 (compensa el bug del año bisiesto 1900 de Excel)
    const ms = Date.UTC(1899, 11, 30) + value * 86400000
    return new Date(ms).toISOString().slice(0, 10)
}

function parseCurrency(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string' || value.trim() === '') return null
    const cleaned = value.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '')
    const n = parseFloat(cleaned)
    return Number.isNaN(n) ? null : n
}

function parseNumber(value: unknown): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string' || value.trim() === '') return null
    const n = parseFloat(value)
    return Number.isNaN(n) ? null : n
}

function parseText(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const s = String(value).trim()
    return s === '' ? null : s
}

function rowToRecord(row: unknown[]): Record<string, unknown> {
    const record: Record<string, unknown> = {}
    COLUMNS.forEach((col, i) => {
        const raw = row[i]
        if (DATE_COLUMNS.has(col)) record[col] = excelSerialToDate(raw)
        else if (CURRENCY_COLUMNS.has(col)) record[col] = parseCurrency(raw)
        else if (NUMBER_COLUMNS.has(col)) record[col] = parseNumber(raw)
        else record[col] = parseText(raw)
    })
    return record
}

// Identidad estable entre sincronizaciones — permite reconocer la misma fila entre
// noches (para el seguimiento de casos "En proceso" que se calcula más abajo).
// El índice de ocurrencia desempata filas con exactamente las mismas claves.
function withSourceKey(records: Record<string, unknown>[]): Record<string, unknown>[] {
    const seen = new Map<string, number>()
    return records.map((record): Record<string, unknown> => {
        const baseKey = [record.fecha_correo, record.tipo_documento, record.numero_documento, record.cod_item].join('|')
        const occurrence = (seen.get(baseKey) ?? 0) + 1
        seen.set(baseKey, occurrence)
        const sourceKey = createHash('sha256').update(`${baseKey}|${occurrence}`).digest('hex')
        return { ...record, source_key: sourceKey }
    })
}

export async function runVariacionCostosSync(): Promise<{ rows: number; syncedAt: string }> {
    const token = await getAccessToken()

    const rangeRes = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook/worksheets('${SHEET}')/usedRange(valuesOnly=true)`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!rangeRes.ok) throw new Error(`Error leyendo el Excel: ${await rangeRes.text()}`)
    const rangeJson = await rangeRes.json()
    const values: unknown[][] = rangeJson.values ?? []

    const dataRows = values.slice(1) // fila 0 = encabezados
    const syncedAt = new Date().toISOString()
    const records: Record<string, unknown>[] = withSourceKey(
        dataRows
            .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
            .map(rowToRecord)
    ).map((record): Record<string, unknown> => ({ ...record, synced_at: syncedAt }))

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'nexus' } })

    // Seguimiento de casos "En proceso": cuenta sincronizaciones consecutivas que un
    // registro lleva sin cerrarse, para poder señalarlo en el dashboard como posible
    // negociación estancada (sin necesidad de análisis externo).
    const { data: previousRows, error: previousError } = await supabase
        .from('variacion_costos')
        .select('source_key, estado, revisiones_en_proceso')
    if (previousError) throw new Error(`Error leyendo estado previo: ${previousError.message}`)
    const previousBySourceKey = new Map<string, { estado: string | null; revisiones_en_proceso: number | null }>()
    for (const r of previousRows ?? []) {
        if (r.source_key) previousBySourceKey.set(r.source_key, { estado: r.estado, revisiones_en_proceso: r.revisiones_en_proceso })
    }

    const recordsConSeguimiento = records.map(record => {
        const anterior = previousBySourceKey.get(record.source_key as string)
        const sigueEnProceso = record.estado === 'En proceso'
        const veniaEnProceso = anterior?.estado === 'En proceso'
        const revisionesEnProceso = sigueEnProceso
            ? (veniaEnProceso ? (anterior?.revisiones_en_proceso || 0) + 1 : 1)
            : 0
        return { ...record, revisiones_en_proceso: revisionesEnProceso }
    })

    // Upsert por source_key (no truncate+insert): preserva id/first_seen_at entre noches.
    for (let i = 0; i < recordsConSeguimiento.length; i += BATCH_SIZE) {
        const batch = recordsConSeguimiento.slice(i, i + BATCH_SIZE)
        const { error: upsertError } = await supabase
            .from('variacion_costos')
            .upsert(batch, { onConflict: 'source_key' })
        if (upsertError) throw new Error(`Error sincronizando fila ${i}: ${upsertError.message}`)
    }

    return { rows: recordsConSeguimiento.length, syncedAt }
}
