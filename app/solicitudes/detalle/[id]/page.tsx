'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Package, Clock, MessageSquare, AlertCircle, Building2, Wallet, User, Calendar, Truck, Shield, Bell, Paperclip, Download, FileText, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'
import '../../estado/status.css'

export default function RequestDetailPage() {
    const { id } = useParams()
    const supabase = createClient()
    const router = useRouter()
    const [request, setRequest] = useState<any>(null)
    const [attachedFiles, setAttachedFiles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchRequest = async () => {
            try {
                const { data, error } = await supabase.schema('nexus')
                    .from('solicitudes')
                    .select(`
                        *,
                        centro_costos:centros_costos(nombre, codigo),
                        cuenta_contable:cuentas_contables(nombre, codigo),
                        responsable:users!responsable_id(nombre)
                    `)
                    .eq('id', id)
                    .single()

                if (error) throw error
                setRequest(data)
            } catch (err: any) {
                console.error('Error fetching request:', err)
                setError(err.message || 'No se pudo cargar la solicitud')
            } finally {
                setLoading(false)
            }
        }
        const fetchDocuments = async (requestId: string) => {
            const { data } = await supabase.schema('nexus')
                .from('documentos')
                .select('*')
                .eq('solicitud_id', requestId)
                .order('created_at', { ascending: false })
            if (data) setAttachedFiles(data)
        }

        if (id) {
            fetchRequest()
            fetchDocuments(id as string)
        }
    }, [id, supabase])

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

    if (loading) return (
        <div className="list-container">
            <p style={{ textAlign: 'center', marginTop: '4rem' }}>Cargando detalles...</p>
        </div>
    )

    if (error || !request) return (
        <div className="list-container">
            <div className="card glass" style={{ padding: '3rem', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ color: 'hsl(var(--destructive))', marginBottom: '1.5rem' }} />
                <h2>Error</h2>
                <p>{error || 'No se encontró la solicitud'}</p>
                <Link href="/solicitudes/estado" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem' }}>
                    Volver al Estado de Compras
                </Link>
            </div>
        </div>
    )

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Revisión': return 'badge-pending'
            case 'En Cotización': return 'badge-in-progress'
            case 'Aprobado': return 'badge-approved'
            case 'Completada': return 'badge-approved'
            case 'Rechazada': return 'badge-rejected'
            default: return 'badge-in-progress'
        }
    }

    return (
        <div className="list-container" style={{ maxWidth: '900px' }}>
            <Link href="/solicitudes/estado" className="btn-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#254153', fontWeight: 600, transition: 'opacity 0.2s' }}>
                <ArrowLeft size={16} /> Volver al Listado
            </Link>

            <header style={{ marginTop: '2rem', marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span className="ticket-id" style={{ fontSize: '1rem' }}>{request.ticket}</span>
                    <h1 style={{ marginTop: '0.5rem' }}>{request.titulo}</h1>
                    <p style={{ opacity: 0.6 }}>Solicitada el {new Date(request.created_at).toLocaleDateString()}</p>
                </div>
                <div className={`badge ${getStatusClass(request.estado_actual)}`} style={{ padding: '0.5rem 1.5rem', fontSize: '1rem' }}>
                    {request.estado_actual}
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Detalles principales */}
                <div className="card glass" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={18} /> Información del Requerimiento
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Cantidad</label>
                            <span style={{ fontWeight: 600 }}>{request.cantidad} {request.unidad_medida || 'Unidades'}</span>
                        </div>

                        {request.presupuesto_estimado != null && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Presupuesto Estimado</label>
                                <span style={{ fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                    ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(request.presupuesto_estimado)} COP
                                </span>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Propósito</label>
                            <p style={{ margin: 0 }}>{request.proposito || 'No especificado'}</p>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Proveedor Sugerido</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Truck size={16} style={{ opacity: 0.5 }} />
                                <span>{request.proveedor_sugerido || 'No especificado'}</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Prioridad</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className={`badge ${
                                    request.prioridad === 'Urgente' || request.prioridad === 'Alta' ? 'priority-urgente' : 
                                    request.prioridad === 'Media' ? 'priority-media' : 'priority-baja'
                                }`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'capitalize' }}>
                                    {request.prioridad === 'Urgente' && <Bell size={14} />}
                                    {request.prioridad === 'Alta' && <AlertCircle size={14} />}
                                    {request.prioridad}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contabilidad y Asignación */}
                <div className="card glass" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building2 size={18} /> Administración
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Centro de Costos</label>
                            <div style={{ fontWeight: 500 }}>[{request.centro_costos?.codigo}] {request.centro_costos?.nombre}</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Cuenta Contable</label>
                            <div style={{ fontWeight: 500 }}>{request.cuenta_contable?.codigo} - {request.cuenta_contable?.nombre}</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Responsable Compra</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <User size={16} style={{ opacity: 0.5 }} />
                                <span>{request.responsable?.nombre || 'General'}</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Responsable de Aprobar</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Shield size={16} style={{ opacity: 0.5 }} />
                                <span>{request.aprobador_email || 'No asignado'}</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.5, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Fecha Requerida</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} style={{ opacity: 0.5 }} />
                                <span>{request.fecha_entrega_requerida ? new Date(request.fecha_entrega_requerida).toLocaleDateString() : 'No especificada'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Archivos Adjuntos */}
                {attachedFiles.length > 0 && (
                    <div className="card glass" style={{ gridColumn: 'span 2', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Paperclip size={18} /> Documentos y Cotizaciones
                        </h3>
                        <div className="files-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {attachedFiles.map(file => (
                                <div key={file.id} className="file-card glass" style={{ padding: '0.75rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '0.4rem' }}>
                                        {file.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? <ImageIcon size={18} /> : <FileText size={18} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
                                        <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{new Date(file.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={() => handleDownloadFile(file.path, file.filename)} style={{ padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, color: 'white' }} title="Descargar">
                                        <Download size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Observaciones de Nallely */}
                <div className="card glass" style={{ gridColumn: 'span 2', padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageSquare size={18} /> Seguimiento y Observaciones
                    </h3>

                    {request.observacion_actual ? (
                        <div className="observation-box" style={{ margin: 0, fontSize: '1rem', padding: '1.5rem' }}>
                            <strong>Comentario de Gestión:</strong>
                            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>{request.observacion_actual}</p>
                        </div>
                    ) : (
                        <p style={{ opacity: 0.5, textAlign: 'center', padding: '1rem' }}>No hay nuevas observaciones en este momento.</p>
                    )}
                </div>
            </div>
        </div>
    )
}
