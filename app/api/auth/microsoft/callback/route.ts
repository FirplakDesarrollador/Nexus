import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/adminSession'
import { exchangeCodeForTokens, saveTokens } from '@/lib/microsoftDelegatedAuth'

export async function GET(req: NextRequest) {
    const { searchParams, origin } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const msError = searchParams.get('error_description') || searchParams.get('error')

    const fail = (reason: string) =>
        NextResponse.redirect(`${origin}/costos/variacion?msError=${encodeURIComponent(reason)}`)

    if (msError) return fail(msError)
    if (!code || !state) return fail('Falta el código de autorización')

    const expectedState = req.cookies.get('ms_oauth_state')?.value
    if (!expectedState || expectedState !== state) {
        return fail('El estado de la autorización no coincide (intenta de nuevo)')
    }

    const admin = await getAdminUser()
    if (!admin) return NextResponse.redirect(`${origin}/login`)

    try {
        const redirectUri = new URL('/api/auth/microsoft/callback', req.url).toString()
        const tokens = await exchangeCodeForTokens(code, redirectUri)

        const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        })
        if (!meRes.ok) throw new Error(`No se pudo confirmar la cuenta autorizada: ${await meRes.text()}`)
        const me = await meRes.json()
        const email = (me.mail || me.userPrincipalName || '').toLowerCase()
        if (!email) throw new Error('Microsoft no devolvió un correo para esta cuenta')

        await saveTokens(email, tokens, admin.id)

        const res = NextResponse.redirect(`${origin}/costos/variacion?msConnected=${encodeURIComponent(email)}`)
        res.cookies.delete('ms_oauth_state')
        return res
    } catch (err: any) {
        console.error('[auth/microsoft/callback]', err)
        return fail(err.message || 'Error conectando la cuenta de Microsoft')
    }
}
