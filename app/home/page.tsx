'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, Clock, History, LogOut, User } from 'lucide-react'
import './home.css'

export default function HomePage() {
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
                // Usamos el cliente configurado para el esquema 'nexus'
                const { data, error } = await supabase.schema('nexus')
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle()

                if (error) {
                    console.error('Error fetching profile:', error.message || error)
                }

                if (data) {
                    setProfile(data)
                }
            }
        }
        getUser()
    }, [supabase, router])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (!user) return <div className="home-container"><p>Cargando...</p></div>

    return (
        <div className="home-container">
            <header className="header">
                <div className="welcome-section">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: '2px solid var(--glass-border)' }} />
                        <h1 style={{ margin: 0 }}>Hola, {profile?.nombre || user.user_metadata?.nombre || 'Solicitante'}</h1>
                    </div>
                    <p>Bienvenido al Centro de Gestión de Compras Nexus.</p>
                </div>

                <div className="user-badge glass">
                    <User size={18} />
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
                        <span>{user.email}</span>
                        {profile && <span style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 'bold' }}>✓ {profile.rol}</span>}
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', marginLeft: '1rem', display: 'flex', alignItems: 'center' }}
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

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
                    <Link href="/admin" className="nav-card card animate-fade-in" style={{ borderColor: 'hsl(var(--primary))' }}>
                        <div className="icon-wrapper" style={{ background: 'hsla(var(--primary), 0.2)', color: 'hsl(var(--primary))' }}>
                            <User size={32} />
                        </div>
                        <h2>Panel Admin</h2>
                        <p>Acceso maestro para gestionar todas las solicitudes y métricas del sistema.</p>
                    </Link>
                )}
            </div>
        </div>
    )
}
