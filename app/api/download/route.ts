import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const path = searchParams.get('path')
        
        if (!path) {
            return new NextResponse('Missing path', { status: 400 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return new NextResponse('Server configuration error', { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Create a signed URL valid for 1 hour (3600 seconds)
        const { data, error } = await supabase.storage
            .from('solicitudes_documentos')
            .createSignedUrl(path, 3600)
            
        if (error || !data) {
            console.error('Download error:', error)
            return new NextResponse('Error generating download URL', { status: 500 })
        }
        
        // Redirect the user to the signed URL so the file opens/downloads automatically
        return NextResponse.redirect(data.signedUrl)
    } catch (error) {
        console.error('API Error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
