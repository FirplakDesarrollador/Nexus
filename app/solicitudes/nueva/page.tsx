'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient, createTHClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Send, Package, Truck, Shield, Users, CreditCard, CheckCircle2, X, Search, ChevronDown, Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react'
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
            <p className="modal-footer-text">Se enviará una notificación al responsable para iniciar la revisión.</p>
            <button type="button" onClick={onClose} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Entendido
            </button>
        </div>
    </div>
)

const SearchableSelect = ({ 
    options, 
    value, 
    onChange, 
    placeholder,
    label
}: { 
    options: { id: string, label: string }[], 
    value: string, 
    onChange: (val: string) => void, 
    placeholder: string,
    label: string
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.id === value);

    const filteredOptions = options.filter(o => 
        (o.label || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="form-group">
            <label>{label}</label>
            <div className="searchable-select" ref={containerRef}>
                <div className={`select-trigger ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                    {selectedOption ? (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedOption.label}
                        </span>
                    ) : (
                        <span className="placeholder">{placeholder}</span>
                    )}
                    <ChevronDown size={16} className={`arrow ${isOpen ? 'open' : ''}`} />
                </div>
                
                {isOpen && (
                    <div className="select-dropdown glass animate-fade-in">
                        <div className="search-box">
                            <Search size={14} />
                            <input 
                                type="text" 
                                className="search-input" 
                                placeholder="Buscar..." 
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="options-list">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(opt => (
                                    <div 
                                        key={opt.id} 
                                        className={`option-item ${opt.id === value ? 'selected' : ''}`}
                                        onClick={() => {
                                            onChange(opt.id);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                    >
                                        {opt.label}
                                    </div>
                                ))
                            ) : (
                                <div className="no-results">No se encontraron resultados</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const PriorityBadge = ({ priority, size = 16 }: { priority: string, size?: number }) => {
    const getPriorityData = (p: string) => {
        switch (p) {
            case 'Urgente': return { style: { background: '#ff4d4d22', color: '#ff4d4d', border: '1px solid #ff4d4d' }, icon: <Bell size={size} /> };
            case 'Alta': return { style: { background: '#ff4d4d22', color: '#ff4d4d', border: '1px solid #ff4d4d' }, icon: <AlertCircle size={size} /> };
            case 'Media': return { style: { background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b' }, icon: null };
            case 'Baja': return { style: { background: '#10b98122', color: '#10b981', border: '1px solid #10b981' }, icon: null };
            default: return { style: {}, icon: null };
        }
    };

    const data = getPriorityData(priority);
    return (
        <span className="badge" style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            textTransform: 'capitalize',
            padding: '0.25rem 0.75rem',
            borderRadius: '2rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            ...data.style 
        }}>
            {data.icon}
            {priority}
        </span>
    );
};

export default function NewRequestPage() {
    const supabase = createClient()
    const router = useRouter()
    const [users, setUsers] = useState<any[]>([])
    const [costCenters, setCostCenters] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [thEmployees, setThEmployees] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showSuccess, setShowSuccess] = useState(false)
    const [lastTicket, setLastTicket] = useState('')

    const [form, setForm] = useState({
        title: '',
        purpose: '',
        quantity: '' as any,
        unit: 'Unidades',
        suggested_supplier: '',
        exclusivity: 'NA',
        priority: 'Baja',
        operation_type: 'COMPRA_UNICA',
        responsable_id: '',
        delivery_date: '',
        cost_center_id: '',
        account_id: '',
        estimated_budget: '',
        approver_email: '',
        observaciones: ''
    })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: usersData } = await supabase.schema('nexus').from('users').select('id, nombre, email')
                const { data: ccData } = await supabase.schema('nexus')
                    .from('centros_costos')
                    .select('id, nombre, codigo, grupo')
                    .eq('activo', true)
                    .order('grupo', { ascending: true })
                    .order('nombre', { ascending: true })

                const { data: accData } = await supabase.schema('nexus').from('cuentas_contables').select('id, nombre, codigo').eq('activo', true)
                
                // Conexión con proyecto TH y TI
                const thClient = createTHClient()
                const { data: thData, error: thError } = await thClient
                    .from('empleados')
                    .select('nombreCompleto, correo_electronico')
                    .eq('activo', true)
                    .order('nombreCompleto')

                if (thError) {
                    console.error("Error obteniendo empleados de TH:", thError.message || thError)
                    console.error("Detalles del error TH:", JSON.stringify(thError, null, 2))
                }

                if (!process.env.NEXT_PUBLIC_TH_URL || !process.env.NEXT_PUBLIC_TH_ANON_KEY) {
                    console.warn("Advertencia: Las credenciales de TH y TI no están configuradas en el .env o el servidor necesita reinicio.")
                }

                setCostCenters(ccData || [])
                setUsers(usersData || [])
                setAccounts(accData || [])
                setThEmployees(thData || [])
                
                if (thData && thData.length > 0) {
                    console.log(`${thData.length} empleados cargados de TH correctamente.`)
                }
            } catch (err) {
                console.error("Error loading data", err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [supabase])

    const isValid = form.priority && form.cost_center_id && form.account_id && form.title && form.quantity && Number(form.quantity) > 0 && form.approver_email

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
                cantidad: parseInt(form.quantity.toString() || '0'),
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
                estado_actual: 'Revisión',
                aprobador_email: form.approver_email || null,
                observaciones: form.observaciones || null
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
        <>
            <div className="request-container">
            <Link href="/compras" className="btn-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#254153', fontWeight: 600, marginBottom: '1.5rem', transition: 'opacity 0.2s' }}>
                <ArrowLeft size={16} /> Volver al submenú
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
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const val = e.target.value;
                                            setForm({ ...form, quantity: val as any })
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
                                    value={form.exclusivity} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, exclusivity: e.target.value })}
                                >
                                    <option value="NO">NO</option>
                                    <option value="SI">SI</option>
                                    <option value="NA">N/A</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-grid single" style={{ marginTop: '1rem' }}>
                            <div className="form-group">
                                <label className="label-with-info">
                                    Observaciones
                                    <span className="info-tooltip-wrapper">
                                        <Info size={15} className="info-icon" />
                                        <span className="info-tooltip-text">
                                            Aquí podrás dejar links de compra, observaciones importantes que requieres con ese proveedor
                                        </span>
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Links de compra u observaciones del proveedor..."
                                    value={form.observaciones}
                                    onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Bloque 3 */}
                    <section className="block">
                        <h3 className="block-title"><Shield size={18} /> Prioridad y Operación</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Prioridad *</label>
                                <div className="priority-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                                    {['Urgente', 'Alta', 'Media', 'Baja'].map(p => {
                                        const isSelected = form.priority === p;
                                        const color = p === 'Urgente' || p === 'Alta' ? '#ff4d4d' : p === 'Media' ? '#f59e0b' : '#10b981';
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`priority-btn ${isSelected ? 'active' : ''} ${p.toLowerCase()}`}
                                                onClick={() => setForm({ ...form, priority: p })}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.75rem',
                                                    borderRadius: '0.5rem',
                                                    border: `1px solid ${isSelected ? color : 'rgba(37, 65, 83, 0.15)'}`,
                                                    background: isSelected ? `${color}15` : '#ffffff',
                                                    color: isSelected ? color : '#254153',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.85rem',
                                                    fontWeight: isSelected ? 600 : 500,
                                                    boxShadow: isSelected ? `0 2px 8px -2px ${color}33` : 'none'
                                                }}
                                            >
                                                {p === 'Urgente' && <Bell size={14} />}
                                                {p === 'Alta' && <AlertCircle size={14} />}
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Tipo de Operación</label>
                                <select
                                    className="form-control"
                                    value={form.operation_type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, operation_type: e.target.value })}
                                >
                                    <option value="PTS">PTS</option>
                                    <option value="PTO">PTO</option>
                                    <option value="COMPRA_UNICA">Compra Única</option>
                                </select>
                                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: 'rgba(37, 65, 83, 0.6)', lineHeight: 1.4 }}>
                                    <strong>PTS</strong> = Purchase To Stock (compra con stock) · <strong>PTO</strong> = Purchase To Order (compra bajo orden) · <strong>Compra Única</strong> = compra puntual, no recurrente.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Bloque 4: Aprobación */}
                    <section className="block">
                        <h3 className="block-title"><CheckCircle2 size={18} /> Aprobación</h3>
                        <div className="form-grid single">
                            <SearchableSelect
                                label="Responsable de Aprobar *"
                                options={
                                    Array.from(new Map(
                                        thEmployees
                                            .filter(e => e.correo_electronico && e.nombreCompleto)
                                            .map(e => [e.correo_electronico, e])
                                    ).values())
                                    .map(e => ({ id: e.correo_electronico, label: e.nombreCompleto }))
                                }
                                value={form.approver_email}
                                onChange={val => setForm({ ...form, approver_email: val })}
                                placeholder="Seleccione quién debe aprobar..."
                            />
                        </div>
                    </section>

                    {/* Bloque 5 */}
                    <section className="block">
                        <h3 className="block-title"><Users size={18} /> Responsable y Entrega</h3>
                        <div className="form-grid">
                            <SearchableSelect
                                label="Responsable de Compra"
                                options={users
                                    .filter(u => ['nallely.lopera@firplak.com', 'alejandro.fernandez@firplak.com', 'isabel.isaza@firplak.com'].includes((u.email || '').toLowerCase()))
                                    .map(u => ({ id: u.id, label: u.nombre }))}
                                value={form.responsable_id}
                                onChange={val => setForm({ ...form, responsable_id: val })}
                                placeholder="Seleccione responsable..."
                            />
                            <div className="form-group">
                                <label>Fecha de Entrega Requerida</label>
                                <input
                                    type="date" className="form-control"
                                    value={form.delivery_date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, delivery_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Bloque 6 */}
                    <section className="block">
                        <h3 className="block-title"><CreditCard size={18} /> Presupuesto y Contabilidad</h3>
                        <div className="form-grid">
                            <SearchableSelect
                                label="Centro de Costos *"
                                options={costCenters.map(c => ({ id: c.id, label: `[${c.codigo}] ${c.nombre}` }))}
                                value={form.cost_center_id}
                                onChange={val => setForm({ ...form, cost_center_id: val })}
                                placeholder="Seleccione centro de costos..."
                            />
                            <SearchableSelect
                                label="Cuenta Contable *"
                                options={accounts.map(a => ({ id: a.id, label: `${a.codigo} - ${a.nombre}` }))}
                                value={form.account_id}
                                onChange={val => setForm({ ...form, account_id: val })}
                                placeholder="Seleccione cuenta contable..."
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: '1.5rem' }}>
                            <label>Presupuesto Estimado (Opcional)</label>
                            <input
                                type="number" className="form-control" placeholder="0.00"
                                step="0.01"
                                value={form.estimated_budget} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, estimated_budget: e.target.value })}
                            />
                            <small style={{ color: '#888', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>
                                * Ingresa el valor sin puntos ni comas para los miles (ej: 600000). Si usas decimales, sepáralos con punto (.).
                            </small>
                        </div>
                    </section>

                    <button type="submit" className="btn-primary btn-submit" disabled={!isValid || loading}>
                        {loading ? 'ENVIANDO...' : 'ENVIAR SOLICITUD A NEXUS'}
                    </button>
                </form>
            </div>
            </div>
            {showSuccess && <SuccessModal ticket={lastTicket} onClose={() => router.push('/compras')} />}
        </>
    )
}
