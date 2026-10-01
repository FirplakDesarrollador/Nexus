import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncEntradasMercancia } from '@/lib/biComprasSync'

export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET!

// Llamado por Vercel Cron todos los días a las 6:00 a.m. Colombia (11:00 UTC), antes
// de que llegue el correo de variación de costos — así el BI ya está fresco cuando el
// motor de preanálisis lo necesite.
export async function GET(req: NextRequest) {
    try {
        const auth = req.headers.get('authorization')
        if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const result = await syncEntradasMercancia()
        return NextResponse.json({ success: true, ...result })

    } catch (err: any) {
        console.error('[costos/bi-compras-sync][GET]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// Botón manual de sincronización — requiere sesión de un usuario con rol ADMIN.
export async function POST(req: NextRequest) {
    try {
        const accessToken = req.headers.get('authorization')?.replace('Bearer ', '')
        if (!accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, anonKey, {
            db: { schema: 'nexus' },
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
        })

        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
        if (userError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: profile } = await supabase.from('users').select('rol').eq('id', user.id).single()
        if (profile?.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
        }

        const result = await syncEntradasMercancia()
        return NextResponse.json({ success: true, ...result })

    } catch (err: any) {
        console.error('[costos/bi-compras-sync][POST]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
