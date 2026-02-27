'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Package, Truck, Shield, Users, CreditCard, CheckCircle2, X } from 'lucide-react'
import Link from 'next/link'
import './request.css'

const SuccessModal = ({ ticket, onClose }: { ticket: string, onClose: () => void }) => (
    <div className="modal-overlay animate-fade-in">
        <div className="modal-content glass animate-scale-in">
            <div className="success-icon">
                <CheckCircle2 size={64} color="var(--primary)" />
            </div>
            <h2>¡Solicitud Enviada!</h2>
            <p>Tu requerimiento ha sido creado con éxito bajo el ticket:</p>
            <div className="ticket-badge">{ticket}</div>
            <p className="modal-footer-text">Nallely recibirá una notificación para iniciar la revisión.</p>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Entendido
            </button>
        </div>
    </div>
)

export default function NewRequestPage() {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [users, setUsers] = useState<any[]>([])
    const [costCenters, setCostCenters] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [showSuccess, setShowSuccess] = useState(false)
    const [lastTicket, setLastTicket] = useState('')

    const [form, setForm] = useState({
        title: '',
        purpose: '',
        quantity: 1,
        unit: 'Unidades',
        suggested_supplier: '',
        exclusivity: 'NA',
        priority: 'Baja',
        operation_type: 'COMPRA_UNICA',
        responsable_id: '',
        delivery_date: '',
        cost_center_id: '',
        account_id: '',
        estimated_budget: ''
    })

    useEffect(() => {
        const fetchData = async () => {
            const { data: usersData } = await supabase.schema('nexus').from('users').select('id, nombre')
            const { data: ccData } = await supabase.schema('nexus')
                .from('centros_costos')
                .select('id, nombre, codigo, grupo')
                .eq('activo', true)
                .order('grupo', { ascending: true })
                .order('nombre', { ascending: true })

            const { data: accData } = await supabase.schema('nexus').from('cuentas_contables').select('id, nombre, codigo').eq('activo', true)

            if (usersData) setUsers(usersData)
            if (ccData) setCostCenters(ccData)
            if (accData) setAccounts(accData)
        }
        fetchData()
    }, [supabase])

    const isValid = form.priority && form.cost_center_id && form.account_id && form.title && form.quantity > 0

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No autheticated')

            // Generate Ticket ID (Simplified)
            const { count } = await supabase.schema('nexus').from('solicitudes').select('*', { count: 'exact', head: true })
            const ticket = `NEX-${String((count || 0) + 1).padStart(4, '0')}`

            const { error } = await supabase.schema('nexus').from('solicitudes').insert({
                ticket,
                solicitante_id: user.id,
                titulo: form.title,
                proposito: form.purpose,
                cantidad: form.quantity,
                proveedor_sugerido: form.suggested_supplier,
                exclusividad: form.exclusivity,
                prioridad: form.priority,
                tipo_operacion: form.operation_type,
                responsable_id: form.responsable_id || null,
                fecha_entrega_requerida: form.delivery_date || null,
                centro_costos_id: form.cost_center_id,
                cuenta_contable_id: form.account_id,
                presupuesto_estimado: form.estimated_budget ? parseFloat(form.estimated_budget) : null,
                unidad_medida: form.unit,
                estado_actual: 'Revisión'
            })

            if (error) throw error

            setLastTicket(ticket)
            setShowSuccess(true)

            // Insert into outbox for Power Automate
            await supabase.schema('nexus').from('notifications_outbox').insert({
                type: 'NEW_REQUEST',
                payload_json: { ticket, title: form.title, applicant: user.email }
            })

        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="request-container">
            <Link href="/home" className="btn-primary" style={{ background: 'transparent', color: 'white', padding: '0.5rem 0' }}>
                <ArrowLeft size={16} /> Volver al Inicio
            </Link>

            <div className="request-card glass animate-fade-in">
                <h1 style={{ marginBottom: '2rem' }}>Nueva Solicitud de Compra</h1>

                <form onSubmit={handleSubmit}>
                    {/* Bloque 1 */}
                    <section className="block">
                        <h3 className="block-title"><Package size={18} /> Datos Generales</h3>
                        <div className="form-grid single">
                            <div className="form-group">
                                <label>Título de la Solicitud *</label>
                                <input
                                    type="text" className="form-control" placeholder="Ej: Compra de laptops para IT"
                                    value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-grid" style={{ marginTop: '1rem' }}>
                            <div className="form-group">
                                <label>Propósito del Proceso</label>
                                <input
                                    type="text" className="form-control" placeholder="Contexto de la compra"
                                    value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Cantidad *</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{ flex: 1 }}
                                        min="1"
                                        value={form.quantity}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setForm({ ...form, quantity: val === '' ? 0 : parseInt(val) })
                                        }}
                                        required
                                    />
                                    <select
                                        className="form-control"
                                        style={{ width: '120px' }}
                                        value={form.unit}
                                        onChange={e => setForm({ ...form, unit: e.target.value })}
                                    >
                                        <option value="Unidades">Unidades</option>
                                        <option value="KG">KG</option>
                                        <option value="Metros">Metros</option>
                                        <option value="Litros">Litros</option>
                                        <option value="Global">Global</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Bloque 2 */}
                    <section className="block">
                        <h3 className="block-title"><Truck size={18} /> Proveedor</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Proveedor Sugerido</label>
                                <input
                                    type="text" className="form-control"
                                    value={form.suggested_supplier} onChange={e => setForm({ ...form, suggested_supplier: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>¿Es Proveedor Exclusivo?</label>
                                <select
                                    className="form-control"
                                    value={form.exclusivity} onChange={e => setForm({ ...form, exclusivity: e.target.value })}
                                >
                                    <option value="NO">NO</option>
                                    <option value="SI">SI</option>
                                    <option value="NA">N/A</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Bloque 3 */}
                    <section className="block">
                        <h3 className="block-title"><Shield size={18} /> Prioridad y Operación</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Prioridad *</label>
                                <select
                                    className="form-control"
                                    value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    <option value="Urgente">Urgente</option>
                                    <option value="Alta">Alta</option>
                                    <option value="Media">Media</option>
                                    <option value="Baja">Baja</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Tipo de Operación</label>
                                <select
                                    className="form-control"
                                    value={form.operation_type} onChange={e => setForm({ ...form, operation_type: e.target.value })}
                                >
                                    <option value="PTS">PTS</option>
                                    <option value="PTO">PTO</option>
                                    <option value="COMPRA_UNICA">Compra Única</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Bloque 4 */}
                    <section className="block">
                        <h3 className="block-title"><Users size={18} /> Responsable y Entrega</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Responsable de Recepción</label>
                                <select
                                    className="form-control"
                                    value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })}
                                >
                                    <option value="">Seleccione un usuario...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Fecha de Entrega Requerida</label>
                                <input
                                    type="date" className="form-control"
                                    value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Bloque 5 */}
                    <section className="block">
                        <h3 className="block-title"><CreditCard size={18} /> Presupuesto y Contabilidad</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Centro de Costos *</label>
                                <select
                                    className="form-control"
                                    value={form.cost_center_id} onChange={e => setForm({ ...form, cost_center_id: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    {costCenters.map(c => (
                                        <option key={c.id} value={c.id}>
                                            [{c.codigo}] {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cuenta Contable *</label>
                                <select
                                    className="form-control"
                                    value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
                                    required
                                >
                                    <option value="">Seleccione...</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.codigo} - {a.nombre}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label>Presupuesto Estimado (Opcional)</label>
                            <input
                                type="number" className="form-control" placeholder="0.00"
                                value={form.estimated_budget} onChange={e => setForm({ ...form, estimated_budget: e.target.value })}
                            />
                        </div>
                    </section>

                    <button type="submit" className="btn-primary btn-submit" disabled={!isValid || loading}>
                        {loading ? 'ENVIANDO...' : 'ENVIAR SOLICITUD A NEXUS'}
                    </button>
                </form>
            </div>
            {showSuccess && <SuccessModal ticket={lastTicket} onClose={() => router.push('/home')} />}
        </div>
    )
}
