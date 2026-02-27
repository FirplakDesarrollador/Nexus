'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            let query = supabase.schema('nexus')
                .from('solicitudes')
                .select('*')
                .eq('solicitante_id', user.id)
                .not('closed_at', 'is', null)
                .order('closed_at', { ascending: false })

            const { data } = await query
            if (data) setRequests(data)
            setLoading(false)
        }
        fetchRequests()
    }, [supabase])

    const filteredRequests = requests.filter(r => {
        const matchesSearch = r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.ticket.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesTab = tab === 'Todos' ||
            (tab === 'Completados' && r.estado_actual === 'Completada') ||
            (tab === 'Rechazados' && r.estado_actual === 'Rechazada')
        return matchesSearch && matchesTab
    })

    return (
        <div className="list-container">
            <Link href="/home" className="btn-primary" style={{ background: 'transparent', color: 'white', padding: '0.5rem 0' }}>
                <ArrowLeft size={16} /> Volver al Inicio
            </Link>

            <h1 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Despensa de Historial</h1>
            <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2.5rem' }}>Consulta tus procesos finalizados.</p>

            <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                {['Todos', 'Completados', 'Rechazados'].map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`btn-primary ${tab === t ? '' : 'glass'}`}
                        style={{
                            background: tab === t ? 'hsl(var(--primary))' : 'transparent',
                            fontSize: '0.75rem',
                            padding: '0.5rem 1rem'
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
                        <div key={req.id} className="list-card card animate-fade-in" style={{ opacity: 0.8 }}>
                            <div className="ticket-info">
                                <span className="ticket-id">{req.ticket}</span>
                                <span className="ticket-title">{req.titulo}</span>
                                <span className="ticket-qty" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                    {req.cantidad} {req.unidad_medida || 'Unid.'}
                                </span>
                                <span className="ticket-meta">Cerrada el {new Date(req.closed_at).toLocaleDateString()}</span>
                            </div>

                            <div className="badge-container">
                                <span className={`badge ${req.estado_actual === 'Completada' ? 'badge-approved' : 'badge-rejected'}`}>
                                    {req.estado_actual}
                                </span>
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
