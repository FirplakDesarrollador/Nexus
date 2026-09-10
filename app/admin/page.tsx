'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
    Search, Filter, Calendar, User as UserIcon, Building2, Package, 
    CreditCard, CheckCircle2, X, Eye, CheckCircle, XCircle, 
    Truck, Wallet, Bell, AlertCircle, Clock, AlertTriangle, FileText,
    Paperclip, Trash2, Download, Image as ImageIcon, TrendingUp, TrendingDown
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
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({ show: false, message: '', type: 'success' })
    const [fileToDelete, setFileToDelete] = useState<{id: string, path: string} | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [showCierreModal, setShowCierreModal] = useState(false)
    const [cierreForm, setCierreForm] = useState({ proveedor: '', valor_total_compra: '', cantidad_total: '', tipo_resultado: 'Saving' })
    const [plannerTask, setPlannerTask] = useState<any | null>(null)
    const [isLoadingPlanner, setIsLoadingPlanner] = useState(false)

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToastMessage({ show: true, message, type })
        setTimeout(() => {
            setToastMessage(prev => ({ ...prev, show: false }))
        }, 3000)
    }

    const syncPlanner = async (action: 'comment' | 'file' | 'complete', payload?: any) => {
        if (!plannerTask?.id) return;
        try {
            const res = await fetch('/api/planner/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: plannerTask.id, action, payload })
            });
            const data = await res.json();
            if (!res.ok) {
                console.error('Planner Sync Error Response:', data);
                showToast(`Error sincronizando con Planner: ${data.error}`, 'error');
            }
        } catch (err: any) {
            console.error('Error syncing planner fetch:', err);
            showToast(`Error de conexión con Planner: ${err.message}`, 'error');
        }
    }

    const router = useRouter()

    useEffect(() => {
        if (!selectedRequest) {
            setPlannerTask(null)
            return
        }
        
        const fetchPlannerTask = async () => {
            setIsLoadingPlanner(true)
            try {
                // cache-busting timestamp included
                const res = await fetch(`/api/planner?ticket=${selectedRequest.ticket}&_t=${Date.now()}`)
                const data = await res.json()
                if (data.found && data.task) {
                    setPlannerTask(data.task)

                    // Planner -> App: si ya se cerró/completó la tarea en Planner pero
                    // la solicitud sigue "abierta" en Nexus, refleja el estado aquí.
                    const yaFinalizada = ['Completada', 'Rechazada'].includes(selectedRequest.estado_actual)
                    if (data.task.percentComplete === 100 && !yaFinalizada) {
                        await handleUpdateStatus(
                            selectedRequest.id,
                            'Completada',
                            'Sincronizado automáticamente: la tarea fue marcada como completada en Microsoft Planner.'
                        )
                    }
                } else {
                    setPlannerTask(null)
                }
            } catch (err) {
                console.error('Error fetching planner task', err)
                setPlannerTask(null)
            } finally {
                setIsLoadingPlanner(false)
            }
        }

        fetchPlannerTask()
    }, [selectedRequest])

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return window.location.href = '/login'

            setCurrentUserId(user.id)
            const { data: profile } = await supabase.schema('nexus').from('users').select('rol').eq('id', user.id).single()
            if (profile?.rol !== 'ADMIN') window.location.href = '/compras'
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
            const formData = new FormData()
            formData.append('file', file)
            formData.append('solicitudId', selectedRequest.id)
            formData.append('ticket', selectedRequest.ticket)
            if (currentUserId) formData.append('uploadedBy', currentUserId)

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Error al subir archivo')
            }

            // Send storage path to backend — it generates the signed Supabase URL server-side
            await syncPlanner('file', { path: result.path, filename: file.name })

            await fetchDocuments(selectedRequest.id)
            showToast('¡Archivo adjuntado correctamente!')
        } catch (err: any) {
            console.error('Error uploading file:', err)
            showToast('Error al subir archivo: ' + err.message, 'error')
        } finally {
            setIsUploading(false)
            // Reset the file input
            e.target.value = ''
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
            showToast('Error al descargar: ' + err.message, 'error')
        }
    }

    const handleDeleteFile = (id: string, path: string) => {
        setFileToDelete({ id, path })
    }

    const confirmDeleteFile = async () => {
        if (!fileToDelete) return
        
        setIsDeleting(true)
        try {
            const response = await fetch('/api/upload', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentId: fileToDelete.id, path: fileToDelete.path })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Error al eliminar')

            if (selectedRequest) await fetchDocuments(selectedRequest.id)
            showToast('¡Archivo eliminado exitosamente!')
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error')
        } finally {
            setIsDeleting(false)
            setFileToDelete(null)
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

                // Sync with planner
                await syncPlanner('comment', { comment: observation })
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

    const handleCloseRequest = () => {
        setCierreForm({ proveedor: '', valor_total_compra: '', cantidad_total: '', tipo_resultado: 'Saving' })
        setShowCierreModal(true)
    }

    const handleConfirmCierre = async () => {
        if (!selectedRequest) return
        if (!cierreForm.proveedor.trim() || !cierreForm.valor_total_compra || !cierreForm.cantidad_total) {
            showToast('Completa todos los campos del cierre.', 'error')
            return
        }
        setIsSaving(true)
        try {
            const presupuesto = selectedRequest.presupuesto_estimado || 0
            const valorCompra = parseFloat(cierreForm.valor_total_compra)
            const tipo_resultado = cierreForm.tipo_resultado

            // 1. Insertar cierre
            const { error: cierreError } = await supabase.schema('nexus')
                .from('cierres_compra')
                .insert({
                    solicitud_id: selectedRequest.id,
                    proveedor: cierreForm.proveedor.trim(),
                    valor_total_compra: valorCompra,
                    cantidad_total: parseInt(cierreForm.cantidad_total),
                    tipo_resultado,
                    cerrado_por: currentUserId
                })
            if (cierreError) throw cierreError

            // 2. Cerrar solicitud
            const { error: closeError } = await supabase.schema('nexus')
                .from('solicitudes')
                .update({ closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', selectedRequest.id)
            if (closeError) throw closeError

            // 3. Close Planner task
            await syncPlanner('complete')
            setPlannerTask((prev: any) => prev ? { ...prev, percentComplete: 100 } : null)

            showToast(`¡Gestión finalizada! Resultado: ${tipo_resultado}`)
            setShowCierreModal(false)
            setSelectedRequest(null)
            await fetchData()
        } catch (err: any) {
            showToast('Error al finalizar: ' + err.message, 'error')
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
        <>
            {/* Custom Toast Notification */}
            <div className={`toast-notification ${toastMessage.show ? 'show' : ''} ${toastMessage.type}`}>
                {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{toastMessage.message}</span>
            </div>

            {/* Delete Confirmation Modal */}
            {fileToDelete && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: 'rgba(0,0,0,0.85)', 
                    zIndex: 9999,
                    padding: '2rem'
                }}>
                    <div className="modal-content glass animate-slide-up" style={{ 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        maxWidth: '400px', 
                        padding: '2rem', 
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                        color: 'hsl(var(--foreground))'
                    }}>
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            padding: '1rem',
                            borderRadius: '50%',
                            display: 'inline-flex',
                            marginBottom: '0.5rem'
                        }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>¿Eliminar archivo?</h2>
                        <p style={{ opacity: 0.7, fontSize: '0.9rem', margin: 0 }}>
                            Esta acción no se puede deshacer y el archivo será eliminado permanentemente de la base de datos.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1.5rem' }}>
                            <button 
                                className="action-btn" 
                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                onClick={() => setFileToDelete(null)}
                                disabled={isDeleting}
                            >
                                Cancelar
                            </button>
                            <button 
                                className="action-btn" 
                                style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none' }}
                                onClick={confirmDeleteFile}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cierre de Compra */}
            {showCierreModal && selectedRequest && (() => {
                const presupuesto = selectedRequest.presupuesto_estimado || 0
                const valorCompra = parseFloat(cierreForm.valor_total_compra) || 0
                const diferencia = presupuesto - valorCompra
                const tipo = cierreForm.tipo_resultado
                const hasValues = cierreForm.valor_total_compra !== ''
                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', zIndex: 9999, padding: '2rem' }}>
                        <div className="modal-content glass animate-scale-in" style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '2rem', color: 'hsl(var(--foreground))', position: 'relative' }}>
                            <button onClick={() => setShowCierreModal(false)} style={{ position: 'absolute', right: '1rem', top: '1rem', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}><X size={20} /></button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.6rem', borderRadius: '50%', display: 'inline-flex' }}><CheckCircle2 size={24} /></div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Finalizar Gestión</h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>{selectedRequest.ticket} · {selectedRequest.titulo}</p>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label>Proveedor con el que se realizó la compra</label>
                                <input type="text" className="form-control" placeholder="Ej: Proveedor S.A.S" value={cierreForm.proveedor} onChange={e => setCierreForm(p => ({ ...p, proveedor: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label>Valor total de la compra ($)</label>
                                    <input type="number" className="form-control" placeholder="0" value={cierreForm.valor_total_compra} onChange={e => setCierreForm(p => ({ ...p, valor_total_compra: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label>Cantidad total</label>
                                    <input type="number" className="form-control" placeholder="0" value={cierreForm.cantidad_total} onChange={e => setCierreForm(p => ({ ...p, cantidad_total: e.target.value }))} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>Resultado de la Negociación</label>
                                <select 
                                    className="form-control" 
                                    value={cierreForm.tipo_resultado} 
                                    onChange={e => setCierreForm(p => ({ ...p, tipo_resultado: e.target.value }))}
                                >
                                    <option value="Saving">Saving (Ahorro vs Presupuesto)</option>
                                    <option value="Avoidance">Avoidance (Prevención de alza / Mejor que mercado)</option>
                                    <option value="Cost Overrun">Cost Overrun (Sobrecosto vs Presupuesto)</option>
                                </select>
                            </div>

                            {hasValues && (
                                <div style={{ background: tipo === 'Cost Overrun' ? 'rgba(239,68,68,0.08)' : tipo === 'Saving' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${tipo === 'Cost Overrun' ? '#ef4444' : tipo === 'Saving' ? '#10b981' : '#f59e0b'}`, borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                                        <span>Presupuesto estimado</span><span>${presupuesto.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                                        <span>Valor real de compra</span><span>${valorCompra.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: tipo === 'Cost Overrun' ? '#ef4444' : tipo === 'Saving' ? '#10b981' : '#f59e0b' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {tipo === 'Saving' || tipo === 'Avoidance' ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                                            {tipo}
                                        </span>
                                        <span>{diferencia >= 0 ? '+' : '-'}${Math.abs(diferencia).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="action-btn" style={{ flex: 1 }} onClick={() => setShowCierreModal(false)} disabled={isSaving}>Cancelar</button>
                                <button className="action-btn" style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', fontWeight: 600 }} onClick={handleConfirmCierre} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Confirmar Cierre'}</button>
                            </div>
                        </div>
                    </div>
                )
            })()}

            <div className="admin-container animate-fade-in">
                <nav className="admin-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <img src="/logo.png" alt="Nexus" style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f5f1ea', border: '1px solid rgba(116,144,148,0.3)', padding: '2px', objectFit: 'contain' }} />
                    <a onClick={() => router.push('/compras')} style={{ cursor: 'pointer' }}>Volver al Menú</a>
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

            </div>

            <div className="card glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', marginBottom: '3rem' }}>
                    <img src="/logo.png" alt="Logo" style={{ width: '44px', height: '44px', borderRadius: '8px', background: '#f5f1ea', border: '1px solid rgba(116,144,148,0.3)', padding: '2px', objectFit: 'contain' }} />
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
                                    filterType === 'urgent' ? 'Urgentes' : ''
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
                                                style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
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
            </div>

            {/* Modal de Gestión */}
            {selectedRequest && (
                <div style={{ 
                    position: 'fixed', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(0,0,0,0.8)', 
                    zIndex: 1000, 
                    padding: '2rem 1rem',
                    overflowY: 'auto',
                    display: 'flex'
                }}>
                    <div className="modal-content glass animate-scale-in" style={{ 
                        width: '100%',
                        maxWidth: '1000px', 
                        margin: 'auto',
                        position: 'relative', 
                        padding: '2.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        boxSizing: 'border-box',
                        borderRadius: '16px'
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

                        {/* --- PLANNER TASK CARD --- */}
                        <div className="glass" style={{
                            marginTop: '2rem',
                            padding: '1.5rem',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            borderRadius: '1rem',
                            background: 'rgba(139, 92, 246, 0.05)',
                        }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa' }}>
                                <CheckCircle size={16} /> Tarea de Microsoft Planner
                            </h3>
                            
                            {isLoadingPlanner ? (
                                <div style={{ fontSize: '0.85rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={14} className="animate-spin" /> Buscando tarea asociada en Planner...
                                </div>
                            ) : plannerTask ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>{plannerTask.title}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
                                            <span>Progreso: {plannerTask.percentComplete}%</span>
                                            {plannerTask.priority === 1 && <span style={{ color: '#ef4444' }}>Urgente</span>}
                                            {plannerTask.dueDateTime && <span>Vence: {new Date(plannerTask.dueDateTime).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <a 
                                        href={plannerTask.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="action-btn"
                                        style={{ background: '#8b5cf6', color: 'white', border: 'none', textDecoration: 'none', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                                    >
                                        Abrir en Planner
                                    </a>
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>
                                    No se encontró ninguna tarea en Planner para el ticket {selectedRequest.ticket}.
                                </div>
                            )}
                        </div>
                        {/* ----------------------- */}

                        <div className="management-actions glass" style={{
                            marginTop: '3rem',
                            padding: '2rem',
                            border: '1px solid hsl(var(--primary) / 0.2)',
                            borderRadius: '1.5rem',
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
                                            <div key={c.id} style={{ borderLeft: '3px solid hsl(var(--primary) / 0.5)', paddingLeft: '1rem' }}>
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
                                    onClick={() => handleCloseRequest()}
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
        </>
    )
}
