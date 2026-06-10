'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle,
    Loader2, ClipboardList, Package, Info
} from 'lucide-react'
import './nueva.css'

const CATEGORIAS = [
    'Materia Prima', 'Insumo de Producción', 'Material de Empaque',
    'Repuesto / Herramienta', 'EPP / Seguridad', 'Químico / Reactivo',
    'Electrónico / Eléctrico', 'Otro'
]

const UNIDADES = [
    'Unidades', 'Kilogramos', 'Gramos', 'Litros', 'Metros', 'Metros²',
    'Metros³', 'Galones', 'Libras', 'Cajas', 'Rollos', 'Piezas'
]

const PROPOSITOS = [
    'Nuevo proveedor alternativo',
    'Reducción de costos',
    'Mejora de calidad',
    'Cambio de especificación',
    'Sustitución por desabastecimiento',
    'Nuevo desarrollo de producto',
    'Otro'
]

interface FormData {
    nombre_producto: string
    referencia: string
    proveedor: string
    marca: string
    categoria: string
    unidad_medida: string
    cantidad: number
    descripcion: string
    proposito_homologacion: string
    aplicacion: string
}

export default function NuevaMuestraPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [form, setForm] = useState<FormData>({
        nombre_producto: '',
        referencia: '',
        proveedor: '',
        marca: '',
        categoria: '',
        unidad_medida: 'Unidades',
        cantidad: 1,
        descripcion: '',
        proposito_homologacion: '',
        aplicacion: ''
    })
    const [fichaTecnica, setFichaTecnica] = useState<File | null>(null)
    const [evidencia, setEvidencia] = useState<File | null>(null)
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fichaRef = useRef<HTMLInputElement>(null)
    const evidenciaRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
            const { data } = await supabase.schema('nexus')
                .from('users').select('*').eq('id', user.id).maybeSingle()
            if (data) setProfile(data)
        }
        getUser()
    }, [supabase, router])

    const updateForm = (key: keyof FormData, value: string | number) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const handleFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const b64 = (reader.result as string).split(',')[1]
                resolve(b64)
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    const uploadToSharePoint = async (
        file: File,
        folderPath: string
    ): Promise<string | null> => {
        try {
            const b64 = await handleFileToBase64(file)
            const res = await fetch('/api/muestras/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileContent: b64,
                    folderPath
                })
            })
            if (!res.ok) return null
            const data = await res.json()
            return data.url ?? null
        } catch {
            return null
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        setError(null)

        try {
            // 1. Subir Ficha Técnica a SharePoint (si existe)
            let fichaTecnicaUrl: string | null = null
            if (fichaTecnica) {
                fichaTecnicaUrl = await uploadToSharePoint(
                    fichaTecnica,
                    '/Shared Documents/Fichas Tec Homologacion de productos'
                )
            }

            // 2. Subir Evidencia a SharePoint (si existe)
            let evidenciaUrl: string | null = null
            if (evidencia) {
                evidenciaUrl = await uploadToSharePoint(
                    evidencia,
                    '/Shared Documents/Evidencias Homologacion de productos'
                )
            }

            // 3. Insertar en Supabase
            const { data: inserted, error: dbError } = await supabase
                .schema('nexus')
                .from('muestras')
                .insert({
                    solicitante_id: user.id,
                    nombre_producto: form.nombre_producto,
                    referencia: form.referencia || null,
                    proveedor: form.proveedor,
                    marca: form.marca || null,
                    categoria: form.categoria,
                    unidad_medida: form.unidad_medida,
                    cantidad: form.cantidad,
                    descripcion: form.descripcion || null,
                    proposito_homologacion: form.proposito_homologacion || null,
                    aplicacion: form.aplicacion || null,
                    ficha_tecnica_url: fichaTecnicaUrl,
                    evidencia_url: evidenciaUrl,
                    estado: 'Pendiente'
                })
                .select()
                .single()

            if (dbError) throw new Error(dbError.message)

            // 4. Registrar estado inicial en historial
            await supabase.schema('nexus').from('muestra_estados_hist').insert({
                muestra_id: inserted.id,
                estado: 'Pendiente',
                observacion: 'Registro de muestra creado.',
                actor_id: user.id
            })

            setSuccess(inserted.ticket)
        } catch (err: any) {
            setError(err.message || 'Error al registrar la muestra')
        } finally {
            setLoading(false)
        }
    }

    const canNext1 = form.nombre_producto && form.proveedor && form.categoria
    const canNext2 = true // archivos son opcionales

    if (!user) return <div className="nueva-container"><p>Cargando...</p></div>

    if (success) {
        return (
            <div className="nueva-container">
                <div className="success-card">
                    <div className="success-icon">
                        <CheckCircle2 size={52} />
                    </div>
                    <h2>¡Muestra Registrada Exitosamente!</h2>
                    <p>Tu muestra ha sido registrada con el ticket:</p>
                    <div className="ticket-badge">{success}</div>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.5rem' }}>
                        El equipo de Desarrollo de Productos revisará la muestra y te notificará el resultado.
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="btn-primary" onClick={() => router.push('/muestras/mis-muestras')}>
                            Ver mis muestras
                        </button>
                        <button className="btn-secondary" onClick={() => {
                            setSuccess(null)
                            setForm({ nombre_producto: '', referencia: '', proveedor: '', marca: '', categoria: '', unidad_medida: 'Unidades', cantidad: 1, descripcion: '', proposito_homologacion: '', aplicacion: '' })
                            setFichaTecnica(null)
                            setEvidencia(null)
                            setStep(1)
                        }}>
                            Registrar otra muestra
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="nueva-container">
            {/* Header */}
            <header style={{ marginBottom: '2rem' }}>
                <Link href="/muestras" className="back-link">
                    <ArrowLeft size={16} /> Volver a Muestras
                </Link>
            </header>

            {/* Title */}
            <div className="page-title">
                <div className="title-icon"><ClipboardList size={24} /></div>
                <div>
                    <h1>Registrar Nueva Muestra</h1>
                    <p>Completa los datos para iniciar el proceso de homologación</p>
                </div>
            </div>

            {/* Stepper */}
            <div className="stepper">
                {[
                    { n: 1, label: 'Información del Producto' },
                    { n: 2, label: 'Documentos' },
                    { n: 3, label: 'Confirmación' }
                ].map(s => (
                    <div key={s.n} className={`step ${step === s.n ? 'active' : ''} ${step > s.n ? 'done' : ''}`}>
                        <div className="step-circle">
                            {step > s.n ? <CheckCircle2 size={16} /> : s.n}
                        </div>
                        <span className="step-label">{s.label}</span>
                        {s.n < 3 && <div className="step-line" />}
                    </div>
                ))}
            </div>

            {/* Form Card */}
            <div className="form-card">
                {/* STEP 1 */}
                {step === 1 && (
                    <div className="step-content animate-fade-in">
                        <div className="step-header">
                            <Package size={20} />
                            <h3>Información del Producto</h3>
                        </div>

                        <div className="form-grid">
                            <div className="form-group full">
                                <label>Nombre del Producto <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: Tornillo hexagonal M8 inoxidable"
                                    value={form.nombre_producto}
                                    onChange={e => updateForm('nombre_producto', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Referencia / Código</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: TH-M8-A316"
                                    value={form.referencia}
                                    onChange={e => updateForm('referencia', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Marca</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Ej: 3M, Henkel, etc."
                                    value={form.marca}
                                    onChange={e => updateForm('marca', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Proveedor <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Nombre del proveedor"
                                    value={form.proveedor}
                                    onChange={e => updateForm('proveedor', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Categoría <span className="required">*</span></label>
                                <select
                                    className="form-control"
                                    value={form.categoria}
                                    onChange={e => updateForm('categoria', e.target.value)}
                                >
                                    <option value="">Selecciona una categoría</option>
                                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Unidad de Medida <span className="required">*</span></label>
                                <select
                                    className="form-control"
                                    value={form.unidad_medida}
                                    onChange={e => updateForm('unidad_medida', e.target.value)}
                                >
                                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Cantidad Enviada <span className="required">*</span></label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min={1}
                                    value={form.cantidad}
                                    onChange={e => updateForm('cantidad', parseInt(e.target.value) || 1)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Propósito de Homologación</label>
                                <select
                                    className="form-control"
                                    value={form.proposito_homologacion}
                                    onChange={e => updateForm('proposito_homologacion', e.target.value)}
                                >
                                    <option value="">Selecciona el propósito</option>
                                    {PROPOSITOS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div className="form-group full">
                                <label>Descripción del Producto</label>
                                <textarea
                                    className="form-control"
                                    placeholder="Describe las características, especificaciones o detalles relevantes..."
                                    rows={3}
                                    value={form.descripcion}
                                    onChange={e => updateForm('descripcion', e.target.value)}
                                />
                            </div>

                            <div className="form-group full">
                                <label>Aplicación / Uso en Planta</label>
                                <textarea
                                    className="form-control"
                                    placeholder="¿En qué proceso, máquina o área se usará este material?"
                                    rows={2}
                                    value={form.aplicacion}
                                    onChange={e => updateForm('aplicacion', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                className="btn-primary"
                                disabled={!canNext1}
                                onClick={() => setStep(2)}
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2 */}
                {step === 2 && (
                    <div className="step-content animate-fade-in">
                        <div className="step-header">
                            <FileText size={20} />
                            <h3>Documentos de Soporte</h3>
                        </div>

                        <div className="info-banner">
                            <Info size={16} />
                            <span>Los documentos se cargarán automáticamente al SharePoint de <strong>Desarrollo de Productos</strong>.</span>
                        </div>

                        {/* Ficha Técnica */}
                        <div className="upload-section">
                            <div className="upload-label">
                                <FileText size={18} style={{ color: 'hsl(var(--primary))' }} />
                                <div>
                                    <strong>Ficha Técnica del Producto</strong>
                                    <span className="optional-tag">Opcional</span>
                                    <p>PDF, Excel o imagen con especificaciones técnicas del producto.</p>
                                </div>
                            </div>
                            <div
                                className={`upload-dropzone ${fichaTecnica ? 'has-file' : ''}`}
                                onClick={() => fichaRef.current?.click()}
                            >
                                {fichaTecnica ? (
                                    <div className="file-selected">
                                        <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                                        <div>
                                            <strong>{fichaTecnica.name}</strong>
                                            <span>{(fichaTecnica.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={28} />
                                        <p>Haz clic o arrastra tu archivo aquí</p>
                                        <span>PDF, DOCX, XLSX, JPG, PNG — máx. 20 MB</span>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fichaRef}
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                onChange={e => setFichaTecnica(e.target.files?.[0] ?? null)}
                            />
                            {fichaTecnica && (
                                <button className="remove-file" onClick={() => setFichaTecnica(null)}>
                                    Quitar archivo
                                </button>
                            )}
                        </div>

                        {/* Evidencia de Homologación */}
                        <div className="upload-section" style={{ marginTop: '1.5rem' }}>
                            <div className="upload-label">
                                <FileText size={18} style={{ color: 'hsl(var(--secondary))' }} />
                                <div>
                                    <strong>Evidencia de Homologación</strong>
                                    <span className="optional-tag">Opcional</span>
                                    <p>Fotos, pruebas, certificados u otro documento de soporte.</p>
                                </div>
                            </div>
                            <div
                                className={`upload-dropzone ${evidencia ? 'has-file' : ''}`}
                                onClick={() => evidenciaRef.current?.click()}
                            >
                                {evidencia ? (
                                    <div className="file-selected">
                                        <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                                        <div>
                                            <strong>{evidencia.name}</strong>
                                            <span>{(evidencia.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={28} />
                                        <p>Haz clic o arrastra tu archivo aquí</p>
                                        <span>PDF, DOCX, JPG, PNG, MP4 — máx. 20 MB</span>
                                    </>
                                )}
                            </div>
                            <input
                                ref={evidenciaRef}
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4"
                                onChange={e => setEvidencia(e.target.files?.[0] ?? null)}
                            />
                            {evidencia && (
                                <button className="remove-file" onClick={() => setEvidencia(null)}>
                                    Quitar archivo
                                </button>
                            )}
                        </div>

                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setStep(1)}>
                                ← Anterior
                            </button>
                            <button className="btn-primary" onClick={() => setStep(3)}>
                                Siguiente →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3 - Confirmación */}
                {step === 3 && (
                    <div className="step-content animate-fade-in">
                        <div className="step-header">
                            <CheckCircle2 size={20} />
                            <h3>Confirmar Registro</h3>
                        </div>

                        <div className="review-grid">
                            <div className="review-section">
                                <h4>Información del Producto</h4>
                                <table className="review-table">
                                    <tbody>
                                        <tr><td>Producto</td><td><strong>{form.nombre_producto}</strong></td></tr>
                                        {form.referencia && <tr><td>Referencia</td><td>{form.referencia}</td></tr>}
                                        <tr><td>Proveedor</td><td>{form.proveedor}</td></tr>
                                        {form.marca && <tr><td>Marca</td><td>{form.marca}</td></tr>}
                                        <tr><td>Categoría</td><td>{form.categoria}</td></tr>
                                        <tr><td>Cantidad</td><td>{form.cantidad} {form.unidad_medida}</td></tr>
                                        {form.proposito_homologacion && <tr><td>Propósito</td><td>{form.proposito_homologacion}</td></tr>}
                                        {form.descripcion && <tr><td>Descripción</td><td>{form.descripcion}</td></tr>}
                                        {form.aplicacion && <tr><td>Aplicación</td><td>{form.aplicacion}</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            <div className="review-section">
                                <h4>Documentos</h4>
                                <div className="docs-summary">
                                    <div className={`doc-item ${fichaTecnica ? 'attached' : 'missing'}`}>
                                        <FileText size={16} />
                                        <span>Ficha Técnica</span>
                                        {fichaTecnica
                                            ? <span className="tag-attached">Adjunta: {fichaTecnica.name}</span>
                                            : <span className="tag-missing">No adjuntada</span>
                                        }
                                    </div>
                                    <div className={`doc-item ${evidencia ? 'attached' : 'missing'}`}>
                                        <FileText size={16} />
                                        <span>Evidencia</span>
                                        {evidencia
                                            ? <span className="tag-attached">Adjunta: {evidencia.name}</span>
                                            : <span className="tag-missing">No adjuntada</span>
                                        }
                                    </div>
                                </div>
                            </div>

                            <div className="review-section">
                                <h4>Solicitante</h4>
                                <table className="review-table">
                                    <tbody>
                                        <tr><td>Nombre</td><td>{profile?.nombre || user.email}</td></tr>
                                        <tr><td>Email</td><td>{user.email}</td></tr>
                                        {profile?.area && <tr><td>Área</td><td>{profile.area}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {error && (
                            <div className="error-banner">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setStep(2)} disabled={loading}>
                                ← Anterior
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading
                                    ? <><Loader2 size={16} className="spin" /> Registrando...</>
                                    : <><CheckCircle2 size={16} /> Confirmar y Registrar</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
