'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, Filter } from 'lucide-react'
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
                .select('*')
                .eq('solicitante_id', user.id)
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
            <Link href="/home" className="btn-primary" style={{ background: 'transparent', color: 'white', padding: '0.5rem 0' }}>
                <ArrowLeft size={16} /> Volver al Inicio
            </Link>

            <h1 style={{ marginTop: '2rem', marginBottom: '2rem' }}>Estado de mis Compras</h1>

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
                                <span className="ticket-qty" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                    {req.cantidad} {req.unidad_medida || 'Unid.'}
                                </span>
                                <span className="ticket-meta">Creada el {new Date(req.created_at).toLocaleDateString()}</span>
                            </div>

                            <div className="badge-container">
                                <span className={`badge ${getBadgeClass(req.estado_actual)}`}>
                                    {req.estado_actual}
                                </span>
                            </div>

                            <div className="ticket-actions">
                                <Link href={`/solicitudes/detalle/${req.id}`} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                                    Detalle
                                </Link>
                            </div>

                            {req.observacion_actual && (
                                <div className="observation-box" style={{ gridColumn: 'span 3' }}>
                                    <strong>Observación de Nalle:</strong> {req.observacion_actual}
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
