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

// El endpoint admin de "listar/buscar usuarios" (/admin/users, con o sin filtros) está
// devolviendo 500 "Database error finding users" del lado de Supabase — se confirmó
// llamándolo directo por REST, sin pasar por este código. En cambio, buscar por ID
// exacto (getUserById) sí funciona. Por eso el id se saca de nexus.users (ya se guarda
// ahí desde el primer login de cada usuario) en vez de list/search.
async function findUserIdByEmail(supabaseAdmin: ReturnType<typeof createAdminClient>, email: string) {
    const { data, error } = await supabaseAdmin.schema('nexus').from('users').select('id').eq('email', email).maybeSingle()
    if (error) throw new Error(`Error buscando el usuario: ${error.message}`)
    return data?.id ?? null
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

        const supabaseAdmin = createAdminClient()

        const userId = await findUserIdByEmail(supabaseAdmin, email.trim().toLowerCase())
        if (!userId) {
            return NextResponse.json({ error: 'No se encontró una cuenta con ese correo. Si nunca has iniciado sesión en Nexus, hazlo primero y luego podrás recuperar tu contraseña.' }, { status: 404 })
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
        if (updateError) throw new Error(updateError.message)

        console.log(`[auth/reset-password] Contraseña cambiada para ${email.trim().toLowerCase()} — ${new Date().toISOString()}`)

        return NextResponse.json({ success: true })

    } catch (err: any) {
        console.error('[auth/reset-password]', err)
        return NextResponse.json({ error: err.message || 'Error al cambiar la contraseña' }, { status: 500 })
    }
}
