'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
    Search, Filter, Calendar, User as UserIcon, Building2, Package, 
    CreditCard, CheckCircle2, X, Eye, CheckCircle, XCircle, 
    Truck, Wallet, Bell, AlertCircle, Clock, AlertTriangle, FileText,
    Paperclip, Trash2, Download, Image as ImageIcon
} from 'lucide-react'
import './admin.css'

export default function AdminDashboard() {
    const supabase = createClient()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [stats, setStats] = useState({ pending: 0, inProgress: 0, urgent: 0, readyToClose: 0 })
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [filterType, setFilterType] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [comments, setComments] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [attachedFiles, setAttachedFiles] = useState<any[]>([])
    const [isUploading, setIsUploading] = useState(false)

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

    const fetchComments = async (requestId: string) => {
        const { data } = await supabase.schema('nexus')
            .from('solicitud_estados_hist')
            .select(`
                *,
                actor:users!actor_id(nombre)
            `)
            .eq('solicitud_id', requestId)
            .order('created_at', { ascending: false })
        if (data) setComments(data)
    }

    const fetchDocuments = async (requestId: string) => {
        const { data } = await supabase.schema('nexus')
            .from('documentos')
            .select('*')
            .eq('solicitud_id', requestId)
            .order('created_at', { ascending: false })
        if (data) setAttachedFiles(data)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !selectedRequest) return

        setIsUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${selectedRequest.ticket}_${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `solicitudes/${selectedRequest.id}/${fileName}`

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('solicitudes_documentos')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // 2. Insert into Database
            const { error: dbError } = await supabase.schema('nexus')
                .from('documentos')
                .insert({
                    solicitud_id: selectedRequest.id,
                    filename: file.name,
                    path: filePath
                })

            if (dbError) throw dbError

            // 3. Refresh
            await fetchDocuments(selectedRequest.id)
            alert('Archivo adjuntado correctamente.')
        } catch (err: any) {
            console.error('Error uploading file:', err)
            alert('Error al subir archivo: ' + err.message)
        } finally {
            setIsUploading(false)
        }
    }

    const handleDownloadFile = async (path: string, filename: string) => {
        try {
            const { data, error } = await supabase.storage
                .from('solicitudes_documentos')
                .download(path)
            
            if (error) throw error
            
            const url = URL.createObjectURL(data)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
        } catch (err: any) {
            alert('Error al descargar: ' + err.message)
        }
    }

    const handleDeleteFile = async (id: string, path: string) => {
        if (!confirm('¿Eliminar este archivo?')) return
        
        try {
            // 1. Delete from Storage
            await supabase.storage.from('solicitudes_documentos').remove([path])
            
            // 2. Delete from DB
            const { error } = await supabase.schema('nexus')
                .from('documentos')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            
            // 3. Refresh
            if (selectedRequest) await fetchDocuments(selectedRequest.id)
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message)
        }
    }

    const handleUpdateStatus = async (id: string, newStatus: string, observation?: string) => {
        setIsSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            // 1. Update the request status and current observation
            const { error: updateError } = await supabase.schema('nexus')
                .from('solicitudes')
                .update({ 
                    estado_actual: newStatus,
                    observacion_actual: observation || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)

            if (updateError) throw updateError

            // 2. Insert into history if there is an observation
            if (observation?.trim()) {
                const { error: histError } = await supabase.schema('nexus')
                    .from('solicitud_estados_hist')
                    .insert({
                        solicitud_id: id,
                        estado: newStatus,
                        observacion: observation,
                        actor_id: user?.id
                    })
                if (histError) throw histError
            }

            // 3. Refresh data
            await fetchData()
            await fetchComments(id)
            setNewComment('')
            if (selectedRequest?.id === id) {
                setSelectedRequest((prev: any) => prev ? { ...prev, estado_actual: newStatus, observacion_actual: observation } : null)
            }
        } catch (err: any) {
            alert('Error al actualizar: ' + err.message)
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

    const filteredRequests = requests.filter(req => {
        const query = searchTerm.toLowerCase();
        const matchesSearch = 
            req.titulo.toLowerCase().includes(query) ||
            req.ticket.toLowerCase().includes(query) ||
            (req.solicitante as any)?.nombre.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;

        if (filterType === 'pending') return req.estado_actual === 'Revisión';
        if (filterType === 'in-progress') return req.estado_actual !== 'Revisión';
        if (filterType === 'urgent') return req.prioridad === 'Urgente';
        if (filterType === 'ready-to-close') return req.estado_actual === 'Aprobado';
        
        return true;
    });

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
                <div 
                    className={`stat-card glass shadow-lg clickable ${filterType === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'pending' ? 'all' : 'pending')}
                >
                    <span className="stat-label">Pendientes</span>
                    <span className="stat-value">{stats.pending}</span>
                    <Clock size={20} style={{ opacity: 0.5 }} />
                </div>
                <div 
                    className={`stat-card glass shadow-lg clickable ${filterType === 'in-progress' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'in-progress' ? 'all' : 'in-progress')}
                >
                    <span className="stat-label">En Proceso</span>
                    <span className="stat-value">{stats.inProgress}</span>
                    <CheckCircle size={20} style={{ opacity: 0.5 }} />
                </div>
                <div 
                    className={`stat-card glass shadow-lg clickable ${filterType === 'urgent' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'urgent' ? 'all' : 'urgent')}
                >
                    <span className="stat-label">Urgentes</span>
                    <span className="stat-value" style={{ color: '#ff4d4d' }}>{stats.urgent}</span>
                    <AlertTriangle size={20} style={{ color: '#ff4d4d' }} />
                </div>
                <div 
                    className={`stat-card glass shadow-lg clickable ${filterType === 'ready-to-close' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'ready-to-close' ? 'all' : 'ready-to-close')}
                >
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <h2 style={{ margin: 0 }}>Lista Maestra de Solicitudes</h2>
                        {filterType !== 'all' && (
                            <span className="badge priority-urgente" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                                Filtrando por: {
                                    filterType === 'pending' ? 'Pendientes' : 
                                    filterType === 'in-progress' ? 'En Proceso' : 
                                    filterType === 'urgent' ? 'Urgentes' : 'Listas para Cierre'
                                }
                                <X size={12} style={{ marginLeft: '0.5rem', cursor: 'pointer' }} onClick={() => setFilterType('all')} />
                            </span>
                        )}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="Buscar por ticket, título o solicitante..." 
                            style={{ paddingLeft: '2.5rem', width: '350px' }} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
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
                                <th>Responsable</th>
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
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                        No se encontraron solicitudes que coincidan con el filtro.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => (
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
                                        <td style={{ fontSize: '0.85rem' }}>
                                            {(req.responsable as any)?.nombre || 'Sin asignar'}
                                        </td>
                                        <td>
                                            <span style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '0.4rem', 
                                                fontSize: '0.7rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '1rem',
                                                fontWeight: 600,
                                                background: req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d22' : req.prioridad === 'Media' ? '#f59e0b22' : '#10b98122',
                                                color: req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d' : req.prioridad === 'Media' ? '#f59e0b' : '#10b981',
                                                border: `1px solid ${req.prioridad === 'Urgente' || req.prioridad === 'Alta' ? '#ff4d4d' : req.prioridad === 'Media' ? '#f59e0b' : '#10b981'}`
                                            }}>
                                                {req.prioridad === 'Urgente' && <Bell size={12} />}
                                                {req.prioridad === 'Alta' && <AlertCircle size={12} />}
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
                                                <option value="Aprobado">Aprobado</option>
                                                <option value="En Cotización">En Cotización</option>
                                                <option value="En Camino">En Camino</option>
                                                <option value="Completada">Completada</option>
                                                <option value="Rechazada">Rechazada</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="action-btn"
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    fetchComments(req.id);
                                                    fetchDocuments(req.id);
                                                    setNewComment('');
                                                }}
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
                    <div className="modal-content glass animate-scale-in" style={{ 
                        width: 'min(1000px, 98%)', 
                        maxHeight: '92vh', 
                        overflowY: 'auto', 
                        overflowX: 'hidden',
                        position: 'relative', 
                        padding: '2.5rem 2.5rem 5rem 2.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        boxSizing: 'border-box'
                    }}>
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
                            <div className={`badge ${
                                selectedRequest.prioridad === 'Urgente' || selectedRequest.prioridad === 'Alta' ? 'priority-urgente' : 
                                selectedRequest.prioridad === 'Media' ? 'priority-media' : 'priority-baja'
                            }`} style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {selectedRequest.prioridad === 'Urgente' && <Bell size={16} />}
                                {selectedRequest.prioridad === 'Alta' && <AlertCircle size={16} />}
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

                        <div className="management-actions glass" style={{ 
                            marginTop: '3rem', 
                            padding: '2rem', 
                            border: '1px solid hsla(var(--primary), 0.2)', 
                            borderRadius: '1.5rem', 
                            background: 'rgba(255,255,255,0.015)',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)',
                            boxSizing: 'border-box'
                        }}>
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
                                    <option value="Aprobado">Aprobado</option>
                                    <option value="En Cotización">En Cotización</option>
                                    <option value="En Camino">En Camino</option>
                                    <option value="Completada">Completada</option>
                                    <option value="Rechazada">Rechazada</option>
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Historial de Comentarios</label>
                                <div className="comments-history" style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {comments.length === 0 ? (
                                        <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>No hay comentarios registrados.</p>
                                    ) : (
                                        comments.map(c => (
                                            <div key={c.id} style={{ borderLeft: '3px solid hsla(var(--primary), 0.5)', paddingLeft: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                    <span style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>{c.actor?.nombre || 'Sistema'}</span>
                                                    <span style={{ opacity: 0.5 }}>{new Date(c.created_at).toLocaleString()}</span>
                                                </div>
                                                <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{c.observacion}</div>
                                                <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', opacity: 0.7 }}>Estado: {c.estado}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="attachments-section" style={{ marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <label style={{ margin: 0 }}>Archivos y Cotizaciones</label>
                                        <label className="action-btn" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '0.8rem' }}>
                                            <Paperclip size={14} />
                                            {isUploading ? 'Subiendo...' : 'Adjuntar Archivo'}
                                            <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    
                                    <div className="files-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                        {attachedFiles.length === 0 ? (
                                            <p style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0.5rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                                No hay archivos adjuntos.
                                            </p>
                                        ) : (
                                            attachedFiles.map(file => (
                                                <div key={file.id} className="file-card glass" style={{ padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '0.4rem' }}>
                                                        {file.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon size={18} /> : <FileText size={18} />}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
                                                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{new Date(file.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                        <button onClick={() => handleDownloadFile(file.path, file.filename)} style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }} title="Descargar">
                                                            <Download size={14} />
                                                        </button>
                                                        <button onClick={() => handleDeleteFile(file.id, file.path)} style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, color: '#ff4d4d' }} title="Eliminar">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <label>Nuevo Comentario / Observación</label>
                                <textarea
                                    className="form-control"
                                    rows={3}
                                    placeholder="Escribe comentarios sobre el avance..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                />
                                <button
                                    className="action-btn"
                                    style={{ 
                                        marginTop: '1rem', 
                                        width: 'auto', 
                                        display: 'block', 
                                        margin: '1rem auto 0',
                                        background: 'hsl(var(--primary))',
                                        color: 'white',
                                        padding: '0.6rem 2rem',
                                        borderRadius: '0.5rem',
                                        fontWeight: 600
                                    }}
                                    onClick={() => handleUpdateStatus(selectedRequest.id, selectedRequest.estado_actual, newComment)}
                                    disabled={isSaving || !newComment.trim()}
                                >
                                    {isSaving ? 'Guardando...' : 'Insertar Comentario'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    className="btn-primary"
                                    style={{ 
                                        width: 'auto', 
                                        background: '#10b981', 
                                        borderColor: '#10b981',
                                        fontSize: '0.8rem',
                                        padding: '0.5rem 1rem'
                                    }}
                                    onClick={() => handleCloseRequest(selectedRequest.id)}
                                    disabled={isSaving || selectedRequest.estado_actual === 'Revisión'}
                                >
                                    Finalizar Gestión (Mover a Historial)
                                </button>
                                {selectedRequest.estado_actual === 'Revisión' && (
                                    <p style={{ fontSize: '0.7rem', opacity: 0.5, textAlign: 'right', marginTop: '0.25rem' }}>
                                        El estado debe ser distinto a "Revisión" para finalizar.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
