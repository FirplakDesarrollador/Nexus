'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, Clock, History, User, ArrowLeft } from 'lucide-react'
import '../home/home.css'

export default function ComprasMenuPage() {
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

                if (data) {
                    setProfile(data)
                }
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
                <div className="module-header">
                    <h2 className="module-title">Flujo de Compras</h2>
                    <p className="module-subtitle">Gestión integral de requerimientos e inventario</p>
                </div>
                
                <div className="cards-grid">
                    <Link href="/solicitudes/nueva" className="nav-card card">
                        <div className="icon-wrapper">
                            <PlusCircle size={32} />
                        </div>
                        <h2>Realizar Solicitud</h2>
                        <p>Inicia un nuevo proceso de compra completando el formulario de 5 bloques.</p>
                    </Link>

                    <Link href="/solicitudes/estado" className="nav-card card">
                        <div className="icon-wrapper">
                            <Clock size={32} />
                        </div>
                        <h2>Estado de Compra</h2>
                        <p>Consulta el progreso de tus solicitudes activas y revisa observaciones.</p>
                    </Link>

                    <Link href="/solicitudes/historial" className="nav-card card">
                        <div className="icon-wrapper">
                            <History size={32} />
                        </div>
                        <h2>Historial</h2>
                        <p>Revisa solicitudes cerradas, completadas o rechazadas con sus detalles.</p>
                    </Link>

                    {profile?.rol === 'ADMIN' && (
                        <Link href="/admin" className="nav-card card" style={{ borderColor: 'hsl(var(--primary))' }}>
                            <div className="icon-wrapper" style={{ background: 'hsla(var(--primary), 0.2)', color: 'hsl(var(--primary))' }}>
                                <User size={32} />
                            </div>
                            <h2>Panel Admin</h2>
                            <p>Acceso maestro para gestionar todas las solicitudes y métricas del sistema.</p>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}
