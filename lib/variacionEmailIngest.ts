import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import { getValidAccessToken } from './microsoftDelegatedAuth'
import { parseCurrency, parseNumber, parsePlainNumber, parseText, ddmmyyyyToDate, computeSourceKey } from './variacionParsers'

const NALLELY_EMAIL = 'nallely.lopera@firplak.com'
// Coincide con lo que llega reenviado por la regla de Outlook — se usa "contiene" en vez
// de igualdad exacta por si el reenvío altera ligeramente el asunto.
const SUBJECT_SEARCH = 'Variación costo mayor'

// Orden exacto de las 18 columnas que trae la tabla del correo (le faltan, respecto a la
// hoja del Excel: Fecha Correo, OBS NL, RESPONSABLE, ESTADO, Avoidance/Ahorro, SI-NO).
const EMAIL_COLUMNS = [
    'tipo_documento', 'numero_documento', 'fecha_contabilizacion',
    'cod_proveedor', 'descripcion_proveedor', 'cod_item', 'descripcion_item',
    'precio', 'precio_prom_almacen', 'diferencia_precios', 'porc_variacion',
    'penultimo_precio_prov', 'dif_vs_penultimo_precio', 'porc_vs_penultimo',
    'cantidad', 'total_linea', 'precio_lista_precios', 'numero_lista_precio'
] as const

const CURRENCY_COLUMNS = new Set([
    'precio', 'precio_prom_almacen', 'diferencia_precios', 'penultimo_precio_prov',
    'dif_vs_penultimo_precio', 'total_linea', 'precio_lista_precios'
])
const PERCENT_COLUMNS = new Set(['porc_variacion', 'porc_vs_penultimo'])

function buildSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(url, key, { db: { schema: 'nexus' } })
}

// Busca, dentro de un correo que puede traer varias tablas (firma, historial citado, etc.),
// la que tiene el encabezado esperado — no asume que es la primera tabla del documento.
function findDataTable($: cheerio.CheerioAPI): ReturnType<typeof $> | null {
    const tables = $('table').toArray()
    for (const table of tables) {
        const headerText = $(table).find('tr').first().text().toLowerCase()
        if (headerText.includes('tipo') && headerText.includes('proveedor') && headerText.includes('cod')) {
            return $(table)
        }
    }
    return null
}

function parseEmailTable(html: string): Record<string, unknown>[] {
    const $ = cheerio.load(html)
    const table = findDataTable($)
    if (!table) return []

    const rows = table.find('tr').toArray()
    const dataRows = rows.slice(1) // primera fila = encabezado

    const records: Record<string, unknown>[] = []
    for (const row of dataRows) {
        const cells = $(row).find('td').toArray().map(td => $(td).text().trim())
        if (cells.length < EMAIL_COLUMNS.length) continue // fila vacía o de otro layout

        const record: Record<string, unknown> = {}
        EMAIL_COLUMNS.forEach((col, i) => {
            const raw = cells[i]
            if (col === 'fecha_contabilizacion') record[col] = ddmmyyyyToDate(raw)
            else if (col === 'cantidad') record[col] = parsePlainNumber(raw)
            else if (CURRENCY_COLUMNS.has(col)) record[col] = parseCurrency(raw)
            else if (PERCENT_COLUMNS.has(col)) record[col] = parseNumber(raw)
            else record[col] = parseText(raw)
        })
        if (record.cod_item) records.push(record)
    }
    return records
}

export async function checkNuevosCorreos(): Promise<{ correosNuevos: number; filasInsertadas: number }> {
    const token = await getValidAccessToken(NALLELY_EMAIL)
    const supabase = buildSupabaseClient()

    const searchRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages?$search="subject:${encodeURIComponent(SUBJECT_SEARCH)}"&$select=id,subject,from,receivedDateTime,body&$top=25`,
        { headers: { Authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' } }
    )
    if (!searchRes.ok) throw new Error(`Error buscando correos: ${await searchRes.text()}`)
    const searchJson = await searchRes.json()
    const messages: any[] = searchJson.value ?? []

    if (messages.length === 0) return { correosNuevos: 0, filasInsertadas: 0 }

    const ids = messages.map(m => m.id)
    const { data: yaProcesados } = await supabase
        .from('variacion_correos_procesados')
        .select('message_id')
        .in('message_id', ids)
    const procesadosSet = new Set((yaProcesados ?? []).map(r => r.message_id))

    const nuevos = messages.filter(m => !procesadosSet.has(m.id))
    let totalFilas = 0

    for (const message of nuevos) {
        const fechaCorreo = (message.receivedDateTime as string).slice(0, 10)
        const filasCorreo = parseEmailTable(message.body?.content ?? '')

        const bySourceKey = new Map<string, Record<string, unknown>>()
        for (const fila of filasCorreo) {
            const record: Record<string, unknown> = {
                ...fila,
                fecha_correo: fechaCorreo,
                estado: 'Sin iniciar',
                obs_nl: null,
                responsable: null,
                avoidance_ahorro: null,
                si_no: null,
                origen: 'correo',
                synced_at: new Date().toISOString()
            }
            record.source_key = computeSourceKey(record)
            bySourceKey.set(record.source_key as string, record)
        }
        const registros = Array.from(bySourceKey.values())

        if (registros.length > 0) {
            const { error: upsertError } = await supabase
                .from('variacion_costos')
                .upsert(registros, { onConflict: 'source_key' })
            if (upsertError) throw new Error(`Error insertando filas del correo ${message.id}: ${upsertError.message}`)
        }

        const { error: procesadoError } = await supabase.from('variacion_correos_procesados').insert({
            message_id: message.id,
            received_at: message.receivedDateTime,
            filas_insertadas: registros.length
        })
        if (procesadoError) throw new Error(`Error registrando el correo ${message.id} como procesado: ${procesadoError.message}`)

        totalFilas += registros.length
    }

    return { correosNuevos: nuevos.length, filasInsertadas: totalFilas }
}
