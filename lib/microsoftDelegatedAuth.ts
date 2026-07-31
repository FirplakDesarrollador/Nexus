import { createClient } from '@supabase/supabase-js'

const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

// Scopes delegados: Mail.Read para leer el correo, offline_access para obtener un
// refresh_token (sin él, el token de acceso expira en ~1h y no hay forma de renovarlo
// sin que el usuario vuelva a iniciar sesión), User.Read para poder confirmar quién autorizó.
const SCOPES = 'offline_access Mail.Read User.Read'

function buildSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
    return createClient(url, key, { db: { schema: 'nexus' } })
}

export function getMicrosoftLoginUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: SCOPES,
        state
    })
    return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`
}

interface TokenResponse {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    })
    if (!res.ok) throw new Error(`Error obteniendo token: ${await res.text()}`)
    return res.json()
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
    return requestToken(new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope: SCOPES
    }))
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
    return requestToken(new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: SCOPES
    }))
}

export async function saveTokens(email: string, tokens: TokenResponse, connectedBy?: string): Promise<void> {
    const supabase = buildSupabaseClient()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const { error } = await supabase.from('microsoft_oauth_tokens').upsert({
        email,
        access_token: tokens.access_token,
        // Microsoft no siempre reenvía un refresh_token nuevo en cada refresh; si no viene,
        // se debe conservar el que ya había guardado (se maneja en getValidAccessToken).
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expires_at: expiresAt,
        scope: tokens.scope,
        ...(connectedBy ? { connected_by: connectedBy } : {}),
        updated_at: new Date().toISOString()
    }, { onConflict: 'email' })
    if (error) throw new Error(`Error guardando el token: ${error.message}`)
}

// Devuelve un access token vigente para ese correo, refrescándolo automáticamente si
// está por vencer. Lanza un error claro si la cuenta nunca se conectó.
export async function getValidAccessToken(email: string): Promise<string> {
    const supabase = buildSupabaseClient()
    const { data, error } = await supabase
        .from('microsoft_oauth_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('email', email)
        .maybeSingle()
    if (error) throw new Error(`Error leyendo el token guardado: ${error.message}`)
    if (!data) throw new Error(`La cuenta ${email} no está conectada. Conéctala desde "Visualizar Archivo".`)

    const expiresAt = new Date(data.expires_at).getTime()
    const safetyBufferMs = 5 * 60 * 1000
    if (Date.now() < expiresAt - safetyBufferMs) {
        return data.access_token
    }

    const refreshed = await refreshTokens(data.refresh_token)
    await saveTokens(email, {
        ...refreshed,
        refresh_token: refreshed.refresh_token ?? data.refresh_token
    })
    return refreshed.access_token
}

export async function getConnectionStatus(email: string): Promise<{ connected: boolean; expiresAt?: string }> {
    const supabase = buildSupabaseClient()
    const { data } = await supabase
        .from('microsoft_oauth_tokens')
        .select('expires_at')
        .eq('email', email)
        .maybeSingle()
    if (!data) return { connected: false }
    return { connected: true, expiresAt: data.expires_at }
}
