import { NextResponse } from 'next/server'

const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

const PLAN_ID = "2kGcLc7a1UOBsaA1cO6JBWQAFEOB"

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const ticket = searchParams.get('ticket')

        if (!ticket) {
            return NextResponse.json({ error: 'Falta el parámetro ticket' }, { status: 400 })
        }

        const token = await getAccessToken()

        // Get all tasks in the plan (a task may have moved to a different bucket, e.g. "Completado")
        const res = await fetch(`https://graph.microsoft.com/v1.0/planner/plans/${PLAN_ID}/tasks`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            cache: 'no-store'
        })

        if (!res.ok) {
            throw new Error(`Graph API error: ${res.status}`)
        }

        const data = await res.json()
        const tasks = data.value || []

        // Find the task that contains the ticket code (e.g. "NEX-0001")
        const cleanTicket = ticket.trim().toLowerCase()
        const task = tasks.find((t: any) => t.title.toLowerCase().includes(cleanTicket))

        if (!task) {
            console.log(`Planner search failed. Ticket: "${cleanTicket}". Tasks in plan:`, tasks.map((t:any) => t.title))
            return NextResponse.json({ found: false, debug: tasks.map((t:any) => t.title) })
        }

        return NextResponse.json({ 
            found: true, 
            task: {
                id: task.id,
                title: task.title,
                percentComplete: task.percentComplete,
                priority: task.priority,
                createdDateTime: task.createdDateTime,
                dueDateTime: task.dueDateTime,
                url: `https://tasks.office.com/firplak.com/es-es/Home/Task/${task.id}`
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
