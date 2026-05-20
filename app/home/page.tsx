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
                {/* Logo grande */}
                <img src="/logo.png" alt="Nexus" className="header-logo" />

                {/* Bienvenida */}
                <div className="welcome-section">
                    <h1>
                        👋 Hola, {profile?.nombre || user.user_metadata?.nombre || 'Solicitante'}
                    </h1>
                    <p>Bienvenido al Centro de Gestión de Compras Nexus.</p>
                </div>

                {/* Badge usuario */}
                <div className="user-badge">
                    <User size={16} style={{ color: 'hsl(var(--primary))' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
                        <span style={{ fontWeight: 500, color: 'hsl(var(--foreground))' }}>{user.email}</span>
                        {profile && <span style={{ color: '#749094', fontSize: '0.65rem', fontWeight: 700 }}>✓ {profile.rol}</span>}
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{ background: 'none', border: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}
                        title="Cerrar sesión"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <div className="module-section animate-fade-in">
                <div className="module-header">
                    <h2 className="module-title">Módulos Disponibles</h2>
                    <p className="module-subtitle">Selecciona el área con la que deseas trabajar</p>
                </div>
                
                <div className="cards-grid">
                    {/* Módulo Costos */}
                    <Link href="/costos" className="nav-card card">
                        <div className="icon-wrapper">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </div>
                        <h2>Costos</h2>
                        <p>Gestión de variación de costos y listas oficiales de precios.</p>
                    </Link>

                    {/* Módulo Flujo de Compras */}
                    <Link href="/compras" className="nav-card card">
                        <div className="icon-wrapper">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                        </div>
                        <h2>Flujo de Compras</h2>
                        <p>Gestión de requerimientos, solicitudes de compra y panel administrativo.</p>
                    </Link>

                    {/* Módulo Bodega MP-08 (Placeholder) */}
                    <div className="nav-card card" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        <div className="icon-wrapper" style={{ filter: 'grayscale(100%)' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        <h2>Bodega MP-08</h2>
                        <p>Próximamente. Control de existencias e inventario físico.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
