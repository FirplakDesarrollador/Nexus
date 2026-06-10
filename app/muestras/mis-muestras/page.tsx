'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Search, Filter, ClipboardList,
    FileText, ExternalLink, RefreshCw, ChevronDown
} from 'lucide-react'
import '../../home/home.css'
import './muestras-list.css'

const ESTADOS = ['Todos', 'Pendiente', 'En Revisión', 'En Prueba', 'Aprobada', 'Rechazada']

function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, string> = {
        'Pendiente': 'badge-pending',
        'En Revisión': 'badge-in-progress',
        'En Prueba': 'badge-in-progress',
        'Aprobada': 'badge-approved',
        'Rechazada': 'badge-rejected'
    }
    return <span className={`badge ${map[estado] ?? 'badge-pending'}`}>{estado}</span>
}

export default function MisMuestrasPage() {
    const [user, setUser] = useState<any>(null)
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
            await fetchMuestras(user.id)
        }
        init()
    }, [supabase, router])

    const fetchMuestras = async (userId: string) => {
        setLoading(true)
        const { data, error } = await supabase
            .schema('nexus')
            .from('muestras')
            .select(`*, muestra_estados_hist(estado, observacion, created_at)`)
            .eq('solicitante_id', userId)
            .order('created_at', { ascending: false })

        if (!error && data) setMuestras(data)
        setLoading(false)
    }

    const filtered = muestras.filter(m => {
        const matchSearch =
            m.nombre_producto.toLowerCase().includes(search.toLowerCase()) ||
            m.ticket.toLowerCase().includes(search.toLowerCase()) ||
            m.proveedor.toLowerCase().includes(search.toLowerCase())
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

            {/* Header */}
            <div className="list-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="list-icon"><ClipboardList size={26} /></div>
                    <div>
                        <h1>Mis Muestras</h1>
                        <p>Seguimiento de tus muestras registradas para homologación</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className="refresh-btn"
                        onClick={() => user && fetchMuestras(user.id)}
                        title="Actualizar"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <Link href="/muestras/nueva" className="btn-primary">
                        + Nueva Muestra
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-wrap">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por ticket, producto o proveedor..."
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
                {['Pendiente', 'En Revisión', 'En Prueba', 'Aprobada', 'Rechazada'].map(e => (
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
                    <p>Cargando muestras...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <ClipboardList size={40} />
                    <p>{search || estadoFilter !== 'Todos' ? 'No hay muestras que coincidan con los filtros.' : 'Aún no tienes muestras registradas.'}</p>
                    {!search && estadoFilter === 'Todos' && (
                        <Link href="/muestras/nueva" className="btn-primary" style={{ marginTop: '1rem' }}>
                            Registrar primera muestra
                        </Link>
                    )}
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
                                        {m.aplicacion && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Aplicación</span><strong>{m.aplicacion}</strong></div>}
                                        {m.descripcion && <div className="detail-item" style={{ gridColumn: '1/-1' }}><span>Descripción</span><strong>{m.descripcion}</strong></div>}
                                    </div>

                                    {/* Documentos */}
                                    {(m.ficha_tecnica_url || m.evidencia_url) && (
                                        <div className="docs-row">
                                            {m.ficha_tecnica_url && (
                                                <a href={m.ficha_tecnica_url} target="_blank" rel="noopener noreferrer" className="doc-link">
                                                    <FileText size={14} />
                                                    Ficha Técnica
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                            {m.evidencia_url && (
                                                <a href={m.evidencia_url} target="_blank" rel="noopener noreferrer" className="doc-link">
                                                    <FileText size={14} />
                                                    Evidencia
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Historial de estados */}
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
                                                                <EstadoBadge estado={h.estado} />
                                                                {h.observacion && <p>{h.observacion}</p>}
                                                                <span>{new Date(h.created_at).toLocaleString('es-CO')}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
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
