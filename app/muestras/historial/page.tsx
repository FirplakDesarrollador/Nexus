'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Search, History, FileText, ExternalLink,
    RefreshCw, ChevronDown, User
} from 'lucide-react'
import '../../home/home.css'
import '../mis-muestras/muestras-list.css'


const ESTADOS = ['Todos', 'Pendiente', 'En Prueba', 'Aprobada', 'Rechazada']

function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
        'Pendiente': 'badge-pending',
        'En Prueba': 'badge-in-progress',
        'Aprobada': 'badge-approved',
        'Rechazada': 'badge-rejected'
    }
    return <span className={`badge ${map[estado] ?? 'badge-pending'}`}>{estado}</span>
}

export default function HistorialMuestrasPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [muestras, setMuestras] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [estadoFilter, setEstadoFilter] = useState('Todos')
    const [expanded, setExpanded] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
            const { data: profileData } = await supabase.schema('nexus')
                .from('users').select('*').eq('id', user.id).maybeSingle()
            if (profileData) setProfile(profileData)
            await fetchAll()
        }
        init()
    }, [supabase, router])

    const fetchAll = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .schema('nexus')
            .from('muestras')
            .select(`
                *,
                muestra_estados_hist(estado, observacion, evidencia_url, aprobador_nombre, aprobador_email, created_at),
                solicitante:solicitante_id(nombre, email)
            `)
            .order('created_at', { ascending: false })

        if (!error && data) setMuestras(data)
        setLoading(false)
    }

    const filtered = muestras.filter(m => {
        const matchSearch =
            m.nombre_producto.toLowerCase().includes(search.toLowerCase()) ||
            m.ticket.toLowerCase().includes(search.toLowerCase()) ||
            m.proveedor.toLowerCase().includes(search.toLowerCase()) ||
            (m.solicitante?.nombre ?? m.solicitante_nombre ?? '').toLowerCase().includes(search.toLowerCase())
        const matchEstado = estadoFilter === 'Todos' || m.estado === estadoFilter
        return matchSearch && matchEstado
    })

    if (!user) return <div className="home-container"><p>Cargando...</p></div>

    return (
        <div className="home-container">
            <header style={{ marginBottom: '2rem' }}>
                <Link href="/muestras" className="back-link-plain">
                    <ArrowLeft size={16} /> Volver a Muestras
                </Link>
            </header>

            <div className="list-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="list-icon" style={{ background: 'hsla(188,13%,52%,0.12)', color: 'hsl(var(--secondary))' }}>
                        <History size={26} />
                    </div>
                    <div>
                        <h1>Historial de Muestras</h1>
                        <p>Registro completo de todas las muestras en el sistema</p>
                    </div>
                </div>
                <button className="refresh-btn" onClick={fetchAll} title="Actualizar">
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-wrap">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por ticket, producto, proveedor o solicitante..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="estado-tabs">
                    {ESTADOS.map(e => (
                        <button
                            key={e}
                            className={`estado-tab ${estadoFilter === e ? 'active' : ''}`}
                            onClick={() => setEstadoFilter(e)}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-pill">
                    <span className="stat-num">{muestras.length}</span>
                    <span className="stat-label">Total</span>
                </div>
                {['Pendiente', 'En Prueba', 'Aprobada', 'Rechazada'].map(e => (
                    <div key={e} className="stat-pill">
                        <span className="stat-num">{muestras.filter(m => m.estado === e).length}</span>
                        <span className="stat-label">{e}</span>
                    </div>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="empty-state">
                    <RefreshCw size={32} className="spin" />
                    <p>Cargando historial...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <History size={40} />
                    <p>No hay muestras que coincidan con los filtros.</p>
                </div>
            ) : (
                <div className="muestras-list">
                    {filtered.map(m => (
                        <div key={m.id} className="muestra-card">
                            <div className="muestra-card-header" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                                <div className="muestra-card-main">
                                    <div className="ticket-code">{m.ticket}</div>
                                    <div className="muestra-info">
                                        <strong>{m.nombre_producto}</strong>
                                        <span>{m.proveedor} · {m.categoria} · {m.cantidad} {m.unidad_medida}</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                                            <User size={12} /> {m.solicitante?.nombre ?? m.solicitante?.email ?? m.solicitante_nombre ?? '—'}
                                        </span>
                                    </div>
                                </div>
                                <div className="muestra-card-right">
                                    <EstadoBadge estado={m.estado} />
                                    <span className="muestra-date">
                                        {new Date(m.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                    <ChevronDown
                                        size={18}
                                        style={{ transform: expanded === m.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'hsl(var(--muted-foreground))' }}
                                    />
                                </div>
                            </div>

                            {expanded === m.id && (
                                <div className="muestra-card-body animate-fade-in">
                                    <div className="detail-grid">
                                        {m.marca && <div className="detail-item"><span>Marca</span><strong>{m.marca}</strong></div>}
                                        {m.referencia && <div className="detail-item"><span>Referencia</span><strong>{m.referencia}</strong></div>}
                                        {m.proposito_homologacion && <div className="detail-item"><span>Propósito</span><strong>{m.proposito_homologacion}</strong></div>}
                                        <div className="detail-item"><span>Solicitante</span><strong>{m.solicitante?.nombre ?? m.solicitante?.email ?? m.solicitante_nombre ?? '—'}</strong></div>
                                        {m.aplicacion && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Aplicación</span><strong>{m.aplicacion}</strong></div>}
                                        {m.descripcion && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Descripción</span><strong>{m.descripcion}</strong></div>}
                                        {m.ensayos_efectuados && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Ensayos (Migración)</span><strong>{m.ensayos_efectuados}</strong></div>}
                                        {m.resultados && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Resultados (Migración)</span><strong>{m.resultados}</strong></div>}
                                        {m.conclusiones_legacy && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Conclusiones (Migración)</span><strong>{m.conclusiones_legacy}</strong></div>}
                                    </div>

                                    {(m.ficha_tecnica_url || m.evidencia_url) && (
                                        <div className="docs-row">
                                            {m.ficha_tecnica_url && (
                                                <a href={m.ficha_tecnica_url} target="_blank" rel="noopener noreferrer" className="doc-link">
                                                    <FileText size={14} /> Ficha Técnica <ExternalLink size={12} />
                                                </a>
                                            )}
                                            {m.evidencia_url && (
                                                <a href={m.evidencia_url} target="_blank" rel="noopener noreferrer" className="doc-link">
                                                    <FileText size={14} /> Evidencia <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {m.muestra_estados_hist && m.muestra_estados_hist.length > 0 && (
                                        <div className="hist-section">
                                            <strong>Historial de estados</strong>
                                            <div className="hist-timeline">
                                                {[...m.muestra_estados_hist]
                                                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                    .map((h: any, idx: number) => (
                                                        <div key={idx} className="hist-item">
                                                            <div className="hist-dot" />
                                                            <div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                    <EstadoBadge estado={h.estado} />
                                                                    {h.aprobador_nombre && (h.estado === 'Aprobada' || h.estado === 'Rechazada') && (
                                                                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                                                            por {h.aprobador_nombre}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {h.observacion && <p>{h.observacion}</p>}
                                                                <span>{new Date(h.created_at).toLocaleString('es-CO')}</span>
                                                                {h.evidencia_url && (
                                                                    <a href={h.evidencia_url} target="_blank" rel="noopener noreferrer" className="doc-link" style={{ marginTop: '0.3rem', width: 'fit-content' }}>
                                                                        <FileText size={12} /> Ver evidencia <ExternalLink size={11} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Panel admin: cambiar estado */}
                                    {profile?.rol === 'ADMIN' && (
                                        <AdminPanel muestra={m} userId={user.id} supabase={supabase} onRefresh={fetchAll} />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function AdminPanel({ muestra, userId, supabase, onRefresh }: any) {
    const [nuevoEstado, setNuevoEstado] = useState(muestra.estado)
    const [observacion, setObservacion] = useState('')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        await supabase.schema('nexus').from('muestras')
            .update({ estado: nuevoEstado })
            .eq('id', muestra.id)

        await supabase.schema('nexus').from('muestra_estados_hist').insert({
            muestra_id: muestra.id,
            estado: nuevoEstado,
            observacion: observacion || null,
            actor_id: userId
        })
        setSaving(false)
        setObservacion('')
        onRefresh()
    }

    return (
        <div className="admin-panel">
            <strong>⚙ Panel Admin — Cambiar Estado</strong>
            <div className="admin-row">
                <select
                    className="form-control"
                    value={nuevoEstado}
                    onChange={e => setNuevoEstado(e.target.value)}
                    style={{ maxWidth: 200 }}
                >
                    {['Pendiente', 'En Prueba', 'Aprobada', 'Rechazada'].map(e => (
                        <option key={e} value={e}>{e}</option>
                    ))}
                </select>
                <input
                    type="text"
                    className="form-control"
                    placeholder="Observación (opcional)"
                    value={observacion}
                    onChange={e => setObservacion(e.target.value)}
                />
                <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ whiteSpace: 'nowrap' }}>
                    {saving ? 'Guardando...' : 'Actualizar'}
                </button>
            </div>
        </div>
    )
}
