import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConnectionStatus } from '@/lib/microsoftDelegatedAuth'

const NALLELY_EMAIL = 'nallely.lopera@firplak.com'

export async function GET(req: NextRequest) {
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

        const status = await getConnectionStatus(NALLELY_EMAIL)
        return NextResponse.json({ email: NALLELY_EMAIL, ...status })

    } catch (err: any) {
        console.error('[auth/microsoft/status][GET]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
