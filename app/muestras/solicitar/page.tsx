'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import '../nueva/nueva.css'

interface FormData {
    producto: string
    especificaciones: string
    proposito: string
    observaciones: string
}

const EMPTY_FORM: FormData = { producto: '', especificaciones: '', proposito: '', observaciones: '' }

export default function SolicitarMuestraPage() {
    const [user, setUser] = useState<any>(null)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [taskUrl, setTaskUrl] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)
        }
        getUser()
    }, [supabase, router])

    const updateForm = (key: keyof FormData, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async () => {
        if (!form.producto.trim()) {
            setError('El producto a solicitar es obligatorio')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch('/api/muestras/solicitar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                body: JSON.stringify(form)
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Error al enviar la solicitud')
            setTaskUrl(json.taskUrl || null)
            setSuccess(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!user) return <div className="nueva-container"><p>Cargando...</p></div>

    if (success) {
        return (
            <div className="nueva-container">
                <div className="success-card">
                    <div className="success-icon">
                        <CheckCircle2 size={52} />
                    </div>
                    <h2>¡Solicitud Enviada!</h2>
                    <p>Se creó la tarea en Planner para gestionar tu solicitud de muestra.</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {taskUrl && (
                            <a href={taskUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
                                Ver tarea en Planner
                            </a>
                        )}
                        <button className="btn-secondary" onClick={() => { setSuccess(false); setForm(EMPTY_FORM) }}>
                            Solicitar otra muestra
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="nueva-container">
            <header style={{ marginBottom: '2rem' }}>
                <Link href="/muestras" className="back-link">
                    <ArrowLeft size={16} /> Volver a Muestras
                </Link>
            </header>

            <div className="page-title">
                <div className="title-icon"><Send size={24} /></div>
                <div>
                    <h1>Solicitar Muestra</h1>
                    <p>Pide una muestra de producto al equipo de Negociación</p>
                </div>
            </div>

            <div className="form-card">
                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="form-grid">
                    <div className="form-group full">
                        <label>Producto a Solicitar <span className="required">*</span></label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Mencionar el producto"
                            value={form.producto}
                            onChange={e => updateForm('producto', e.target.value)}
                        />
                    </div>

                    <div className="form-group full">
                        <label>Especificaciones de la Muestra</label>
                        <textarea
                            className="form-control"
                            placeholder="Describa las características de manera clara"
                            value={form.especificaciones}
                            onChange={e => updateForm('especificaciones', e.target.value)}
                        />
                    </div>

                    <div className="form-group full">
                        <label>¿Para qué se está solicitando la muestra?</label>
                        <textarea
                            className="form-control"
                            placeholder="Razones por las cuales se está solicitando la muestra"
                            value={form.proposito}
                            onChange={e => updateForm('proposito', e.target.value)}
                        />
                    </div>

                    <div className="form-group full">
                        <label>Observaciones</label>
                        <textarea
                            className="form-control"
                            placeholder="Observaciones a tener en cuenta"
                            value={form.observaciones}
                            onChange={e => updateForm('observaciones', e.target.value)}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                        {loading ? 'Enviando...' : 'Solicitar'}
                    </button>
                </div>
            </div>
        </div>
    )
}
