'use client'

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, TrendingUp, TrendingDown, RefreshCw,
    PackageSearch, AlertCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp,
    Search, X, Mail, CheckCircle2, Link2
} from 'lucide-react'
import '../../home/home.css'
import '../../admin/admin.css'
import './variacion.css'
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface VariacionRow {
    id: string
    fecha_correo: string | null
    tipo_documento: string | null
    numero_documento: string | null
    fecha_contabilizacion: string | null
    cod_proveedor: string | null
    descripcion_proveedor: string | null
    cod_item: string | null
    descripcion_item: string | null
    precio: number | null
    precio_prom_almacen: number | null
    diferencia_precios: number | null
    porc_variacion: number | null
    penultimo_precio_prov: number | null
    dif_vs_penultimo_precio: number | null
    porc_vs_penultimo: number | null
    cantidad: number | null
    total_linea: number | null
    precio_lista_precios: number | null
    numero_lista_precio: string | null
    obs_nl: string | null
    responsable: string | null
    estado: string | null
    avoidance_ahorro: number | null
    si_no: string | null
    synced_at: string | null
    revisiones_en_proceso: number | null
    origen: string | null
}

interface MsStatus {
    connected: boolean
    email: string
    expiresAt?: string
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']
const PAGE_SIZE = 50
const ORIGEN_COLOR: Record<string, string> = { Nacional: '#10b981', Exterior: '#6366f1' }
const ESTANCADO_UMBRAL = 3
const SIN_ESTADO = 'Sin estado'
const ESTADOS_EDITABLES = ['Sin iniciar', 'En proceso', 'Finalizado', 'No aplica']
const NALLELY_EMAIL = 'nallely.lopera@firplak.com'

const fmt = (n: number | null | undefined) => n === null || n === undefined ? '—' : `$${Math.round(n).toLocaleString('es-CO')}`
const fmtPct = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${(n * 100).toFixed(1)}%`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-CO') : '—'

// Texto en minúsculas de una columna del archivo, usado para el filtro por columna
// (compara contra lo mismo que se ve renderizado, no el valor crudo).
function archivoCellText(r: VariacionRow, key: string): string {
    switch (key) {
        case 'fecha_correo': return fmtDate(r.fecha_correo).toLowerCase()
        case 'fecha_contabilizacion': return fmtDate(r.fecha_contabilizacion).toLowerCase()
        case 'precio': return fmt(r.precio).toLowerCase()
        case 'precio_prom_almacen': return fmt(r.precio_prom_almacen).toLowerCase()
        case 'diferencia_precios': return fmt(r.diferencia_precios).toLowerCase()
        case 'porc_variacion': return fmtPct(r.porc_variacion).toLowerCase()
        case 'penultimo_precio_prov': return fmt(r.penultimo_precio_prov).toLowerCase()
        case 'dif_vs_penultimo_precio': return fmt(r.dif_vs_penultimo_precio).toLowerCase()
        case 'porc_vs_penultimo': return fmtPct(r.porc_vs_penultimo).toLowerCase()
        case 'cantidad': return (r.cantidad ?? '').toString().toLowerCase()
        case 'total_linea': return fmt(r.total_linea).toLowerCase()
        case 'precio_lista_precios': return fmt(r.precio_lista_precios).toLowerCase()
        case 'origen': return (r.origen === 'correo' ? 'correo' : 'excel')
        default: return ((r as any)[key] ?? '').toString().toLowerCase()
    }
}

function esTablero(descripcion: string | null): boolean {
    return !!descripcion && descripcion.toUpperCase().includes('TABLERO')
}

function origenProveedor(codProveedor: string | null): 'Nacional' | 'Exterior' | null {
    if (!codProveedor) return null
    if (codProveedor.startsWith('PN')) return 'Nacional'
    if (codProveedor.startsWith('PE')) return 'Exterior'
    return null
}

// Impacto económico real de la línea (Precio × Cantidad) — el criterio de priorización
// más importante según el negocio, por encima del % de variación.
function impactoDe(r: VariacionRow): number {
    if (r.total_linea !== null && r.total_linea !== undefined) return r.total_linea
    if (r.diferencia_precios !== null && r.cantidad !== null) return r.diferencia_precios * r.cantidad
    return 0
}

function ItemSearchSelect({ options, value, onChange, placeholder }: {
    options: [string, string][]
    value: string
    onChange: (val: string) => void
    placeholder: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const selected = options.find(([cod]) => cod === value)
    const filtered = options.filter(([, nombre]) => nombre.toLowerCase().includes(searchTerm.toLowerCase()))

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="searchable-select" ref={containerRef} style={{ maxWidth: 260 }}>
            <div className={`select-trigger ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                {selected ? (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected[1]}</span>
                ) : (
                    <span className="placeholder">{placeholder}</span>
                )}
                <div className="trigger-actions">
                    {value && (
                        <span className="clear-btn" onClick={e => { e.stopPropagation(); onChange(''); setSearchTerm('') }}>
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={14} className={`arrow ${isOpen ? 'open' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="select-dropdown animate-fade-in">
                    <div className="search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar ítem..."
                            autoFocus
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="options-list">
                        {filtered.length > 0 ? (
                            filtered.map(([cod, nombre]) => (
                                <div
                                    key={cod}
                                    className={`option-item ${cod === value ? 'selected' : ''}`}
                                    onClick={() => { onChange(cod); setIsOpen(false); setSearchTerm('') }}
                                >
                                    {nombre}
                                </div>
                            ))
                        ) : (
                            <div className="no-results">No se encontraron resultados</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ margin: '0.15rem 0', color: p.color }}>{p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}</p>
                ))}
            </div>
        )
    }
    return null
}

export default function VariacionCostosPage() {
    return (
        <Suspense fallback={<div className="home-container"><p>Cargando...</p></div>}>
            <VariacionCostosContent />
        </Suspense>
    )
}

function VariacionCostosContent() {
    const supabase = createClient()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [user, setUser] = useState<any>(null)
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [rows, setRows] = useState<VariacionRow[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [page, setPage] = useState(1)

    const [tab, setTab] = useState<'historico' | 'archivo'>('historico')
    const [msStatus, setMsStatus] = useState<MsStatus | null>(null)
    const [msMsg, setMsMsg] = useState<string | null>(null)
    const [checkingCorreos, setCheckingCorreos] = useState(false)
    const [archivoPage, setArchivoPage] = useState(1)
    const [archivoFilters, setArchivoFilters] = useState<Record<string, string>>({})

    const [vista, setVista] = useState<'activos' | 'todo'>('activos')
    const [fProveedor, setFProveedor] = useState('')
    const [fItem, setFItem] = useState('')
    const [fEstado, setFEstado] = useState('')
    const [fDesde, setFDesde] = useState('')
    const [fHasta, setFHasta] = useState('')
    const [selectedItem, setSelectedItem] = useState('')

    const esNallely = (user?.email || '').toLowerCase() === NALLELY_EMAIL

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
            const { data: profile } = await supabase.schema('nexus').from('users').select('rol').eq('id', user.id).single()
            setIsAdmin(profile?.rol === 'ADMIN')
        }
        init()
    }, [supabase, router])

    const fetchRows = async () => {
        setLoading(true)
        const { data } = await supabase.schema('nexus').from('variacion_costos').select('*').order('fecha_correo', { ascending: false, nullsFirst: false })
        if (data) setRows(data as VariacionRow[])
        setLoading(false)
    }

    const fetchMsStatus = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/auth/microsoft/status', {
            headers: { Authorization: `Bearer ${session?.access_token}` }
        })
        const json = await res.json()
        if (res.ok) setMsStatus(json)
    }

    useEffect(() => {
        if (isAdmin === true) { fetchRows(); fetchMsStatus() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin])

    useEffect(() => { setPage(1) }, [vista, fProveedor, fEstado, fItem, fDesde, fHasta])
    useEffect(() => { setArchivoPage(1) }, [archivoFilters])

    // Mensajes de vuelta del flujo de conexión con Microsoft (?msConnected=... / ?msError=...)
    useEffect(() => {
        const connected = searchParams.get('msConnected')
        const error = searchParams.get('msError')
        if (connected) { setMsMsg(`Cuenta conectada: ${connected}`); setTab('archivo') }
        else if (error) { setMsMsg(`Error: ${error}`); setTab('archivo') }
    }, [searchParams])

    const handleRevisarCorreos = async () => {
        setCheckingCorreos(true)
        setMsMsg(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/costos/variacion-email-check', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.access_token}` }
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Error al revisar correos')
            setMsMsg(`Correos nuevos: ${json.correosNuevos} · Filas insertadas: ${json.filasInsertadas}`)
            await fetchRows()
        } catch (err: any) {
            setMsMsg(`Error: ${err.message}`)
        } finally {
            setCheckingCorreos(false)
        }
    }

    const updateRow = async (id: string, field: 'estado' | 'obs_nl', value: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value || null } : r))
        await supabase.schema('nexus').from('variacion_costos').update({ [field]: value || null }).eq('id', id)
    }

    const proveedores = useMemo(() => {
        const map = new Map<string, string>()
        rows.forEach(r => { if (r.cod_proveedor) map.set(r.cod_proveedor, r.descripcion_proveedor || r.cod_proveedor) })
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
    }, [rows])

    const estados = useMemo(() => {
        const set = new Set<string>()
        rows.forEach(r => { if (r.estado) set.add(r.estado) })
        return Array.from(set).sort()
    }, [rows])

    const itemsUnicos = useMemo(() => {
        const map = new Map<string, string>()
        rows.forEach(r => { if (r.cod_item) map.set(r.cod_item, r.descripcion_item || r.cod_item) })
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
    }, [rows])

    // Respeta proveedor/ítem/fechas (no la vista ni el estado, que se aplican después) —
    // así "Excluidos Finalizado/No aplica" también reflejan el rango de fechas seleccionado.
    const filteredBase = useMemo(() => {
        return rows.filter(r => {
            if (fProveedor && r.cod_proveedor !== fProveedor) return false
            if (fItem && !`${r.cod_item ?? ''} ${r.descripcion_item ?? ''}`.toLowerCase().includes(fItem.toLowerCase())) return false
            if (fDesde && (!r.fecha_correo || r.fecha_correo < fDesde)) return false
            if (fHasta && (!r.fecha_correo || r.fecha_correo > fHasta)) return false
            return true
        })
    }, [rows, fProveedor, fItem, fDesde, fHasta])

    const excluidosFinalizado = useMemo(() => filteredBase.filter(r => r.estado === 'Finalizado').length, [filteredBase])
    const excluidosNoAplica = useMemo(() => filteredBase.filter(r => r.estado === 'No aplica').length, [filteredBase])

    const filtered = useMemo(() => {
        return filteredBase.filter(r => {
            // "Activos" = todo lo que no esté cerrado (Finalizado / No aplica).
            if (vista === 'activos' && (r.estado === 'Finalizado' || r.estado === 'No aplica')) return false
            if (fEstado === SIN_ESTADO ? !!r.estado : (fEstado && r.estado !== fEstado)) return false
            return true
        })
    }, [filteredBase, vista, fEstado])

    const totalRegistros = filtered.length
    const incrementos = filtered.filter(r => (r.porc_variacion ?? 0) > 0).length
    const decrementos = filtered.filter(r => (r.porc_variacion ?? 0) < 0).length
    const enSeguimientoEstancado = filtered.filter(r => r.estado === 'En proceso' && (r.revisiones_en_proceso || 0) >= ESTANCADO_UMBRAL).length
    const ultimaSync = rows.reduce<string | null>((max, r) => (r.synced_at && (!max || r.synced_at > max)) ? r.synced_at : max, null)

    const defaultItem = useMemo(() => {
        if (selectedItem) return selectedItem
        const top = [...filtered].filter(r => r.cod_item).sort((a, b) => impactoDe(b) - impactoDe(a))[0]
        return top?.cod_item || ''
    }, [filtered, selectedItem])

    const evolucionItem = useMemo(() => {
        return filtered
            .filter(r => r.cod_item === defaultItem && r.fecha_correo)
            .sort((a, b) => (a.fecha_correo || '').localeCompare(b.fecha_correo || ''))
            .map(r => ({
                fecha: r.fecha_correo ? new Date(r.fecha_correo).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' }) : '',
                Precio: r.precio || 0,
                'Precio Prom. Almacén': r.precio_prom_almacen || 0,
            }))
    }, [filtered, defaultItem])

    const distribucionEstado = useMemo(() => {
        const map = new Map<string, number>()
        filtered.forEach(r => {
            const key = r.estado || SIN_ESTADO
            map.set(key, (map.get(key) || 0) + 1)
        })
        return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
    }, [filtered])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const archivoFilteredRows = useMemo(() => {
        const activos = Object.entries(archivoFilters).filter(([, v]) => v.trim() !== '')
        if (activos.length === 0) return rows
        return rows.filter(r => activos.every(([key, val]) => archivoCellText(r, key).includes(val.toLowerCase())))
    }, [rows, archivoFilters])

    const archivoTotalPages = Math.max(1, Math.ceil(archivoFilteredRows.length / PAGE_SIZE))
    const archivoPageRows = archivoFilteredRows.slice((archivoPage - 1) * PAGE_SIZE, archivoPage * PAGE_SIZE)

    const sectionStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '1rem', padding: '1.5rem' }

    if (isAdmin === null || !user) {
        return <div className="home-container"><p>Cargando...</p></div>
    }

    if (isAdmin === false) {
        return (
            <div className="home-container">
                <div style={{ ...sectionStyle, textAlign: 'center', marginTop: '3rem', maxWidth: 420, marginInline: 'auto' }}>
                    <AlertCircle size={32} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
                    <h2 style={{ margin: 0 }}>Acceso restringido</h2>
                    <p style={{ opacity: 0.7 }}>Este submódulo está disponible solo para administradores.</p>
                    <Link href="/costos" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1rem' }}>Volver</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="admin-container animate-fade-in">
            <Link href="/costos" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--muted-foreground))', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <ArrowLeft size={16} /> Volver a Módulo de Costos
            </Link>

            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Variación de Costos</h1>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                    Seguimiento a la fluctuación de precios de materias primas
                    {ultimaSync && <> · Última actualización: {new Date(ultimaSync).toLocaleString('es-CO')}</>}
                </p>
            </div>

            {/* ── Pestañas ── */}
            <div style={{ display: 'inline-flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    className="action-btn"
                    onClick={() => setTab('historico')}
                    style={tab === 'historico' ? { background: 'hsl(var(--primary))', color: '#f5f1ea', borderColor: 'hsl(var(--primary))' } : {}}
                >
                    Histórico Completo
                </button>
                <button
                    className="action-btn"
                    onClick={() => setTab('archivo')}
                    style={tab === 'archivo' ? { background: 'hsl(var(--primary))', color: '#f5f1ea', borderColor: 'hsl(var(--primary))' } : {}}
                >
                    Visualizar Archivo
                </button>
            </div>

            {tab === 'historico' && (
                <>
                    {/* ── Toggle de vista ── */}
                    <div style={{ display: 'inline-flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        <button
                            className="action-btn"
                            onClick={() => setVista('activos')}
                            style={vista === 'activos' ? { background: 'hsl(var(--primary))', color: '#f5f1ea', borderColor: 'hsl(var(--primary))' } : {}}
                        >
                            Activos (no cerrados)
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setVista('todo')}
                            style={vista === 'todo' ? { background: 'hsl(var(--primary))', color: '#f5f1ea', borderColor: 'hsl(var(--primary))' } : {}}
                        >
                            Todo el histórico
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {[
                            { icon: <PackageSearch size={16} style={{ opacity: 0.5 }} />, label: 'Registros (vista actual)', value: totalRegistros.toLocaleString('es-CO') },
                            { icon: <TrendingUp size={16} color="#ef4444" />, label: 'Incrementos', value: incrementos.toLocaleString('es-CO'), color: '#ef4444' },
                            { icon: <TrendingDown size={16} color="#10b981" />, label: 'Decrecimientos', value: decrementos.toLocaleString('es-CO'), color: '#10b981' },
                            { icon: <AlertTriangle size={16} color="#f59e0b" />, label: 'Excluidos Finalizado', value: excluidosFinalizado.toLocaleString('es-CO') },
                            { icon: <AlertTriangle size={16} color="#f59e0b" />, label: 'Excluidos No Aplica', value: excluidosNoAplica.toLocaleString('es-CO') },
                            { icon: <AlertTriangle size={16} color="#ef4444" />, label: 'Posible Estancamiento', value: enSeguimientoEstancado.toLocaleString('es-CO'), color: enSeguimientoEstancado > 0 ? '#ef4444' : undefined },
                        ].map((k, i) => (
                            <div key={i} className="stat-card card">
                                {k.icon}
                                <div style={{ flex: 1 }}>
                                    <div className="stat-label">{k.label}</div>
                                    <div className="stat-value" style={{ fontSize: '1.05rem', color: k.color }}>{k.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Proveedor</label>
                            <select className="form-control" value={fProveedor} onChange={e => setFProveedor(e.target.value)}>
                                <option value="">Todos</option>
                                {proveedores.map(([cod, nombre]) => <option key={cod} value={cod}>{nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Ítem (código o descripción)</label>
                            <input className="form-control" value={fItem} onChange={e => setFItem(e.target.value)} placeholder="Buscar ítem..." />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Estado</label>
                            <select className="form-control" value={fEstado} onChange={e => setFEstado(e.target.value)}>
                                <option value="">Todos</option>
                                <option value={SIN_ESTADO}>Sin estado</option>
                                {estados.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Desde</label>
                            <input type="date" className="form-control" value={fDesde} onChange={e => setFDesde(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Hasta</label>
                            <input type="date" className="form-control" value={fHasta} onChange={e => setFHasta(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ ...sectionStyle, marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem' }}>Evolución de Precio por Ítem</h3>
                            <ItemSearchSelect
                                options={itemsUnicos}
                                value={defaultItem}
                                onChange={setSelectedItem}
                                placeholder="Buscar ítem..."
                            />
                        </div>
                        {loading || evolucionItem.length === 0 ? (
                            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Sin datos para este ítem</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={380}>
                                <LineChart data={evolucionItem} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                                    <Line type="monotone" dataKey="Precio" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Precio Prom. Almacén" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div style={{ ...sectionStyle, marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>Distribución por Estado</h3>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Haz clic en una porción para filtrar la tabla por ese estado.</p>
                        {loading || distribucionEstado.length === 0 ? (
                            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Sin datos aún</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={distribucionEstado}
                                        cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        labelLine={false}
                                        fontSize={10}
                                        cursor="pointer"
                                        onClick={(entry: any) => setFEstado(prev => prev === entry.name ? '' : entry.name)}
                                    >
                                        {distribucionEstado.map((entry, index) => (
                                            <Cell
                                                key={index}
                                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                stroke={fEstado === entry.name ? 'hsl(var(--foreground))' : undefined}
                                                strokeWidth={fEstado === entry.name ? 2 : 0}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem' }}>Detalle de Movimientos ({filtered.length.toLocaleString('es-CO')})</h2>
                        <div className="admin-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th></th><th>Fecha</th><th>Documento</th><th>Proveedor</th><th>Ítem</th>
                                        <th>Precio</th><th>Penúltimo Precio Prov.</th><th>% vs Penúltimo (mismo prov.)</th><th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</td></tr>
                                    ) : pageRows.length === 0 ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay registros con estos filtros.</td></tr>
                                    ) : pageRows.map(r => {
                                        const pctReal = r.porc_vs_penultimo ?? r.porc_variacion
                                        const expanded = expandedId === r.id
                                        const origen = origenProveedor(r.cod_proveedor)
                                        const tablero = esTablero(r.descripcion_item)
                                        const estancado = r.estado === 'En proceso' && (r.revisiones_en_proceso || 0) >= ESTANCADO_UMBRAL
                                        return (
                                            <Fragment key={r.id}>
                                                <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : r.id)}>
                                                    <td>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>{fmtDate(r.fecha_correo)}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>{r.numero_documento || '—'}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>
                                                        {r.descripcion_proveedor || r.cod_proveedor || '—'}
                                                        {origen && (
                                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: `${ORIGEN_COLOR[origen]}18`, color: ORIGEN_COLOR[origen] }}>{origen}</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem' }}>
                                                        {r.descripcion_item || r.cod_item || '—'}
                                                        {tablero && (
                                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: 'hsla(204, 38%, 24%, 0.1)', color: 'hsl(var(--primary))' }}>TABLERO</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem' }}>{fmt(r.precio)}</td>
                                                    <td style={{ fontSize: '0.85rem' }}>{fmt(r.penultimo_precio_prov)}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.85rem', color: (pctReal ?? 0) > 0 ? '#ef4444' : (pctReal ?? 0) < 0 ? '#10b981' : undefined }}>{fmtPct(pctReal)}</td>
                                                    <td>
                                                        {r.estado && <span className="badge badge-pending">{r.estado}</span>}
                                                        {estancado && (
                                                            <span style={{ marginLeft: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.65rem', fontWeight: 700, color: '#ef4444' }}>
                                                                <AlertTriangle size={10} /> {r.revisiones_en_proceso}x
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expanded && (
                                                    <tr>
                                                        <td colSpan={9} style={{ background: 'hsla(204, 38%, 24%, 0.03)' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', padding: '0.75rem 0.5rem', fontSize: '0.8rem' }}>
                                                                <div><strong>Tipo Documento:</strong> {r.tipo_documento || '—'}</div>
                                                                <div><strong>Fecha Contabilización:</strong> {fmtDate(r.fecha_contabilizacion)}</div>
                                                                <div><strong>Cod. Proveedor:</strong> {r.cod_proveedor || '—'}</div>
                                                                <div><strong>Cod. Ítem:</strong> {r.cod_item || '—'}</div>
                                                                <div><strong>% Variación general:</strong> {fmtPct(r.porc_variacion)}</div>
                                                                <div><strong>Diferencia Precios (general):</strong> {fmt(r.diferencia_precios)}</div>
                                                                <div><strong>Penúltimo Precio Prov.:</strong> {fmt(r.penultimo_precio_prov)}</div>
                                                                <div><strong>Dif. vs Penúltimo:</strong> {fmt(r.dif_vs_penultimo_precio)}</div>
                                                                <div><strong>Cantidad:</strong> {r.cantidad ?? '—'}</div>
                                                                <div><strong>Total Línea (impacto):</strong> {fmt(r.total_linea)}</div>
                                                                <div><strong>Precio en Lista SAP:</strong> {fmt(r.precio_lista_precios)}</div>
                                                                <div><strong># Lista de Precio:</strong> {r.numero_lista_precio || '—'}</div>
                                                                <div><strong>Origen:</strong> {r.origen === 'correo' ? 'Correo' : 'Excel'}</div>
                                                                <div><strong>Sincronizaciones en proceso:</strong> {r.revisiones_en_proceso ?? 0}</div>
                                                                <div style={{ gridColumn: '1 / -1' }}><strong>Observación:</strong> {r.obs_nl || '—'}</div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                                <button className="action-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                                <span style={{ fontSize: '0.85rem', opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Página
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ width: 60, fontSize: '0.85rem', padding: '0.2rem 0.4rem', textAlign: 'center' }}
                                        min={1}
                                        max={totalPages}
                                        value={page}
                                        onChange={e => {
                                            const n = parseInt(e.target.value, 10)
                                            if (!Number.isNaN(n)) setPage(Math.min(totalPages, Math.max(1, n)))
                                        }}
                                    />
                                    de {totalPages}
                                </span>
                                <button className="action-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {tab === 'archivo' && (
                <>
                    <div style={{ ...sectionStyle, marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: msStatus?.connected ? 'rgba(16,185,129,0.1)' : 'hsla(204,38%,24%,0.08)', color: msStatus?.connected ? '#10b981' : 'hsl(var(--muted-foreground))' }}>
                                    {msStatus?.connected ? <CheckCircle2 size={20} /> : <Mail size={20} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {msStatus?.connected ? `Conectado como ${msStatus.email}` : 'Cuenta de Microsoft no conectada'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                                        {msStatus?.connected
                                            ? `Expira: ${msStatus.expiresAt ? new Date(msStatus.expiresAt).toLocaleString('es-CO') : '—'} (se renueva sola)`
                                            : 'Nallely debe conectar su cuenta para poder leer el correo de variación de costos.'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                {esNallely ? (
                                    <a href="/api/auth/microsoft/login" className="action-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                                        <Link2 size={14} /> {msStatus?.connected ? 'Reconectar cuenta' : 'Conectar cuenta de Microsoft'}
                                    </a>
                                ) : (
                                    !msStatus?.connected && (
                                        <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                                            Solo nallely.lopera@firplak.com puede conectar esta cuenta
                                        </span>
                                    )
                                )}
                                <button className="action-btn" onClick={handleRevisarCorreos} disabled={checkingCorreos || !msStatus?.connected} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {checkingCorreos ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                                    {checkingCorreos ? 'Revisando...' : 'Revisar correos ahora'}
                                </button>
                            </div>
                        </div>
                        {msMsg && (
                            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: msMsg.startsWith('Error') ? '#ef4444' : '#10b981' }}>{msMsg}</div>
                        )}
                    </div>

                    <div style={sectionStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <h2 style={{ margin: 0, fontSize: '1rem' }}>
                                Archivo Completo ({archivoFilteredRows.length.toLocaleString('es-CO')} de {rows.length.toLocaleString('es-CO')} filas)
                            </h2>
                            {Object.values(archivoFilters).some(v => v.trim() !== '') && (
                                <button className="action-btn" style={{ fontSize: '0.78rem' }} onClick={() => setArchivoFilters({})}>Limpiar filtros</button>
                            )}
                        </div>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                            Todas las columnas, filtrables individualmente. Edita Estado y Observaciones directamente aquí — se guardan al instante.
                        </p>
                        <div className="admin-table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha Correo</th><th>Tipo Doc.</th><th># Doc.</th><th>Fecha Contab.</th>
                                        <th>Cod. Prov.</th><th>Proveedor</th><th>Cod. Ítem</th><th>Ítem</th>
                                        <th>Precio</th><th>Precio Prom.</th><th>Dif. Precios</th><th>% Variación</th>
                                        <th>Penúltimo Precio</th><th>Dif. Penúltimo</th><th>% Penúltimo</th>
                                        <th>Cantidad</th><th>Total Línea</th><th>Precio Lista</th><th># Lista</th>
                                        <th style={{ minWidth: 180 }}>Observaciones</th>
                                        <th style={{ minWidth: 130 }}>Estado</th><th>Origen</th>
                                    </tr>
                                    <tr>
                                        {[
                                            'fecha_correo', 'tipo_documento', 'numero_documento', 'fecha_contabilizacion',
                                            'cod_proveedor', 'descripcion_proveedor', 'cod_item', 'descripcion_item',
                                            'precio', 'precio_prom_almacen', 'diferencia_precios', 'porc_variacion',
                                            'penultimo_precio_prov', 'dif_vs_penultimo_precio', 'porc_vs_penultimo',
                                            'cantidad', 'total_linea', 'precio_lista_precios', 'numero_lista_precio',
                                            'obs_nl'
                                        ].map(key => (
                                            <th key={key} style={{ padding: '0.3rem' }}>
                                                <input
                                                    className="form-control"
                                                    style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: '100%' }}
                                                    placeholder="Filtrar..."
                                                    value={archivoFilters[key] || ''}
                                                    onChange={e => setArchivoFilters(prev => ({ ...prev, [key]: e.target.value }))}
                                                />
                                            </th>
                                        ))}
                                        <th style={{ padding: '0.3rem' }}>
                                            <select
                                                className="form-control"
                                                style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: '100%' }}
                                                value={archivoFilters.estado || ''}
                                                onChange={e => setArchivoFilters(prev => ({ ...prev, estado: e.target.value }))}
                                            >
                                                <option value="">Todos</option>
                                                {ESTADOS_EDITABLES.map(e => <option key={e} value={e.toLowerCase()}>{e}</option>)}
                                            </select>
                                        </th>
                                        <th style={{ padding: '0.3rem' }}>
                                            <select
                                                className="form-control"
                                                style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: '100%' }}
                                                value={archivoFilters.origen || ''}
                                                onChange={e => setArchivoFilters(prev => ({ ...prev, origen: e.target.value }))}
                                            >
                                                <option value="">Todos</option>
                                                <option value="correo">Correo</option>
                                                <option value="excel">Excel</option>
                                            </select>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={22} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</td></tr>
                                    ) : archivoPageRows.length === 0 ? (
                                        <tr><td colSpan={22} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Sin datos con estos filtros.</td></tr>
                                    ) : archivoPageRows.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontSize: '0.78rem' }}>{fmtDate(r.fecha_correo)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.tipo_documento || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.numero_documento || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmtDate(r.fecha_contabilizacion)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.cod_proveedor || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.descripcion_proveedor || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.cod_item || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.descripcion_item || '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.precio)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.precio_prom_almacen)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.diferencia_precios)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmtPct(r.porc_variacion)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.penultimo_precio_prov)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.dif_vs_penultimo_precio)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmtPct(r.porc_vs_penultimo)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.cantidad ?? '—'}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.total_linea)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{fmt(r.precio_lista_precios)}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.numero_lista_precio || '—'}</td>
                                            <td>
                                                <input
                                                    key={`obs-${r.id}`}
                                                    className="form-control"
                                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem', minWidth: 160 }}
                                                    defaultValue={r.obs_nl || ''}
                                                    placeholder="Sin observación"
                                                    onBlur={e => { if (e.target.value !== (r.obs_nl || '')) updateRow(r.id, 'obs_nl', e.target.value) }}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="form-control"
                                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                                                    value={r.estado || ''}
                                                    onChange={e => updateRow(r.id, 'estado', e.target.value)}
                                                >
                                                    <option value="">— Vacío —</option>
                                                    {ESTADOS_EDITABLES.map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ fontSize: '0.78rem' }}>{r.origen === 'correo' ? 'Correo' : 'Excel'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {archivoTotalPages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                                <button className="action-btn" disabled={archivoPage <= 1} onClick={() => setArchivoPage(p => Math.max(1, p - 1))}>Anterior</button>
                                <span style={{ fontSize: '0.85rem', opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                    Página
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ width: 60, fontSize: '0.85rem', padding: '0.2rem 0.4rem', textAlign: 'center' }}
                                        min={1}
                                        max={archivoTotalPages}
                                        value={archivoPage}
                                        onChange={e => {
                                            const n = parseInt(e.target.value, 10)
                                            if (!Number.isNaN(n)) setArchivoPage(Math.min(archivoTotalPages, Math.max(1, n)))
                                        }}
                                    />
                                    de {archivoTotalPages}
                                </span>
                                <button className="action-btn" disabled={archivoPage >= archivoTotalPages} onClick={() => setArchivoPage(p => Math.min(archivoTotalPages, p + 1))}>Siguiente</button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
