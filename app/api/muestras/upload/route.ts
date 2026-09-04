import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'muestras_documentos'

function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!serviceKey || serviceKey === 'tu_service_role_key_aqui') {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurado en .env')
    }
    return createClient(url, serviceKey, {
        auth: { persistSession: false }
    })
}

async function ensureBucket(supabaseAdmin: ReturnType<typeof createAdminClient>) {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
    if (!bucketExists) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
            public: true,
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
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { fileName, fileContent, folderPath } = body as {
            fileName: string
            fileContent: string   // base64
            folderPath: string    // e.g. '/Shared Documents/Fichas Tec Homologacion de productos'
        }

        if (!fileName || !fileContent || !folderPath) {
            return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()
        await ensureBucket(supabaseAdmin)

        // Deriva una subcarpeta corta y legible a partir del folderPath heredado de SharePoint
        const folderSlug = folderPath
            .toLowerCase()
            .replace(/^\/shared documents\//, '')
            .replace(/^\/documents\//, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')

        const ext = fileName.includes('.') ? fileName.split('.').pop() : ''
        const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ''}`
        const filePath = folderSlug ? `${folderSlug}/${uniqueName}` : uniqueName

        const binary = Buffer.from(fileContent, 'base64')

        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(filePath, binary, { upsert: false })

        if (uploadError) {
            throw new Error(`Error al subir archivo: ${uploadError.message}`)
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath)

        return NextResponse.json({
            url: publicUrlData.publicUrl,
            name: fileName,
            size: binary.length
        })

    } catch (err: any) {
        console.error('[muestras/upload]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
