import { createBrowserClient } from '@supabase/ssr'
import { createClient as createBaseClient } from '@supabase/supabase-js'

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            db: { schema: 'nexus' }
        }
    )
}

export function createTHClient() {
    return createBaseClient(
        process.env.NEXT_PUBLIC_TH_URL!,
        process.env.NEXT_PUBLIC_TH_ANON_KEY!,
        {
            db: { schema: 'public' }
        }
    )
}
