import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Verifica sesión de Supabase vía cookies (para rutas que se navegan directamente,
// como un <a href>, donde no se puede mandar un header Authorization con fetch).
// Mismo patrón de cookies que ya usa app/auth/callback/route.ts.
export async function getAdminUser(): Promise<{ id: string; email?: string } | null> {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options })
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase.schema('nexus').from('users').select('rol').eq('id', user.id).maybeSingle()
    if (profile?.rol !== 'ADMIN') return null

    return { id: user.id, email: user.email }
}
