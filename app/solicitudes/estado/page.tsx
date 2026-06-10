'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, CheckCircle2, X, Bell, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import './status.css'

export default function RequestStatusPage() {
    const supabase = createClient()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('Todas')

    useEffect(() => {
        const fetchRequests = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let query = supabase.schema('nexus')
                .from('solicitudes')
                .select('*, solicitante:users!solicitante_id(nombre)')
                .is('closed_at', null)
                .order('created_at', { ascending: false })

            const { data } = await query
            if (data) setRequests(data)
            setLoading(false)
        }
        fetchRequests()
    }, [supabase])

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ticket.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter = filter === 'Todas' ||
            (filter === 'Pendientes' && r.estado_actual === 'Revisión') ||
            (filter === 'En Proceso' && r.estado_actual !== 'Revisión')
        return matchesSearch && matchesFilter
    })

    const getBadgeClass = (status: string) => {
        switch (status) {
            case 'Revisión': return 'badge-pending'
            case 'En Cotización': return 'badge-in-progress'
            case 'Aprobado': return 'badge-approved'
            default: return 'badge-in-progress'
        }
    }

    return (
        <div className="list-container">
            <Link href="/compras" className="btn-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#254153', fontWeight: 600, transition: 'opacity 0.2s' }}>
                <ArrowLeft size={16} /> Volver al submenú
            </Link>

            <h1 style={{ marginTop: '2rem', marginBottom: '2rem' }}>Estado General de Compras</h1>

            <div className="search-section">
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                        <input
                            type="text" className="form-control" style={{ paddingLeft: '3rem' }}
                            placeholder="Buscar por título o ticket..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <select
                    className="form-control" style={{ width: '200px' }}
                    value={filter} onChange={e => setFilter(e.target.value)}
                >
                    <option value="Todas">Todas</option>
                    <option value="Pendientes">Pendientes</option>
                    <option value="En Proceso">En Proceso</option>
                </select>
            </div>

            {loading ? (
                <p>Cargando solicitudes...</p>
            ) : (
                <div className="request-list-grid">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="list-card card animate-fade-in shadow-lg">
                            <div className="ticket-info">
                                <span className="ticket-id">{req.ticket}</span>
                                <span className="ticket-title">{req.titulo}</span>
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
                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.8 }}>
                                    <strong>Solicitante:</strong> {(req.solicitante as any)?.nombre}
                                </div>
                                <span className="ticket-meta">Creada el {new Date(req.created_at).toLocaleDateString()}</span>
                            </div>

                            <div className="badge-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <span className={`badge ${getBadgeClass(req.estado_actual)}`}>
                                    {req.estado_actual}
                                </span>
                                <span className={`badge ${
                                    req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? 'priority-urgente' : 
                                    req.prioridad === 'Media' ? 'priority-media' : 'priority-baja'
                                }`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem' }}>
                                    {req.prioridad === 'Urgente' && <Bell size={10} />}
                                    {req.prioridad === 'Alta' && <AlertCircle size={10} />}
                                    {req.prioridad}
                                </span>
                            </div>

                            <div className="ticket-actions">
                                <Link href={`/solicitudes/detalle/${req.id}`} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                                    Detalle
                                </Link>
                            </div>

                            {req.observacion_actual && (
                                <div className="observation-box" style={{ gridColumn: 'span 3' }}>
                                    <strong>Observación de Gestión:</strong> {req.observacion_actual}
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredRequests.length === 0 && <p style={{ textAlign: 'center', opacity: 0.5 }}>No se encontraron solicitudes.</p>}
                </div>
            )}
        </div>
    )
}
