'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Search, MoreVertical, CheckCircle, XCircle, Clock, AlertTriangle, FileText, User as UserIcon, Building2, Wallet, Calendar, X } from 'lucide-react'
import './admin.css'

export default function AdminDashboard() {
    const supabase = createClient()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stats, setStats] = useState({ pending: 0, inProgress: 0, urgent: 0, readyToClose: 0 })
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const router = useRouter()

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return window.location.href = '/login'

            const { data: profile } = await supabase.schema('nexus').from('users').select('rol').eq('id', user.id).single()
            if (profile?.rol !== 'ADMIN') window.location.href = '/home'
        }
        checkRole()
        fetchData()
    }, [supabase])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data, error: fetchError } = await supabase.schema('nexus')
                .from('solicitudes')
                .select(`
                    *,
                    solicitante:users!solicitante_id(nombre, area, email),
                    centro_costos:centros_costos(nombre, codigo),
                    cuenta_contable:cuentas_contables(nombre, codigo),
                    responsable:users!responsable_id(nombre)
                `)
                .is('closed_at', null)
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            if (data) {
                setRequests(data)
                setStats({
                    pending: data.filter(r => r.estado_actual === 'Revisión').length,
                    inProgress: data.filter(r => r.estado_actual !== 'Revisión').length,
                    urgent: data.filter(r => r.prioridad === 'Urgente').length,
                    readyToClose: data.filter(r => r.estado_actual === 'Aprobado').length
                })
            }
        } catch (err: any) {
            console.error('Error fetching data:', err)
            setError(err.message || 'Error al cargar los datos. Verifica las políticas de seguridad (RLS).')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (id: string, newStatus: string, observation?: string) => {
        setIsSaving(true)
        const { error } = await supabase.schema('nexus')
            .from('solicitudes')
            .update({
                estado_actual: newStatus,
                observacion_actual: observation || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (!error) {
            await fetchData()
            if (selectedRequest?.id === id) {
                setSelectedRequest((prev: any) => prev ? { ...prev, estado_actual: newStatus, observacion_actual: observation } : null)
            }
        }
        setIsSaving(false)
    }

    const handleCloseRequest = async (id: string) => {
        if (!confirm('¿Estás seguro de finalizar la gestión de esta solicitud? Se moverá al historial.')) return

        setIsSaving(true)
        const { error } = await supabase.schema('nexus')
            .from('solicitudes')
            .update({
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (!error) {
            await fetchData()
            setSelectedRequest(null)
        }
        setIsSaving(false)
    }

    return (
        <div className="admin-container animate-fade-in">
            <nav className="admin-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <img src="/logo.png" alt="Nexus" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', border: '2px solid var(--glass-border)' }} />
                    <a onClick={() => router.push('/home')} style={{ cursor: 'pointer' }}>Volver al Menú</a>
                    <a onClick={() => router.push('/admin')} className="active" style={{ cursor: 'pointer' }}>Gestión</a>
                    <a onClick={() => router.push('/reports')} style={{ cursor: 'pointer' }}>Reportes</a>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut()
                            router.push('/login')
                        }}
                        className="action-btn"
                        style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive))' }}
                    >
                        Salir
                    </button>
                </div>
            </nav>

            <div className="stats-grid">
                <div className="stat-card glass shadow-lg">
                    <span className="stat-label">Pendientes</span>
                    <span className="stat-value">{stats.pending}</span>
                    <Clock size={20} style={{ opacity: 0.5 }} />
                </div>
                <div className="stat-card glass shadow-lg">
                    <span className="stat-label">En Proceso</span>
                    <span className="stat-value">{stats.inProgress}</span>
                    <CheckCircle size={20} style={{ opacity: 0.5 }} />
                </div>
                <div className="stat-card glass shadow-lg">
                    <span className="stat-label">Urgentes</span>
                    <span className="stat-value" style={{ color: 'hsl(var(--destructive))' }}>{stats.urgent}</span>
                    <AlertTriangle size={20} style={{ color: 'hsl(var(--destructive))' }} />
                </div>
                <div className="stat-card glass shadow-lg">
                    <span className="stat-label">Listas para Cierre</span>
                    <span className="stat-value" style={{ color: '#10b981' }}>{stats.readyToClose}</span>
                    <CheckCircle size={20} style={{ color: '#10b981' }} />
                </div>
            </div>

            <div className="card glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', marginBottom: '3rem' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: '2px solid var(--glass-border)' }} />
                    <h1 style={{ margin: 0 }}>Reportes de Gestión</h1>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
                    <h2>Lista Maestra de Solicitudes</h2>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        <input type="text" className="form-control" placeholder="Buscar..." style={{ paddingLeft: '2.5rem', width: '300px' }} />
                    </div>
                </div>

                <div className="admin-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Título</th>
                                <th>Solicitante</th>
                                <th>Cant.</th>
                                <th>Prioridad</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                        Cargando solicitudes...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--destructive))' }}>
                                        <AlertTriangle size={32} style={{ marginBottom: '1rem', display: 'block', margin: '0 auto' }} />
                                        <p>{error}</p>
                                        <button onClick={fetchData} className="btn-primary" style={{ marginTop: '1rem' }}>Reintentar</button>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                        No se encontraron solicitudes pendientes.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id}>
                                        <td style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>{req.ticket}</td>
                                        <td>{req.titulo}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>{(req.solicitante as any)?.nombre}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{(req.solicitante as any)?.area}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 500 }}>{req.cantidad} {req.unidad_medida || 'Unid.'}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${req.prioridad === 'Urgente' ? 'badge-rejected' : 'badge-pending'}`}>
                                                {req.prioridad}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className="form-control"
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                value={req.estado_actual}
                                                onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                                            >
                                                <option value="Revisión">Revisión</option>
                                                <option value="En Cotización">En Cotización</option>
                                                <option value="Aprobado">Aprobado</option>
                                                <option value="En Camino">En Camino</option>
                                                <option value="Completada">Completada</option>
                                                <option value="Rechazada">Rechazada</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="action-btn"
                                                onClick={() => setSelectedRequest(req)}
                                                style={{ background: 'hsla(var(--primary), 0.1)', color: 'hsl(var(--primary))' }}
                                            >
                                                Gestionar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Gestión */}
            {selectedRequest && (
                <div className="modal-overlay animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, padding: '2rem' }}>
                    <div className="modal-content glass animate-scale-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '2.5rem' }}>
                        <button
                            className="close-btn"
                            onClick={() => setSelectedRequest(null)}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.5 }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                            <div>
                                <span className="ticket-badge" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>{selectedRequest.ticket}</span>
                                <h2 style={{ margin: 0 }}>{selectedRequest.titulo}</h2>
                            </div>
                            <div className={`badge ${selectedRequest.prioridad === 'Urgente' ? 'badge-rejected' : 'badge-pending'}`} style={{ padding: '0.5rem 1rem' }}>
                                {selectedRequest.prioridad}
                            </div>
                        </div>

                        <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
                            <div className="detail-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <UserIcon size={14} /> Solicitante
                                </label>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {selectedRequest.solicitante?.nombre} ({selectedRequest.solicitante?.area})
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>{selectedRequest.solicitante?.email}</div>
                            </div>

                            <div className="detail-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <Building2 size={14} /> Centro de Costos
                                </label>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {selectedRequest.centro_costos ? `[${selectedRequest.centro_costos.codigo || 'N/A'}] ${selectedRequest.centro_costos.nombre}` : 'Sin centro de costos'}
                                </div>
                            </div>

                            <div className="detail-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <Wallet size={14} /> Cuenta Contable
                                </label>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {selectedRequest.cuenta_contable?.codigo} - {selectedRequest.cuenta_contable?.nombre}
                                </div>
                            </div>

                            <div className="detail-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <Calendar size={14} /> Fecha Requerida
                                </label>
                                <div style={{ fontSize: '1rem', fontWeight: 500 }}>
                                    {selectedRequest.fecha_entrega_requerida ? new Date(selectedRequest.fecha_entrega_requerida).toLocaleDateString() : 'No especificada'}
                                </div>
                            </div>

                            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                    <FileText size={14} /> Propósito / Contexto
                                </label>
                                <div style={{ fontSize: '0.95rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem' }}>
                                    {selectedRequest.proposito || 'Sin descripción adicional.'}
                                </div>
                            </div>
                        </div>

                        <div className="management-actions glass" style={{ padding: '1.5rem', border: '1px solid var(--glass-border)', borderRadius: '1rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1rem' }}>Acciones de Gestión</h3>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Cambiar Estado Actual</label>
                                <select
                                    className="form-control"
                                    value={selectedRequest.estado_actual}
                                    onChange={(e) => handleUpdateStatus(selectedRequest.id, e.target.value, selectedRequest.observacion_actual)}
                                    disabled={isSaving}
                                >
                                    <option value="Revisión">Revisión</option>
                                    <option value="En Cotización">En Cotización</option>
                                    <option value="Aprobado">Aprobado</option>
                                    <option value="En Camino">En Camino</option>
                                    <option value="Completada">Completada</option>
                                    <option value="Rechazada">Rechazada</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Observaciones para el Solicitante</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="Escribe comentarios sobre el avance..."
                                    value={selectedRequest.observacion_actual || ''}
                                    onChange={(e) => setSelectedRequest({ ...selectedRequest, observacion_actual: e.target.value })}
                                />
                                <button
                                    className="action-btn"
                                    style={{ marginTop: '0.5rem', width: '100%' }}
                                    onClick={() => handleUpdateStatus(selectedRequest.id, selectedRequest.estado_actual, selectedRequest.observacion_actual)}
                                    disabled={isSaving}
                                >
                                    {isSaving ? 'Guardando...' : 'Guardar Observación'}
                                </button>
                            </div>

                            <button
                                className="btn-primary"
                                style={{ width: '100%', background: '#10b981', borderColor: '#10b981' }}
                                onClick={() => handleCloseRequest(selectedRequest.id)}
                                disabled={isSaving || selectedRequest.estado_actual === 'Revisión'}
                            >
                                Finalizar Gestión (Mover a Historial)
                            </button>
                            {selectedRequest.estado_actual === 'Revisión' && (
                                <p style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'center', marginTop: '0.5rem' }}>
                                    El estado debe ser distinto a "Revisión" para finalizar.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
