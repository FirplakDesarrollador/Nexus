'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Bell, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import '../estado/status.css'

export default function RequestHistoryPage() {
    const supabase = createClient()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [tab, setTab] = useState('Todos')

    useEffect(() => {
        const fetchRequests = async () => {
            const { data } = await supabase.schema('nexus')
                .from('solicitudes')
                .select(`
                    *,
                    solicitante:solicitante_id(nombre),
                    responsable:responsable_id(nombre)
                `)
                .order('created_at', { ascending: false })

            if (data) setRequests(data)
            setLoading(false)
        }
        fetchRequests()
    }, [supabase])

    const tabs = ['Todos', 'Aprobado', 'Revisión', 'En Cotización', 'En Camino', 'Completada', 'Rechazada']

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ticket.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.solicitante?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.responsable?.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchesTab = tab === 'Todos' || r.estado_actual === tab
        return matchesSearch && matchesTab
    })

    return (
        <div className="list-container">
            <Link href="/compras" className="btn-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#254153', fontWeight: 600, transition: 'opacity 0.2s' }}>
                <ArrowLeft size={16} /> Volver al submenú
            </Link>

            <h1 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Historial de compras</h1>
            <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2.5rem' }}>Consulta tus procesos finalizados.</p>

            <div className="tabs" style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                {tabs.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            background: tab === t ? 'hsl(var(--primary))' : 'rgba(37, 65, 83, 0.05)',
                            color: tab === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--primary))',
                            border: tab === t ? '1px solid hsl(var(--primary))' : '1px solid rgba(37, 65, 83, 0.15)',
                            borderRadius: '2rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            padding: '0.4rem 1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            outline: 'none',
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <div className="search-section">
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                    <input
                        type="text" className="form-control" style={{ paddingLeft: '3rem' }}
                        placeholder="Buscar por artículo o ticket..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <p>Cargando historial...</p>
            ) : (
                <div className="request-list-grid">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="list-card card animate-fade-in" style={{ opacity: 0.9 }}>
                            <div className="ticket-info">
                                <span className="ticket-id">{req.ticket}</span>
                                <span className="ticket-title">{req.titulo}</span>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>
                                    Solicitado por: <strong>{req.solicitante?.nombre}</strong>
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.15rem' }}>
                                    Responsable: <strong>{req.responsable?.nombre || 'Sin asignar'}</strong>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                    <span className="ticket-qty" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                        {req.cantidad} {req.unidad_medida || 'Unid.'}
                                    </span>
                                    {req.presupuesto_estimado != null && (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#254153', background: 'rgba(37, 65, 83, 0.05)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                            Presupuesto: ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(req.presupuesto_estimado)}
                                        </span>
                                    )}
                                </div>
                                <span className="ticket-meta" style={{ display: 'block', marginTop: '0.25rem' }}>
                                    {req.closed_at ? `Cerrada el ${new Date(req.closed_at).toLocaleDateString()}` : `Creada el ${new Date(req.created_at).toLocaleDateString()}`}
                                </span>
                            </div>

                            <div className="badge-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <span className={`badge ${
                                    req.estado_actual === 'Completada' ? 'badge-approved' : 
                                    req.estado_actual === 'Rechazada' ? 'badge-rejected' : 'badge-pending'
                                }`}>
                                    {req.estado_actual}
                                </span>
                                {req.prioridad && (
                                    <span style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.3rem', 
                                        fontSize: '0.65rem',
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '1rem',
                                        fontWeight: 600,
                                        background: req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d22' : req.prioridad === 'Media' ? '#f59e0b22' : '#10b98122',
                                        color: req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d' : req.prioridad === 'Media' ? '#f59e0b' : '#10b981',
                                        border: `1px solid ${req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d' : req.prioridad === 'Media' ? '#f59e0b' : '#10b981'}`
                                    }}>
                                        {req.prioridad === 'Urgente' && <Bell size={10} />}
                                        {req.prioridad === 'Alta' && <AlertCircle size={10} />}
                                        {req.prioridad}
                                    </span>
                                )}
                            </div>

                            <div className="ticket-actions">
                                <Link href={`/solicitudes/detalle/${req.id}`} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                                    Detalle
                                </Link>
                            </div>

                            {req.motivo_rechazo && req.estado_actual === 'Rechazada' && (
                                <div className="observation-box" style={{ gridColumn: 'span 3', borderColor: 'hsl(var(--destructive))' }}>
                                    <strong>Motivo de Rechazo:</strong> {req.motivo_rechazo}
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredRequests.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>Sin registros en el historial.</p>}
                </div>
            )}
        </div>
    )
}
