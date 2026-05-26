import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

async function getAccessToken() {
    const params = new URLSearchParams()
    params.append('client_id', CLIENT_ID)
    params.append('scope', 'https://graph.microsoft.com/.default')
    params.append('client_secret', CLIENT_SECRET)
    params.append('grant_type', 'client_credentials')

    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        body: params,
        cache: 'no-store'
    })
    if (!res.ok) throw new Error('Error getting MS Graph token')
    const data = await res.json()
    return data.access_token
}

async function fetchWithEtag(url: string, token: string) {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Fetch error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const etag = data['@odata.etag']
    return { data, etag }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { taskId, action, payload } = body

        if (!taskId || !action) {
            return NextResponse.json({ error: 'Missing taskId or action' }, { status: 400 })
        }

        const token = await getAccessToken()

        // --- ACTION: complete ---
        if (action === 'complete') {
            const { etag } = await fetchWithEtag(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, token)
            const res = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'If-Match': etag
                },
                body: JSON.stringify({ percentComplete: 100 })
            })
            if (!res.ok) throw new Error(`Failed to complete task: ${await res.text()}`)
            return NextResponse.json({ success: true })
        }

        // --- ACTION: comment ---
        if (action === 'comment') {
            const { data: details, etag } = await fetchWithEtag(
                `https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, token
            )
            const currentDesc = details.description || ''
            const timestamp = new Date().toLocaleString('es-CO')
            const newDesc = `${currentDesc}\n\n[${timestamp}] - Nexus: ${payload.comment}`.trim()

            const res = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'If-Match': etag
                },
                body: JSON.stringify({ description: newDesc })
            })
            if (!res.ok) throw new Error(`Failed to update description: ${await res.text()}`)
            return NextResponse.json({ success: true })
        }

        // --- ACTION: file ---
        // Frontend sends { path, filename }. We generate a Supabase signed URL server-side
        // so Planner always receives a real public HTTPS URL (never localhost).
        if (action === 'file') {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            const supabase = createClient(supabaseUrl, supabaseKey)

            const { data: signedData, error: signError } = await supabase.storage
                .from('solicitudes_documentos')
                .createSignedUrl(payload.path, 60 * 60 * 24 * 7) // 7 days

            if (signError || !signedData) {
                throw new Error(`Failed to generate signed URL: ${signError?.message}`)
            }

            const fileUrl = signedData.signedUrl

            // MS Graph plannerExternalReference key: only replace dots and @ — no full encodeURIComponent
            const { data: details, etag } = await fetchWithEtag(
                `https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, token
            )
            const urlKey = fileUrl.replace(/\./g, '%2E').replace(/@/g, '%40')

            const references: Record<string, any> = {}
            references[urlKey] = {
                '@odata.type': '#microsoft.graph.plannerExternalReference',
                alias: payload.filename,
                type: 'Other'
            }

            const res = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${taskId}/details`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'If-Match': etag
                },
                body: JSON.stringify({ references })
            })
            if (!res.ok) throw new Error(`Failed to add file reference: ${await res.text()}`)
            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('Planner Sync Error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
