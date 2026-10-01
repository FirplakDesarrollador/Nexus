import { createClient } from '@supabase/supabase-js'

type SupabaseNexusClient = ReturnType<typeof buildSupabaseClient>

// Palabras clave para identificar materiales tipo tablero — configurable/ampliable
// (sección 10 del documento de requerimientos). "TABLERO" ya cubre las demás por
// substring, pero se dejan explícitas para que sea obvio qué se está buscando.
const TABLERO_KEYWORDS = ['TABLERO MDF', 'TABLERO RH', 'TABLERO MDP', 'TABLERO MELAMÍNICO', 'TABLERO']

// Tolerancia conservadora para considerar equivalentes un precio de SAP y uno del BI
// (redondeo/decimales, no para ocultar un cambio real). Ajustable con casos reales.
const BI_TOLERANCIA_RELATIVA = 0.005 // 0.5%
const BI_TOLERANCIA_ABSOLUTA = 1 // $1

export const ENTRADA_MERCANCIA = 'Entrada de Mercacía' // sic — typo ya existente en producción
const ORDEN_COMPRA = 'Orden de Compra'
const PRECIOS_DE_ENTREGA = 'Precios de Entrega' // lista de precios de proveedores del exterior, no es una compra real

const PRIORIDAD_ALTA_UMBRAL = 1_000_000
const PRIORIDAD_MEDIA_UMBRAL = 300_000

interface VariacionRow {
    id: string
    fecha_correo: string | null
    tipo_documento: string | null
    cod_proveedor: string | null
    descripcion_proveedor: string | null
    cod_item: string | null
    descripcion_item: string | null
    precio: number | null
    penultimo_precio_prov: number | null
    total_linea: number | null
    estado: string | null
}

interface BiRow {
    cod_proveedor: string | null
    cod_articulo: string | null
    precio: number | null
    fecha_contabilizacion: string | null
}

interface ClasificacionResultado {
    id: string
    estado: 'Finalizado' | 'Pendiente' | 'No aplica'
    observacion: string
    prioridad: 'Alta' | 'Media' | 'Baja' | null
    motivo_alerta: string | null
    ultimo_costo_historico: number | null
    fecha_ultimo_costo_historico: string | null
    origen_cierre: 'auto_mismo_costo' | 'auto_penultimo' | 'auto_bi' | 'auto_material_nuevo' | 'auto_excluido' | null
    bi_consultado: boolean
    bi_resultado: string | null
    regla_aplicada: string
    cod_proveedor: string | null
    cod_item: string | null
    estado_previo: string | null
}

function buildSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(url, key, { db: { schema: 'nexus' } })
}

// El cliente de Supabase pagina a 1000 filas por defecto — hay que recorrer todo.
async function fetchAll<T>(supabase: SupabaseNexusClient, table: string, columns: string): Promise<T[]> {
    const PAGE = 1000
    let from = 0
    const all: T[] = []
    while (true) {
        const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE - 1)
        if (error) throw new Error(`Error leyendo ${table}: ${error.message}`)
        if (!data || data.length === 0) break
        all.push(...(data as unknown as T[]))
        if (data.length < PAGE) break
        from += PAGE
    }
    return all
}

function esFocolsaOEstiba(descripcionProveedor: string | null, descripcionItem: string | null): boolean {
    const prov = (descripcionProveedor ?? '').toUpperCase()
    const item = (descripcionItem ?? '').toUpperCase()
    return prov.includes('FOCOLSA') || item.includes('ESTIBA')
}

function esTablero(descripcionItem: string | null): boolean {
    const item = (descripcionItem ?? '').toUpperCase()
    return TABLERO_KEYWORDS.some(k => item.includes(k))
}

function sonPreciosEquivalentes(a: number, b: number): boolean {
    if (a === b) return true
    const diff = Math.abs(a - b)
    if (diff <= BI_TOLERANCIA_ABSOLUTA) return true
    const base = Math.max(Math.abs(a), Math.abs(b), 1)
    return diff / base <= BI_TOLERANCIA_RELATIVA
}

function claveProveedorItem(codProveedor: string | null, codItem: string | null): string {
    return `${codProveedor ?? ''}::${codItem ?? ''}`
}

function fmt(n: number): string {
    return `$${Math.round(n).toLocaleString('es-CO')}`
}

export async function ejecutarPreanalisis(): Promise<{ runId: string; resumen: Record<string, number> }> {
    const supabase = buildSupabaseClient()
    const iniciadoEn = new Date().toISOString()

    const { data: run, error: runError } = await supabase
        .from('variacion_analisis_runs')
        .insert({ iniciado_en: iniciadoEn })
        .select('id')
        .single()
    if (runError || !run) throw new Error(`No se pudo crear el run de preanálisis: ${runError?.message}`)
    const runId = run.id as string

    try {
        const [todasLasFilas, biRowsRaw] = await Promise.all([
            fetchAll<VariacionRow>(
                supabase, 'variacion_costos',
                'id, fecha_correo, tipo_documento, cod_proveedor, descripcion_proveedor, cod_item, descripcion_item, precio, penultimo_precio_prov, total_linea, estado'
            ),
            fetchAll<BiRow>(supabase, 'bi_entradas_mercancia', 'cod_proveedor, cod_articulo, precio, fecha_contabilizacion')
        ])

        // BI: nos quedamos con el precio más reciente por (cod_proveedor, cod_item).
        const biPorClave = new Map<string, BiRow>()
        for (const r of biRowsRaw) {
            const clave = claveProveedorItem(r.cod_proveedor, r.cod_articulo)
            const actual = biPorClave.get(clave)
            if (!actual || (r.fecha_contabilizacion ?? '') > (actual.fecha_contabilizacion ?? '')) {
                biPorClave.set(clave, r)
            }
        }

        // Orden de Compra y Precios de Entrega no entran al árbol de decisión (no son
        // una entrada de mercancía real), pero tampoco se dejan en blanco — quedan
        // explícitamente "No aplica" para que no se vean como pendientes en ningún
        // lado de la app. No se cuentan en el resumen de la corrida (ese resumen es
        // solo sobre Entrada de Mercacía).
        const filasExcluidas = todasLasFilas.filter(r =>
            (r.tipo_documento === ORDEN_COMPRA || r.tipo_documento === PRECIOS_DE_ENTREGA) && r.estado !== 'No aplica'
        )
        for (let i = 0; i < filasExcluidas.length; i += 500) {
            const lote = filasExcluidas.slice(i, i + 500).map(r => ({
                id: r.id,
                estado: 'No aplica' as const,
                obs_nl: r.tipo_documento === ORDEN_COMPRA
                    ? 'No aplica — Orden de Compra, no es una entrada de mercancía.'
                    : 'No aplica — Lista de precios de proveedor del exterior, no es una compra real.',
                origen_cierre: 'auto_excluido' as const,
                analizado_en: new Date().toISOString()
            }))
            const { error } = await supabase.from('variacion_costos').upsert(lote, { onConflict: 'id' })
            if (error) throw new Error(`Error excluyendo Orden de Compra/Precios de Entrega (lote ${i}): ${error.message}`)
        }

        const filasEntrada = todasLasFilas.filter(r => r.tipo_documento === ENTRADA_MERCANCIA)

        // Agrupar por proveedor+item y ordenar cronológicamente para poder comparar
        // cada fila contra la inmediatamente anterior de la MISMA llave.
        const porClave = new Map<string, VariacionRow[]>()
        for (const r of filasEntrada) {
            const clave = claveProveedorItem(r.cod_proveedor, r.cod_item)
            if (!porClave.has(clave)) porClave.set(clave, [])
            porClave.get(clave)!.push(r)
        }
        for (const grupo of porClave.values()) {
            grupo.sort((a, b) => (a.fecha_correo ?? '').localeCompare(b.fecha_correo ?? ''))
        }

        const resultados: ClasificacionResultado[] = []

        for (const [clave, grupo] of porClave.entries()) {
            for (let i = 0; i < grupo.length; i++) {
                const fila = grupo[i]
                const anterior = i > 0 ? grupo[i - 1] : null
                const bi = biPorClave.get(clave) ?? null

                resultados.push(clasificarFila(fila, anterior, bi))
            }
        }

        // Prioridad: impacto económico acumulado por proveedor+item entre los que
        // quedaron Pendiente (nunca se usa para excluir, solo para ordenar).
        const impactoPorClave = new Map<string, number>()
        for (const r of resultados) {
            if (r.estado !== 'Pendiente') continue
            const clave = claveProveedorItem(r.cod_proveedor, r.cod_item)
            const fila = filasEntrada.find(f => f.id === r.id)
            impactoPorClave.set(clave, (impactoPorClave.get(clave) ?? 0) + (fila?.total_linea ?? 0))
        }
        for (const r of resultados) {
            if (r.estado !== 'Pendiente' || r.prioridad === 'Alta') continue // tablero ya quedó en Alta
            const clave = claveProveedorItem(r.cod_proveedor, r.cod_item)
            const impacto = impactoPorClave.get(clave) ?? 0
            r.prioridad = impacto >= PRIORIDAD_ALTA_UMBRAL ? 'Alta' : impacto >= PRIORIDAD_MEDIA_UMBRAL ? 'Media' : 'Baja'
        }

        // Escritura de vuelta en lotes.
        const BATCH = 500
        const analizadoEn = new Date().toISOString()
        for (let i = 0; i < resultados.length; i += BATCH) {
            const lote = resultados.slice(i, i + BATCH).map(r => {
                const clave = claveProveedorItem(r.cod_proveedor, r.cod_item)
                return {
                    id: r.id,
                    estado: r.estado,
                    obs_nl: r.observacion,
                    prioridad: r.prioridad,
                    motivo_alerta: r.motivo_alerta,
                    ultimo_costo_historico: r.ultimo_costo_historico,
                    fecha_ultimo_costo_historico: r.fecha_ultimo_costo_historico,
                    origen_cierre: r.origen_cierre,
                    analizado_en: analizadoEn,
                    impacto_acumulado_grupo: r.estado === 'Pendiente' ? (impactoPorClave.get(clave) ?? 0) : null
                }
            })
            const { error } = await supabase.from('variacion_costos').upsert(lote, { onConflict: 'id' })
            if (error) throw new Error(`Error guardando clasificación (lote ${i}): ${error.message}`)
        }

        // Trazabilidad por fila.
        for (let i = 0; i < resultados.length; i += BATCH) {
            const lote = resultados.slice(i, i + BATCH).map(r => ({
                run_id: runId,
                variacion_costos_id: r.id,
                cod_proveedor: r.cod_proveedor,
                cod_item: r.cod_item,
                regla_aplicada: r.regla_aplicada,
                resultado_estado: r.estado,
                observacion: r.observacion,
                ultimo_costo_historico: r.ultimo_costo_historico,
                fecha_ultimo_costo_historico: r.fecha_ultimo_costo_historico,
                bi_consultado: r.bi_consultado,
                bi_resultado: r.bi_resultado,
                prioridad: r.prioridad
            }))
            const { error } = await supabase.from('variacion_analisis_log').insert(lote)
            if (error) throw new Error(`Error guardando trazabilidad (lote ${i}): ${error.message}`)
        }

        // Resumen de la corrida.
        const resumen = {
            total_recibidos: resultados.length,
            total_auto_finalizado: resultados.filter(r => r.estado === 'Finalizado').length,
            total_no_aplica: resultados.filter(r => r.estado === 'No aplica').length,
            total_pendiente: resultados.filter(r => r.estado === 'Pendiente').length,
            total_en_analisis: filasEntrada.filter(f => f.estado === 'En análisis').length,
            total_nuevos_pendientes: resultados.filter(r => r.estado === 'Pendiente' && r.estado_previo !== 'Pendiente').length,
            prioridad_alta: resultados.filter(r => r.estado === 'Pendiente' && r.prioridad === 'Alta').length,
            prioridad_media: resultados.filter(r => r.estado === 'Pendiente' && r.prioridad === 'Media').length,
            prioridad_baja: resultados.filter(r => r.estado === 'Pendiente' && r.prioridad === 'Baja').length,
            impacto_pendiente_total: resultados
                .filter(r => r.estado === 'Pendiente')
                .reduce((sum, r) => sum + (filasEntrada.find(f => f.id === r.id)?.total_linea ?? 0), 0)
        }

        await supabase.from('variacion_analisis_runs').update({
            finalizado_en: new Date().toISOString(),
            estado_run: 'ok',
            ...resumen
        }).eq('id', runId)

        return { runId, resumen }

    } catch (err: any) {
        await supabase.from('variacion_analisis_runs').update({
            finalizado_en: new Date().toISOString(),
            estado_run: 'error',
            error_detalle: err.message
        }).eq('id', runId)
        throw err
    }
}

function clasificarFila(fila: VariacionRow, anterior: VariacionRow | null, bi: BiRow | null): ClasificacionResultado {
    const base = {
        id: fila.id,
        cod_proveedor: fila.cod_proveedor,
        cod_item: fila.cod_item,
        estado_previo: fila.estado
    }

    // 1. FOCOLSA / estiba — siempre excluido.
    if (esFocolsaOEstiba(fila.descripcion_proveedor, fila.descripcion_item)) {
        return {
            ...base,
            estado: 'No aplica',
            observacion: 'Proveedor de estibas. Las estibas presentan variaciones normales debido a fabricación bajo medidas específicas.',
            prioridad: null,
            motivo_alerta: null,
            ultimo_costo_historico: null,
            fecha_ultimo_costo_historico: null,
            origen_cierre: 'auto_excluido',
            bi_consultado: false,
            bi_resultado: null,
            regla_aplicada: 'focolsa_estiba'
        }
    }

    const tablero = esTablero(fila.descripcion_item)
    const ultimoCosto = anterior?.precio ?? null
    const fechaUltimoCosto = anterior?.fecha_correo ?? null

    // 2. Material nuevo: sin histórico en NEXUS ni en BI.
    if (ultimoCosto === null && !bi) {
        return {
            ...base,
            estado: 'Finalizado',
            observacion: 'OK, material nuevo.',
            prioridad: null,
            motivo_alerta: null,
            ultimo_costo_historico: null,
            fecha_ultimo_costo_historico: null,
            origen_cierre: 'auto_material_nuevo',
            bi_consultado: true,
            bi_resultado: 'sin_datos',
            regla_aplicada: 'material_nuevo'
        }
    }

    // 3. Mismo costo que el último conocido del mismo proveedor+material en NEXUS.
    if (ultimoCosto !== null && fila.precio !== null && sonPreciosEquivalentes(fila.precio, ultimoCosto)) {
        return {
            ...base,
            estado: 'Finalizado',
            observacion: 'OK, mismo costo previamente analizado.',
            prioridad: null,
            motivo_alerta: null,
            ultimo_costo_historico: ultimoCosto,
            fecha_ultimo_costo_historico: fechaUltimoCosto,
            origen_cierre: 'auto_mismo_costo',
            bi_consultado: false,
            bi_resultado: null,
            regla_aplicada: 'mismo_costo_historico_nexus'
        }
    }

    // 4. Mismo costo que el penúltimo precio del proveedor (ya calculado por SAP).
    if (fila.penultimo_precio_prov !== null && fila.precio !== null && sonPreciosEquivalentes(fila.precio, fila.penultimo_precio_prov)) {
        return {
            ...base,
            estado: 'Finalizado',
            observacion: 'OK, se mantiene el mismo costo del proveedor.',
            prioridad: null,
            motivo_alerta: null,
            ultimo_costo_historico: ultimoCosto,
            fecha_ultimo_costo_historico: fechaUltimoCosto,
            origen_cierre: 'auto_penultimo',
            bi_consultado: false,
            bi_resultado: null,
            regla_aplicada: 'mismo_penultimo_precio'
        }
    }

    // 5. Cruce con BI de facturación (mismo proveedor+material).
    if (bi && bi.precio !== null && fila.precio !== null) {
        if (sonPreciosEquivalentes(fila.precio, bi.precio)) {
            return {
                ...base,
                estado: 'Finalizado',
                observacion: 'OK, mismo costo facturado en BI.',
                prioridad: null,
                motivo_alerta: null,
                ultimo_costo_historico: ultimoCosto,
                fecha_ultimo_costo_historico: fechaUltimoCosto,
                origen_cierre: 'auto_bi',
                bi_consultado: true,
                bi_resultado: `BI=${fmt(bi.precio)}, coincide`,
                regla_aplicada: 'coincide_con_bi'
            }
        }
    }

    // 6. Nada lo justifica — queda pendiente para revisión humana.
    const motivo = ultimoCosto !== null
        ? `El último costo registrado para ${fila.descripcion_proveedor ?? fila.cod_proveedor} + ${fila.descripcion_item ?? fila.cod_item} era ${fmt(ultimoCosto)}` +
          (fechaUltimoCosto ? ` (${fechaUltimoCosto})` : '') +
          `. El nuevo costo es ${fila.precio !== null ? fmt(fila.precio) : '—'}.` +
          (bi ? (bi.precio !== null ? ` BI reporta ${fmt(bi.precio)}, diferente a SAP.` : '') : ' No hay datos de BI para este proveedor+material.') +
          ' Revisar fecha y origen del cambio.'
        : `Material sin costo histórico en NEXUS` +
          (bi?.precio !== null && bi ? `, pero BI reporta ${fmt(bi.precio)} (diferente al costo actual de SAP de ${fila.precio !== null ? fmt(fila.precio) : '—'})` : '') +
          '. Requiere validación.'

    return {
        ...base,
        estado: 'Pendiente',
        observacion: '',
        prioridad: tablero ? 'Alta' : null, // se recalcula después si no es tablero
        motivo_alerta: motivo,
        ultimo_costo_historico: ultimoCosto,
        fecha_ultimo_costo_historico: fechaUltimoCosto,
        origen_cierre: null,
        bi_consultado: !!bi,
        bi_resultado: bi ? (bi.precio !== null ? `BI=${fmt(bi.precio)}, no coincide` : 'sin precio') : 'sin_datos',
        regla_aplicada: tablero ? 'pendiente_tablero' : 'pendiente_sin_justificacion'
    }
}
