import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side client uses service role key → bypasses all RLS
function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!serviceKey || serviceKey === 'tu_service_role_key_aqui') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurado en .env')
    }
    return createClient(url, serviceKey, {
        auth: { persistSession: false },
        db: { schema: 'nexus' }
    })
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const solicitudId = formData.get('solicitudId') as string | null
        const ticket = formData.get('ticket') as string | null
        const uploadedBy = formData.get('uploadedBy') as string | null

        if (!file || !solicitudId || !ticket) {
            return NextResponse.json(
                { error: 'Faltan parámetros requeridos: file, solicitudId, ticket' },
                { status: 400 }
            )
        }

        const supabaseAdmin = createAdminClient()

        // 1. Upload file to storage bucket
        const fileExt = file.name.split('.').pop()
        const fileName = `${ticket}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `solicitudes/${solicitudId}/${fileName}`

        const bucketName = 'solicitudes_documentos'

        // Auto-create bucket if it doesn't exist (service role bypasses RLS)
        const { data: buckets } = await supabaseAdmin.storage.listBuckets()
        const bucketExists = buckets?.some(b => b.name === bucketName)
        if (!bucketExists) {
            await supabaseAdmin.storage.createBucket(bucketName, {
                public: false,
                fileSizeLimit: 52428800, // 50MB
                allowedMimeTypes: [
                    'application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ]
            })
        }

        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, fileBuffer, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) {
            return NextResponse.json(
                { error: `Error al subir a storage: ${uploadError.message}` },
                { status: 500 }
            )
        }

        // 2. Insert record in nexus.documentos table
        const { data: docData, error: dbError } = await supabaseAdmin
            .from('documentos')
            .insert({
                solicitud_id: solicitudId,
                filename: file.name,
                path: filePath
            })
            .select()
            .single()

        if (dbError) {
            // Rollback: delete file from storage if DB insert fails
            await supabaseAdmin.storage
                .from('solicitudes_documentos')
                .remove([filePath])
            return NextResponse.json(
                { error: `Error al registrar en base de datos: ${dbError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, document: docData, path: filePath })

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Error interno del servidor' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { documentId, path } = await request.json()

        if (!documentId || !path) {
            return NextResponse.json(
                { error: 'Faltan parámetros: documentId, path' },
                { status: 400 }
            )
        }

        const supabaseAdmin = createAdminClient()

        // 1. Delete from storage
        const { error: storageError } = await supabaseAdmin.storage
            .from('solicitudes_documentos')
            .remove([path])

        if (storageError) {
            return NextResponse.json(
                { error: `Error al eliminar de storage: ${storageError.message}` },
                { status: 500 }
            )
        }

        // 2. Delete from DB
        const { error: dbError } = await supabaseAdmin
            .from('documentos')
            .delete()
            .eq('id', documentId)

        if (dbError) {
            return NextResponse.json(
                { error: `Error al eliminar de base de datos: ${dbError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
