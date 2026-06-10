import { NextRequest, NextResponse } from 'next/server'

const TENANT_ID    = process.env.MICROSOFT_GRAPH_TENANT_ID!
const CLIENT_ID    = process.env.MICROSOFT_GRAPH_CLIENT_ID!
const CLIENT_SECRET= process.env.MICROSOFT_GRAPH_CLIENT_SECRET!

const SITE_URL = 'https://firplaksa.sharepoint.com/sites/DESARROLLODEPRODUCTOS'

async function getAccessToken(): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
    })
    const res = await fetch(tokenUrl, { method: 'POST', body })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(`Token error: ${err}`)
    }
    const json = await res.json()
    return json.access_token
}

async function getSiteId(token: string): Promise<string> {
    // Extraer host y serverRelativePath del SITE_URL
    const url = new URL(SITE_URL)
    const host = url.hostname                           // firplaksa.sharepoint.com
    const sitePath = url.pathname                       // /sites/DESARROLLODEPRODUCTOS

    const res = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${host}:${sitePath}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error('No se pudo obtener el Site ID de SharePoint')
    const json = await res.json()
    return json.id
}

async function getDriveId(token: string, siteId: string): Promise<string> {
    const res = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error('No se pudo listar los drives del sitio')
    const json = await res.json()
    // Obtener el drive principal "Documents"
    const drive = json.value.find((d: any) =>
        d.name === 'Documents' || d.name === 'Shared Documents' || d.driveType === 'documentLibrary'
    ) ?? json.value[0]
    if (!drive) throw new Error('No se encontró un drive válido en el sitio')
    return drive.id
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

        const token = await getAccessToken()
        const siteId = await getSiteId(token)
        const driveId = await getDriveId(token, siteId)

        // Convertir base64 a binario
        const binary = Buffer.from(fileContent, 'base64')

        // Carpeta relativa al drive: quitar el prefijo '/Shared Documents'
        const relativePath = folderPath
            .replace(/^\/Shared Documents/, '')
            .replace(/^\/Documents/, '')

        // Construir la ruta de upload con carpeta relativa
        const uploadPath = relativePath
            ? `${relativePath}/${fileName}`
            : `/${fileName}`

        // PUT simple upload (hasta 4MB — para archivos más grandes usar upload session)
        const uploadUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:${uploadPath}:/content`

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/octet-stream'
            },
            body: binary
        })

        if (!uploadRes.ok) {
            const err = await uploadRes.text()
            throw new Error(`Error al subir archivo: ${err}`)
        }

        const uploaded = await uploadRes.json()
        return NextResponse.json({
            url: uploaded.webUrl ?? `${SITE_URL}${folderPath}/${fileName}`,
            name: uploaded.name,
            size: uploaded.size
        })

    } catch (err: any) {
        console.error('[muestras/upload]', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
