'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, DollarSign } from 'lucide-react'
import '../home/home.css'

export default function CostosMenuPage() {
    const [user, setUser] = useState<any>(null)
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
            } else {
                setUser(user)
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
                    <h2 className="module-title">Módulo de Costos</h2>
                    <p className="module-subtitle">Análisis de fluctuación y consulta de catálogos</p>
                </div>
                
                <div className="cards-grid">
                    <Link href="/costos/variacion" className="nav-card card">
                        <div className="icon-wrapper">
                            <TrendingUp size={32} />
                        </div>
                        <h2>Variación de costos</h2>
                        <p>Seguimiento detallado a la fluctuación de precios de materias primas.</p>
                    </Link>

                    <div className="nav-card card" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                        <div className="icon-wrapper" style={{ filter: 'grayscale(100%)' }}>
                            <DollarSign size={32} />
                        </div>
                        <h2>Lista de precios</h2>
                        <p>Próximamente. Consulta de tarifas oficiales de proveedores homologados.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
