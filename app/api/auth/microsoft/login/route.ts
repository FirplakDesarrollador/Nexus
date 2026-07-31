import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getAdminUser } from '@/lib/adminSession'
import { getMicrosoftLoginUrl } from '@/lib/microsoftDelegatedAuth'

// Navegación completa (<a href>), no fetch — por eso la sesión se valida vía cookies.
export async function GET(req: NextRequest) {
    const admin = await getAdminUser()
    if (!admin) {
        return NextResponse.redirect(new URL('/login', req.url))
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
