# Nexus | Gestión de Compras

Nexus es una aplicación premium diseñada para la gestión eficiente de solicitudes de compra corporativas, construida con Next.js y Supabase.

## 🚀 Tecnologías
- **Frontend**: Next.js 14+ (App Router), Vanilla CSS, Lucide Icons.
- **Backend**: Supabase (Auth, PostgreSQL, RLS).
- **Integración**: Power Automate Outbox Pattern, Teams Webhook.

## 🛠️ Configuración

### 1. Variables de Entorno
Crea un archivo `.env.local` con las siguientes credenciales de Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_key_service_role (requerida para webhooks)
```

### 2. Base de Datos (Supabase)
Ejecuta el script de migración ubicado en `supabase/migrations/001_initial_schema.sql` en el SQL Editor de tu proyecto Supabase. 
> [!IMPORTANT]
> Esto creará el esquema `nexus` y las tablas necesarias con políticas de seguridad RLS.

### 3. Instalación
```bash
npm install
npm run dev
```

## 🔄 Flujo de Integración
### Power Automate / Teams
1. **Outbox**: Cuando se crea una solicitud, se inserta un registro en `nexus.notifications_outbox`.
2. **Activador**: Configura un flujo en Power Automate que escanee esta tabla.
3. **Decisión**: Los botones en Teams deben llamar al endpoint:
   `POST /api/webhooks/teams-decision`
   ```json
   {
     "ticket_id": "NEX-0001",
     "decision": "APPROVE",
     "observacion": "Aprobado desde Teams",
     "motivo_rechazo": null
   }
   ```

## 📋 Checklist de Pruebas Manuales
1. [ ] Registro de nuevo usuario (Solicitante).
2. [ ] Inicio de sesión con persistencia.
3. [ ] Creación de solicitud con validación de campos obligatorios.
4. [ ] Visualización de solicitud en "Estado de Compra".
5. [ ] Acceso de Administradora (Nalle) al Panel Maestro.
6. [ ] Cambio de estado de una solicitud desde el panel Admin.
7. [ ] Cierre de ticket y aparición en "Historial".
8. [ ] Prueba de Webhook simulada (Postman).
9. [ ] Visualización de métricas en Reportes.
10. [ ] Verificación de RLS (un solicitante no ve solicitudes ajenas).
