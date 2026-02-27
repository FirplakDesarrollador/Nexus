'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, PieChart, BarChart, TrendingUp, Package } from 'lucide-react'
import Link from 'next/link'
import '../admin/admin.css'

export default function ReportsPage() {
    const supabase = createClient()
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReports = async () => {
            const { data } = await supabase.schema('nexus').from('solicitudes').select('*')
            if (data) setData(data)
            setLoading(false)
        }
        fetchReports()
    }, [supabase])

    const totalExpense = data.reduce((acc, curr) => acc + (curr.presupuesto_estimado || 0), 0)
    const avgTime = data.filter(r => r.closed_at).length > 0
        ? data.filter(r => r.closed_at).reduce((acc, curr) => acc + (new Date(curr.closed_at).getTime() - new Date(curr.created_at).getTime()), 0) / data.filter(r => r.closed_at).length
        : 0

    return (
        <div className="admin-container animate-fade-in">
            <Link href="/admin" className="btn-primary" style={{ background: 'transparent', color: 'white', padding: '0.5rem 0' }}>
                <ArrowLeft size={16} /> Volver al Panel
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '2rem', marginBottom: '3rem' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: '2px solid var(--glass-border)' }} />
                <h1 style={{ margin: 0 }}>Reportes de Gestión</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card card glass">
                    <span className="stat-label">Gasto Total Estimado</span>
                    <span className="stat-value">${totalExpense.toLocaleString()}</span>
                    <TrendingUp size={20} />
                </div>
                <div className="stat-card card glass">
                    <span className="stat-label">Tiempo Promedio Gestión</span>
                    <span className="stat-value">{Math.round(avgTime / (1000 * 60 * 60 * 24))} Días</span>
                    <BarChart size={20} />
                </div>
                <div className="stat-card card glass">
                    <span className="stat-label">Total Solicitudes</span>
                    <span className="stat-value">{data.length}</span>
                    <Package size={20} />
                </div>
            </div>

            <div className="card glass" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyItems: 'center', opacity: 0.5 }}>
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <PieChart size={48} style={{ marginBottom: '1rem' }} />
                    <p>Gráficos de Distribución (Placeholder MVP)</p>
                    <p style={{ fontSize: '0.75rem' }}>Los datos por centro de costos se mostrarán aquí en la versión Pro.</p>
                </div>
            </div>
        </div>
    )
}
