'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import './login.css'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [isRegister, setIsRegister] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    const syncProfile = async (user: any, emailStr: string) => {
        const adminEmails = ['aprendiz.desarrollo@firplak.com', 'nallely.lopera@firplak.com']
        const assignedRole = adminEmails.includes(emailStr.trim().toLowerCase()) ? 'ADMIN' : 'SOLICITANTE'

        const { error: profileError } = await supabase.schema('nexus')
            .from('users')
            .upsert({
                id: user.id,
                nombre: emailStr.split('@')[0],
                email: emailStr.trim().toLowerCase(),
                rol: assignedRole
            })

        if (profileError) {
            console.error('DEBUG - Error syncing profile:', profileError)
        }
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isRegister) {
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

                alert('Registro exitoso. Revisa tu correo (si aplica) o inicia sesión.')
                setIsRegister(false)
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                })
                if (error) throw error

                // Also sync on login to ensure profile exists (Resilience)
                if (data.user) {
                    await syncProfile(data.user, email)
                }

                router.push('/home')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-container">
            <div className="login-card glass">
                <div className="logo-section">
                    <img src="/logo.png" alt="Nexus Logo" className="login-logo" />
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem' }}>
                        {isRegister ? 'Crea tu cuenta de acceso' : 'Gestión de Compras Corporativas'}
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
                    </div>

                    {error && (
                        <p style={{ color: 'hsl(var(--destructive))', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                            {error}
                        </p>
                    )}

                    <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                        {loading ? 'Procesando...' : isRegister ? 'Registrarse' : 'Iniciar Sesión'}
                    </button>
                </form>

                <p className="footer-text">
                    {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} {' '}
                    <span onClick={() => setIsRegister(!isRegister)}>
                        {isRegister ? 'Inicia sesión aquí' : 'Regístrate ahora'}
                    </span>
                </p>
            </div>
        </div>
    )
}
