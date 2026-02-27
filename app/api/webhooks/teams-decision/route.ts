import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY! // Uses service role for bypass RLS
    )

    try {
        const body = await request.json()
        const { ticket_id, decision, observacion, motivo_rechazo } = body

        const statusMap: Record<string, string> = {
            'APPROVE': 'Aprobado',
            'REJECT': 'Rechazada',
            'MORE_INFO': 'Revisión'
        }

        const newStatus = statusMap[decision]
        if (!newStatus) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })

        const { error } = await supabase
            .schema('nexus')
            .from('solicitudes')
            .update({
                estado_actual: newStatus,
                observacion_actual: observacion,
                motivo_rechazo: decision === 'REJECT' ? motivo_rechazo : null,
                updated_at: new Date().toISOString()
            })
            .eq('ticket', ticket_id)

        if (error) throw error

        return NextResponse.json({ success: true, ticket: ticket_id, status: newStatus })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
