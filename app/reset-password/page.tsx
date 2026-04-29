'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import '../login/login.css'

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const supabase = createClient()
    const router = useRouter()

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })
            if (error) throw error
            
            setMessage('Tu contraseña ha sido actualizada correctamente.')
            setTimeout(() => {
                router.push('/login')
            }, 3000)
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
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Nueva Contraseña</h2>
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.875rem', textAlign: 'center' }}>
                        Ingresa tu nueva contraseña para acceder a tu cuenta.
                    </p>
                </div>

                <form onSubmit={handleUpdatePassword}>
                    <div className="form-group">
                        <label>Nueva Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirmar Contraseña</label>
                        <input
                            type="password"
                            className="form-control"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

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
                        {loading ? 'Actualizando...' : 'Restablecer contraseña'}
                    </button>
                </form>
            </div>
        </div>
    )
}
