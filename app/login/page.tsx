'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import './login.css'

type AuthView = 'login' | 'register' | 'forgot'

export default function LoginPage() {
    const [view, setView] = useState<AuthView>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    const syncProfile = async (user: any, emailStr: string) => {
        // Buscar datos previos en el esquema público de la base de datos "Servicios y comercial"
        const { data: publicUser } = await supabase
            .from('Usuarios')
            .select('display_name, rol')
            .eq('correo', emailStr.trim().toLowerCase())
            .single()

        const adminEmails = ['aprendiz.desarrollo@firplak.com', 'nallely.lopera@firplak.com']
        const assignedRole = adminEmails.includes(emailStr.trim().toLowerCase()) ? 'ADMIN' : 'SOLICITANTE'

        const { error: profileError } = await supabase.schema('nexus')
            .from('users')
            .upsert({
                id: user.id,
                nombre: publicUser?.display_name || emailStr.split('@')[0],
                email: emailStr.trim().toLowerCase(),
                rol: assignedRole,
                area: publicUser?.rol || null
            })

        if (profileError) {
            console.error('DEBUG - Error syncing profile:', profileError)
        }
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            if (view === 'register') {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    }
                })
                if (error) throw error

                if (data.user) {
                    await syncProfile(data.user, email)
                }

                setMessage('Registro exitoso. Revisa tu correo o inicia sesión.')
                setView('login')
            } else if (view === 'login') {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                if (error) throw error

                if (data.user) {
                    await syncProfile(data.user, email)
                }

                router.push('/home')
            } else if (view === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
                })
                if (error) throw error
                setMessage('Se ha enviado un correo de recuperación.')
                setView('login')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const titles = {
        login: 'Gestión de Compras Corporativas',
        register: 'Crea tu cuenta de acceso',
        forgot: 'Recuperar Contraseña'
    }

    const buttonTexts = {
        login: 'Iniciar Sesión',
        register: 'Registrarse',
        forgot: 'Enviar enlace'
    }

    return (
        <div className="login-container">
            <div className="login-card glass">
                <div className="logo-section">
                    <img src="/logo.png" alt="Nexus Logo" className="login-logo" />
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
                        {titles[view]}
                    </p>
                </div>

                <form onSubmit={handleAuth}>
                    <div className="form-group">
                        <label>Correo Electrónico</label>
                        <input
                            type="email"
                            className="form-control"
                            placeholder="nombre@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {view !== 'forgot' && (
                        <div className="form-group">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                className="form-control"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            {view === 'login' && (
                                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                                    <span 
                                        onClick={() => setView('forgot')} 
                                        style={{ color: 'hsl(var(--primary))', fontSize: '0.8125rem', cursor: 'pointer' }}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <p style={{ color: 'hsl(var(--destructive))', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                            {error}
                        </p>
                    )}

                    {message && (
                        <p style={{ color: '#10b981', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                            {message}
                        </p>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                        {loading ? 'Procesando...' : buttonTexts[view]}
                    </button>
                </form>

                <p className="footer-text">
                    {view === 'login' && (
                        <>¿No tienes cuenta? <span onClick={() => setView('register')}>Regístrate ahora</span></>
                    )}
                    {view === 'register' && (
                        <>¿Ya tienes cuenta? <span onClick={() => setView('login')}>Inicia sesión aquí</span></>
                    )}
                    {view === 'forgot' && (
                        <>¿Recordaste tu contraseña? <span onClick={() => setView('login')}>Volver al login</span></>
                    )}
                </p>
            </div>
        </div>
    )
}
