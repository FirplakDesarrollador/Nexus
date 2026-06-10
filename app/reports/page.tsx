'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, TrendingDown, Package, Clock, DollarSign, CheckCircle2, AlertTriangle, BarChart2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import '../admin/admin.css'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts'

const COLORS: Record<string, string> = { Saving: '#10b981', Avoidance: '#f59e0b', 'Cost Overrun': '#ef4444' }
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316']

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ margin: '0.15rem 0', color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 999 ? fmt(p.value) : p.value}</p>
                ))}
            </div>
        )
    }
    return null
}

export default function ReportsPage() {
    const supabase = createClient()
    const [closedData, setClosedData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReports = async () => {
            const { data } = await supabase.schema('nexus')
                .from('solicitudes')
                .select(`*, solicitante:users!solicitante_id(nombre, area), centro_costos:centros_costos(nombre), cierres_compra(proveedor, valor_total_compra, cantidad_total, tipo_resultado, created_at)`)
                .not('closed_at', 'is', null)
                .order('closed_at', { ascending: false })
            if (data) setClosedData(data)
            setLoading(false)
        }
        fetchReports()
    }, [supabase])

    const getCierre = (r: any) => Array.isArray(r.cierres_compra) ? r.cierres_compra[0] : r.cierres_compra;

    // ── KPIs ──────────────────────────────────────────────────────────
    const totalPresupuesto = closedData.reduce((acc, r) => acc + (Number(r.presupuesto_estimado) || 0), 0)
    const totalGasto = closedData.reduce((acc, r) => acc + (Number(getCierre(r)?.valor_total_compra) || 0), 0)
    const totalCantidad = closedData.reduce((acc, r) => acc + (Number(getCierre(r)?.cantidad_total) || 0), 0)
    const diferencia = totalPresupuesto - totalGasto
    const resultadoGlobal = diferencia >= 0 ? 'Ahorro Neto' : 'Sobrecosto Neto'
    const withTime = closedData.filter(r => r.closed_at && r.created_at)
    const avgMs = withTime.length > 0 ? withTime.reduce((acc, r) => acc + (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()), 0) / withTime.length : 0
    const avgDays = Math.round(avgMs / (1000 * 60 * 60 * 24))
    const savingCount = closedData.filter(r => getCierre(r)?.tipo_resultado === 'Saving').length
    const avoidanceCount = closedData.filter(r => getCierre(r)?.tipo_resultado === 'Avoidance').length
    const overrunCount = closedData.filter(r => getCierre(r)?.tipo_resultado === 'Cost Overrun').length

    // ── Chart Data ────────────────────────────────────────────────────

    // 1. Bar: Presupuesto vs Gasto por solicitud (últimas 8)
    const barData = [...closedData].reverse().slice(-8).map(r => ({
        name: r.ticket,
        Presupuesto: Number(r.presupuesto_estimado) || 0,
        'Gasto Real': Number(getCierre(r)?.valor_total_compra) || 0,
    }))

    // 2. Pie: Saving vs Avoidance vs Overrun
    const pieData = [
        { name: 'Saving', value: savingCount },
        { name: 'Avoidance', value: avoidanceCount },
        { name: 'Cost Overrun', value: overrunCount },
    ].filter(d => d.value > 0)

    // 3. Area: Gasto acumulado en el tiempo
    let cumulative = 0
    const areaData = [...closedData].reverse().map(r => {
        cumulative += Number(getCierre(r)?.valor_total_compra) || 0
        return {
            fecha: new Date(r.closed_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
            'Gasto Acumulado': Math.round(cumulative),
        }
    })

    // 4. Bar horizontal: Gasto por área
    const areaMap: Record<string, number> = {}
    closedData.forEach(r => {
        const area = r.solicitante?.area || 'Sin área'
        areaMap[area] = (areaMap[area] || 0) + (Number(getCierre(r)?.valor_total_compra) || 0)
    })
    const areaChartData = Object.entries(areaMap)
        .map(([area, total]) => ({ area, total: Math.round(total) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 7)

    const sectionStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '1rem', padding: '1.5rem' }

    return (
        <div className="admin-container animate-fade-in">
            <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'hsl(var(--muted-foreground))', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                <ArrowLeft size={16} /> Volver al Panel
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f5f1ea', border: '1px solid rgba(116,144,148,0.3)', padding: '2px', objectFit: 'contain' }} />
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>Reporte de Gestión</h1>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>Histórico de compras finalizadas</p>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { icon: <DollarSign size={16} style={{ opacity: 0.5 }} />, label: 'Presupuesto Total', value: fmt(totalPresupuesto) },
                    { icon: <BarChart2 size={16} style={{ opacity: 0.5 }} />, label: 'Gasto Real Total', value: fmt(totalGasto) },
                    { icon: resultadoGlobal === 'Ahorro Neto' ? <TrendingDown size={16} color="#10b981" /> : <TrendingUp size={16} color="#ef4444" />, label: `${resultadoGlobal} Global`, value: `${resultadoGlobal === 'Ahorro Neto' ? '+' : '-'}${fmt(Math.abs(diferencia))}`, color: resultadoGlobal === 'Ahorro Neto' ? '#10b981' : '#ef4444', borderColor: resultadoGlobal === 'Ahorro Neto' ? '#10b98133' : '#ef444433' },
                    { icon: <Clock size={16} style={{ opacity: 0.5 }} />, label: 'Tiempo Promedio', value: `${avgDays} días` },
                    { icon: <Package size={16} style={{ opacity: 0.5 }} />, label: 'Unidades Compradas', value: totalCantidad.toLocaleString() },
                ].map((k, i) => (
                    <div key={i} className="stat-card card glass" style={k.borderColor ? { border: `1px solid ${k.borderColor}` } : {}}>
                        {k.icon}
                        <div style={{ flex: 1 }}>
                            <div className="stat-label">{k.label}</div>
                            <div className="stat-value" style={{ fontSize: '1.05rem', color: k.color }}>{k.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Summary ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #10b98133' }}>
                    <CheckCircle2 size={28} color="#10b981" />
                    <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Saving (Ahorro)</div>
                        <div style={{ fontWeight: 700, fontSize: '1.6rem', color: '#10b981' }}>{savingCount}</div>
                    </div>
                </div>
                <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #f59e0b33' }}>
                    <AlertCircle size={28} color="#f59e0b" />
                    <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Avoidance (Prevención)</div>
                        <div style={{ fontWeight: 700, fontSize: '1.6rem', color: '#f59e0b' }}>{avoidanceCount}</div>
                    </div>
                </div>
                <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid #ef444433' }}>
                    <AlertTriangle size={28} color="#ef4444" />
                    <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Cost Overrun (Sobrecosto)</div>
                        <div style={{ fontWeight: 700, fontSize: '1.6rem', color: '#ef4444' }}>{overrunCount}</div>
                    </div>
                </div>
            </div>

            {/* ── CHARTS ROW 1: Bar + Pie ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                {/* Bar: Presupuesto vs Gasto */}
                <div style={sectionStyle}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem' }}>Presupuesto vs Gasto Real por Solicitud</h3>
                    {loading || barData.length === 0 ? (
                        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Sin datos aún</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={barData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                                <Bar dataKey="Presupuesto" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Gasto Real" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie: Saving vs Avoidance */}
                <div style={sectionStyle}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem' }}>Distribución Saving / Avoidance</h3>
                    {loading || pieData.length === 0 ? (
                        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Sin datos aún</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                                    {pieData.map((entry, index) => (
                                        <Cell key={index} fill={COLORS[entry.name as keyof typeof COLORS] || CHART_COLORS[index]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── CHART: Gasto acumulado ── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={sectionStyle}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem' }}>Gasto Acumulado en el Tiempo</h3>
                    {loading || areaData.length === 0 ? (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, fontSize: '0.85rem' }}>Sin datos aún</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={areaData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="Gasto Acumulado" stroke="#6366f1" strokeWidth={2} fill="url(#colorGasto)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ── Historical Table ── */}
            <div style={sectionStyle}>
                <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem' }}>Historial de Compras Cerradas</h2>
                <div className="admin-table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Ticket</th><th>Solicitud</th><th>Proveedor</th>
                                <th>Presupuesto</th><th>Gasto Real</th><th>Diferencia</th><th>Resultado</th><th>Días</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando...</td></tr>
                            ) : closedData.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>No hay compras finalizadas aún.</td></tr>
                            ) : closedData.map(r => {
                                const cierre = getCierre(r)
                                const presup = Number(r.presupuesto_estimado) || 0
                                const gasto = Number(cierre?.valor_total_compra) || 0
                                const diff = presup - gasto
                                const resultado = cierre?.tipo_resultado || '—'
                                const dias = r.closed_at ? Math.round((new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)) : '—'
                                return (
                                    <tr key={r.id}>
                                        <td style={{ fontWeight: 600, color: 'hsl(var(--primary))', fontSize: '0.8rem' }}>{r.ticket}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{r.titulo}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{cierre?.proveedor || '—'}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{fmt(presup)}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{cierre ? fmt(gasto) : '—'}</td>
                                        <td style={{ fontWeight: 600, fontSize: '0.85rem', color: diff >= 0 ? '#10b981' : '#ef4444' }}>{cierre ? `${diff >= 0 ? '+' : ''}${fmt(diff)}` : '—'}</td>
                                        <td>{cierre ? (() => {
                                            const bg = COLORS[resultado] || '#94a3b8'
                                            return (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '99px', background: `${bg}18`, color: bg, border: `1px solid ${bg}` }}>
                                                    {resultado === 'Cost Overrun' ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {resultado}
                                                </span>
                                            )
                                        })() : '—'}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{dias}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
