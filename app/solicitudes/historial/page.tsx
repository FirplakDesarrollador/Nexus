'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// "Historial" se unificó con "Estado de Compra" en un solo módulo con un switch
// Activas/Finalizadas — este archivo solo existe para no romper enlaces viejos.
export default function HistorialRedirectPage() {
    const router = useRouter()
    useEffect(() => {
        router.replace('/solicitudes/estado?vista=finalizadas')
    }, [router])
    return <div className="list-container"><p>Redirigiendo...</p></div>
}
