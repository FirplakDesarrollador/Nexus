import { createClient } from '@supabase/supabase-js'

// Fuente real: SAP Business One (ITPLAKINFO.Firplak_SA), tablas OPDN/PDN1, filtrada a
// ItemCode NOT LIKE 'Z%' — exactamente la query "Entradas de Mercancia" que arma la
// tabla "Compras" en el Power BI "BI Compras". Expuesta por el mismo servicio que ya
// sirve /compras, detrás de un túnel de Cloudflare efímero (ver NEXUS_BI_TUNNEL_URL).

interface EntradaMercanciaApiRow {
    '#DOCUMENTO': number | string
    'FECHA CONTABILIZACION': string | null
    'GRUPO ARTICULO': string | null
    'LINEA': number | null
    'COD ARTICULO': string | null
    'DESCRIPCION': string | null
    'COD PROVEEDOR': string | null
    'PROVEEDOR': string | null
    'CANTIDAD': string | number | null
    'Unidad de Medida': string | null
    'PRECIO': string | number | null
    'TOTAL LINEA': string | number | null
}

function buildSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(url, key, { db: { schema: 'nexus' } })
}

function toNumber(value: string | number | null): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    const n = parseFloat(value)
    return Number.isNaN(n) ? null : n
}

function toDate(value: string | null): string | null {
    if (!value) return null
    return value.slice(0, 10) // "2026-09-30T00:00:00" -> "2026-09-30"
}

export async function fetchEntradasMercancia(): Promise<EntradaMercanciaApiRow[]> {
    const tunnelUrl = process.env.NEXUS_BI_TUNNEL_URL
    const apiKey = process.env.NEXUS_BI_API_KEY
    if (!tunnelUrl) throw new Error('NEXUS_BI_TUNNEL_URL no está configurado en .env')
    if (!apiKey) throw new Error('NEXUS_BI_API_KEY no está configurado en .env')

    const res = await fetch(`${tunnelUrl}/entrada_mercancia`, {
        headers: { 'api-key': apiKey }
    })
    if (!res.ok) throw new Error(`Error consultando BI (entrada_mercancia): ${res.status} ${await res.text()}`)
    const json = await res.json()
    return (json.response ?? json) as EntradaMercanciaApiRow[]
}

export async function syncEntradasMercancia(): Promise<{ filasRecibidas: number; filasSincronizadas: number }> {
    const supabase = buildSupabaseClient()
    const filas = await fetchEntradasMercancia()

    const registros = filas.map(f => ({
        documento: String(f['#DOCUMENTO']),
        linea: f['LINEA'] ?? 0,
        fecha_contabilizacion: toDate(f['FECHA CONTABILIZACION']),
        grupo_articulo: f['GRUPO ARTICULO'],
        cod_articulo: f['COD ARTICULO'],
        descripcion: f['DESCRIPCION'],
        cod_proveedor: f['COD PROVEEDOR'],
        proveedor: f['PROVEEDOR'],
        cantidad: toNumber(f['CANTIDAD']),
        unidad_medida: f['Unidad de Medida'],
        precio: toNumber(f['PRECIO']),
        total_linea: toNumber(f['TOTAL LINEA']),
        synced_at: new Date().toISOString()
    }))

    const BATCH_SIZE = 500
    let sincronizadas = 0
    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const lote = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
            .from('bi_entradas_mercancia')
            .upsert(lote, { onConflict: 'documento,linea' })
        if (error) throw new Error(`Error sincronizando lote BI (fila ${i}): ${error.message}`)
        sincronizadas += lote.length
    }

    return { filasRecibidas: filas.length, filasSincronizadas: sincronizadas }
}
