'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient, createTHClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Search, ClipboardList,
    FileText, ExternalLink, RefreshCw, ChevronDown,
    MessageSquare, ThumbsUp, ThumbsDown, AlertCircle, Loader2
} from 'lucide-react'
import '../../home/home.css'
import './muestras-list.css'

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

interface Empleado { nombreCompleto: string; correo_electronico: string }

function SearchableSelect({ options, value, onChange, placeholder }: {
    options: { id: string, label: string }[]
    value: string
    onChange: (val: string) => void
    placeholder: string
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(o => o.id === value)
    const filteredOptions = options.filter(o => (o.label || '').toLowerCase().includes(searchTerm.toLowerCase()))

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="searchable-select" ref={containerRef}>
            <div className={`select-trigger ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                {selectedOption ? (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedOption.label}</span>
                ) : (
                    <span className="placeholder">{placeholder}</span>
                )}
                <ChevronDown size={16} className={`arrow ${isOpen ? 'open' : ''}`} />
            </div>
            {isOpen && (
                <div className="select-dropdown animate-fade-in">
                    <div className="search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar empleado..."
                            autoFocus
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="options-list">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt.id}
                                    className={`option-item ${opt.id === value ? 'selected' : ''}`}
                                    onClick={() => { onChange(opt.id); setIsOpen(false); setSearchTerm('') }}
                                >
                                    {opt.label}
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

function RevisionPanel({ muestra, userId, supabase, empleados, onRefresh, onClose }: any) {
    const [observacion, setObservacion] = useState('')
    const [evidencia, setEvidencia] = useState<File | null>(null)
    const [aprobadorEmail, setAprobadorEmail] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const aprobadorOptions = Array.from(new Map(
        empleados
            .filter((e: Empleado) => e.correo_electronico && e.nombreCompleto)
            .map((e: Empleado) => [e.correo_electronico, e])
    ).values()).map((e: any) => ({ id: e.correo_electronico, label: e.nombreCompleto }))

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
    })

    const handleDecision = async (estadoFinal: 'Aprobada' | 'Rechazada') => {
        if (!evidencia) { setError('La evidencia es obligatoria para aprobar o rechazar la muestra.'); return }
        if (!aprobadorEmail) { setError('Selecciona quién aprueba o rechaza la muestra.'); return }

        setSaving(true)
        setError(null)
        try {
            const b64 = await fileToBase64(evidencia)
            const uploadRes = await fetch('/api/muestras/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: evidencia.name,
                    fileContent: b64,
                    folderPath: '/Shared Documents/Evidencias Homologacion de productos'
                })
            })
            const uploadData = await uploadRes.json()
            if (!uploadRes.ok) throw new Error(uploadData.error || 'No se pudo subir la evidencia')

            const aprobador = aprobadorOptions.find((o: any) => o.id === aprobadorEmail)

            const { error: updateError } = await supabase.schema('nexus').from('muestras')
                .update({ estado: estadoFinal })
                .eq('id', muestra.id)
            if (updateError) throw new Error(updateError.message)

            const { error: histError } = await supabase.schema('nexus').from('muestra_estados_hist').insert({
                muestra_id: muestra.id,
                estado: estadoFinal,
                observacion: observacion || null,
                evidencia_url: uploadData.url ?? null,
                aprobador_nombre: aprobador?.label ?? null,
                aprobador_email: aprobadorEmail,
                actor_id: userId
            })
            if (histError) throw new Error(histError.message)

            onClose()
            onRefresh()
        } catch (err: any) {
            setError(err.message || 'Error al guardar la revisión')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="admin-panel">
            <strong><MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} /> Retroalimentación</strong>

            {error && (
                <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#b91c1c', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem' }}>
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            <textarea
                className="form-control"
                placeholder="Comentarios sobre el ensayo/revisión (opcional)"
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                style={{ minHeight: 70, resize: 'vertical' }}
            />

            <div className="admin-row">
                <div style={{ flex: 1, minWidth: 220 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.3rem', color: 'hsl(var(--muted-foreground))' }}>
                        Evidencia <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                        type="file"
                        className="form-control"
                        onChange={e => setEvidencia(e.target.files?.[0] || null)}
                    />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '0.3rem', color: 'hsl(var(--muted-foreground))' }}>
                        Quién aprueba/rechaza <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <SearchableSelect
                        options={aprobadorOptions}
                        value={aprobadorEmail}
                        onChange={setAprobadorEmail}
                        placeholder="Buscar empleado..."
                    />
                </div>
            </div>

            <div className="admin-row" style={{ justifyContent: 'flex-end' }}>
                <button
                    className="action-btn"
                    onClick={() => handleDecision('Rechazada')}
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', borderColor: '#ef444455' }}
                >
                    {saving ? <Loader2 size={14} className="spin" /> : <ThumbsDown size={14} />} Rechazar
                </button>
                <button
                    className="action-btn"
                    onClick={() => handleDecision('Aprobada')}
                    disabled={saving}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', borderColor: '#10b98155' }}
                >
                    {saving ? <Loader2 size={14} className="spin" /> : <ThumbsUp size={14} />} Aprobar
                </button>
            </div>
        </div>
    )
}

export default function MisMuestrasPage() {
    const [user, setUser] = useState<any>(null)
    const [muestras, setMuestras] = useState<any[]>([])
    const [empleados, setEmpleados] = useState<Empleado[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [estadoFilter, setEstadoFilter] = useState('Todos')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [revisando, setRevisando] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
            await fetchMuestras()

            const thClient = createTHClient()
            const { data: thData, error: thError } = await thClient
                .from('empleados')
                .select('nombreCompleto, correo_electronico')
                .eq('activo', true)
                .order('nombreCompleto')
            if (thError) console.error('Error obteniendo empleados de TH:', thError.message || thError)
            setEmpleados(thData || [])
        }
        init()
    }, [supabase, router])

    const fetchMuestras = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .schema('nexus')
            .from('muestras')
            .select(`*, muestra_estados_hist(estado, observacion, evidencia_url, aprobador_nombre, aprobador_email, created_at), solicitante:solicitante_id(nombre, email)`)
            .order('created_at', { ascending: false })

        if (!error && data) setMuestras(data)
        setLoading(false)
    }

    const filtered = muestras.filter(m => {
        const solicitanteNombre = m.solicitante?.nombre ?? m.solicitante_nombre ?? ''
        const matchSearch =
            m.nombre_producto.toLowerCase().includes(search.toLowerCase()) ||
            m.ticket.toLowerCase().includes(search.toLowerCase()) ||
            m.proveedor.toLowerCase().includes(search.toLowerCase()) ||
            solicitanteNombre.toLowerCase().includes(search.toLowerCase())
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
                        <p>Revisión y aprobación de muestras registradas para homologación</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        className="refresh-btn"
                        onClick={() => fetchMuestras()}
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
                    <p>Cargando muestras...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <ClipboardList size={40} />
                    <p>{search || estadoFilter !== 'Todos' ? 'No hay muestras que coincidan con los filtros.' : 'Aún no hay muestras registradas.'}</p>
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
                                        <span>Solicitado por: {m.solicitante?.nombre ?? m.solicitante_nombre ?? '—'}</span>
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

                                    {/* Retroalimentar / Aprobar / Rechazar */}
                                    {revisando === m.id ? (
                                        <RevisionPanel
                                            muestra={m}
                                            userId={user.id}
                                            supabase={supabase}
                                            empleados={empleados}
                                            onRefresh={fetchMuestras}
                                            onClose={() => setRevisando(null)}
                                        />
                                    ) : (
                                        m.estado !== 'Aprobada' && m.estado !== 'Rechazada' && (
                                            <button
                                                className="action-btn"
                                                onClick={() => setRevisando(m.id)}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start' }}
                                            >
                                                <MessageSquare size={14} /> Retroalimentar
                                            </button>
                                        )
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
