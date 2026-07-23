'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ClipboardList, PlusCircle, History, Search, Send } from 'lucide-react'
import '../home/home.css'

export default function MuestrasMenuPage() {
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
            } else {
                setUser(user)
                const { data } = await supabase.schema('nexus')
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle()
                if (data) setProfile(data)
            }
        }
        getUser()
    }, [supabase, router])

    if (!user) return <div className="home-container"><p>Cargando...</p></div>

    return (
        <div className="home-container">
            <header style={{ marginBottom: '2rem' }}>
                <Link href="/home" className="btn-primary" style={{ background: 'transparent', color: 'hsl(var(--foreground))', padding: '0.5rem 0', display: 'inline-flex', boxShadow: 'none' }}>
                    <ArrowLeft size={16} /> Volver al Menú Principal
                </Link>
            </header>

            <div className="module-section animate-fade-in">
                <div className="module-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: 52, height: 52,
                        background: 'hsla(204, 38%, 24%, 0.10)',
                        borderRadius: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'hsl(var(--primary))',
                        border: '1px solid hsla(204,38%,24%,0.12)',
                        flexShrink: 0
                    }}>
                        <ClipboardList size={28} />
                    </div>
                    <div>
                        <h2 className="module-title">Muestras Homologadas</h2>
                        <p className="module-subtitle">Registro, seguimiento y homologación de muestras de productos</p>
                    </div>
                </div>

                <div className="cards-grid">
                    {/* Registrar nueva muestra */}
                    <Link href="/muestras/nueva" className="nav-card card">
                        <div className="icon-wrapper">
                            <PlusCircle size={32} />
                        </div>
                        <h2>Registrar Muestra</h2>
                        <p>El área de negociación registrará las muestras recibidas.</p>
                    </Link>

                    {/* Solicitar muestra a proveedor */}
                    <Link href="/muestras/solicitar" className="nav-card card">
                        <div className="icon-wrapper">
                            <Send size={32} />
                        </div>
                        <h2>Solicitar Muestra</h2>
                        <p>Pide una muestra de producto al equipo de Negociación; crea automáticamente una tarea en Planner.</p>
                    </Link>

                    {/* Consultar mis muestras */}
                    <Link href="/muestras/mis-muestras" className="nav-card card">
                        <div className="icon-wrapper">
                            <Search size={32} />
                        </div>
                        <h2>Mis Muestras</h2>
                        <p>Aprueba o rechaza las muestras - Espacio solo para ingeniería o persona encargada de ensayar la muestra.</p>
                    </Link>

                    {/* Historial */}
                    <Link href="/muestras/historial" className="nav-card card">
                        <div className="icon-wrapper">
                            <History size={32} />
                        </div>
                        <h2>Historial</h2>
                        <p>Revisa todas las muestras procesadas, aprobadas o rechazadas con su documentación.</p>
                    </Link>
                </div>
            </div>
        </div>
    )
}
