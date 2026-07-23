import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

// Plan "FPK Desarrollo de productos" — bucket donde vive la tarea de referencia
const PLAN_ID = 'ZUeZvYvzREanc3DRykuv5GQACaGi'
const BUCKET_ID = 'm7eSSrfsVE-pvvDREJ-0BmQAHLLY'
const NALLELY_EMAIL = 'nallely.lopera@firplak.com'

async function getAccessToken(): Promise<string> {
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            scope: 'https://graph.microsoft.com/.default'
        })
    })
    if (!res.ok) throw new Error(`Token error: ${await res.text()}`)
    const json = await res.json()
    return json.access_token
}

// Requiere permiso "User.Read.All" (Aplicación) en Azure AD. Si no está disponible o el
// correo no se puede resolver, devuelve null y la tarea se crea igual, sin ese asignado.
async function resolveUserId(token: string, email: string): Promise<string | null> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id`, {
        headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
        console.warn(`[muestras/solicitar] No se pudo resolver el usuario ${email}: ${res.status} ${await res.text()}`)
        return null
    }
    const json = await res.json()
    return json.id as string
}

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

        const { data: profile } = await supabase.from('users').select('nombre, email').eq('id', user.id).single()
        if (!profile) {
            return NextResponse.json({ error: 'Perfil de usuario no encontrado' }, { status: 400 })
        }

        const body = await req.json()
        const { producto, especificaciones, proposito, observaciones } = body as {
            producto: string
            especificaciones?: string
            proposito?: string
            observaciones?: string
        }
        if (!producto || !producto.trim()) {
            return NextResponse.json({ error: 'El producto a solicitar es obligatorio' }, { status: 400 })
        }

        const token = await getAccessToken()

        // Asignados: quien solicita + Nallely. Si algún correo no se puede resolver
        // (falta permiso User.Read.All), la tarea se crea igual sin ese asignado.
        const [solicitanteAadId, nallelyAadId] = await Promise.all([
            resolveUserId(token, profile.email),
            resolveUserId(token, NALLELY_EMAIL)
        ])

        const assignments: Record<string, unknown> = {}
        for (const id of [solicitanteAadId, nallelyAadId]) {
            if (id) assignments[id] = { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' }
        }

        const createRes = await fetch('https://graph.microsoft.com/v1.0/planner/tasks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planId: PLAN_ID,
                bucketId: BUCKET_ID,
                title: producto.trim(),
                assignments
            })
        })
        if (!createRes.ok) throw new Error(`Error creando la tarea en Planner: ${await createRes.text()}`)
        const task = await createRes.json()

        // Descripción de la tarea con el detalle de la solicitud
        const descripcion = [
            `Solicitado por: ${profile.nombre} (${profile.email})`,
            especificaciones ? `Especificaciones: ${especificaciones}` : null,
            proposito ? `Para qué se solicita: ${proposito}` : null,
            observaciones ? `Observaciones: ${observaciones}` : null
        ].filter(Boolean).join('\n\n')

        const detailsRes = await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${task.id}/details`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (detailsRes.ok) {
            const details = await detailsRes.json()
            await fetch(`https://graph.microsoft.com/v1.0/planner/tasks/${task.id}/details`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'If-Match': details['@odata.etag']
                },
                body: JSON.stringify({ description: descripcion })
            })
        }

        const taskUrl = `https://tasks.office.com/firplak.com/es-es/Home/Task/${task.id}`

        const { error: insertError } = await supabase.from('solicitudes_muestras').insert({
            solicitante_id: user.id,
            producto: producto.trim(),
            especificaciones: especificaciones || null,
            proposito: proposito || null,
            observaciones: observaciones || null,
            planner_task_id: task.id,
            planner_task_url: taskUrl
        })
        if (insertError) throw new Error(`Error guardando la solicitud: ${insertError.message}`)

        return NextResponse.json({ success: true, taskId: task.id, taskUrl })

    } catch (err: any) {
        console.error('[muestras/solicitar][POST]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
