import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getAdminUser } from '@/lib/adminSession'
import { getMicrosoftLoginUrl } from '@/lib/microsoftDelegatedAuth'

const NALLELY_EMAIL = 'nallely.lopera@firplak.com'

// Navegación completa (<a href>), no fetch — por eso la sesión se valida vía cookies.
export async function GET(req: NextRequest) {
    const admin = await getAdminUser()
    if (!admin) {
        return NextResponse.redirect(new URL('/login', req.url))
    }
    // Solo Nallely puede conectar esta cuenta — se valida también aquí (no solo
    // ocultando el botón) para que nadie más pueda disparar el flujo entrando a la URL.
    if ((admin.email || '').toLowerCase() !== NALLELY_EMAIL) {
        return NextResponse.redirect(`${new URL(req.url).origin}/costos/variacion?msError=${encodeURIComponent('Solo nallely.lopera@firplak.com puede conectar esta cuenta')}`)
    }

    const state = randomBytes(16).toString('hex')
    const redirectUri = new URL('/api/auth/microsoft/callback', req.url).toString()
    const loginUrl = getMicrosoftLoginUrl(redirectUri, state)

    const res = NextResponse.redirect(loginUrl)
    res.cookies.set('ms_oauth_state', state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600,
        path: '/'
    })
    return res
}
