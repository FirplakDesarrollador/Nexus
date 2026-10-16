import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Self-service: el usuario cambia su contraseña con solo correo + contraseña nueva,
// sin pasar por el enlace de verificación por correo de Supabase (decisión explícita
// del negocio — es una app interna, no pública).
function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurado')
    return createClient(url, serviceKey, { auth: { persistSession: false } })
}

async function findUserByEmail(supabaseUrl: string, serviceKey: string, email: string) {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
    })
    if (!res.ok) throw new Error(`Error buscando el usuario: ${res.status} ${await res.text()}`)
    const json = await res.json()
    const users = json.users ?? []
    return users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

export async function POST(req: NextRequest) {
    try {
        const { email, newPassword } = await req.json() as { email?: string; newPassword?: string }

        if (!email || !newPassword) {
            return NextResponse.json({ error: 'Faltan el correo o la contraseña nueva' }, { status: 400 })
        }
        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabaseAdmin = createAdminClient()

        const user = await findUserByEmail(supabaseUrl, serviceKey, email.trim().toLowerCase())
        if (!user) {
            return NextResponse.json({ error: 'No se encontró una cuenta con ese correo' }, { status: 404 })
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword })
        if (updateError) throw new Error(updateError.message)

        console.log(`[auth/reset-password] Contraseña cambiada para ${email.trim().toLowerCase()} — ${new Date().toISOString()}`)

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('[auth/reset-password]', err)
        return NextResponse.json({ error: err.message || 'Error al cambiar la contraseña' }, { status: 500 })
    }
}
