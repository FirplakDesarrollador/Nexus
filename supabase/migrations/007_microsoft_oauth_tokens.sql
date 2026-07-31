-- Conexión delegada de Microsoft (Nallely autoriza una vez) para leer su correo,
-- registro de correos ya procesados (evita duplicados), y permiso para editar
-- Estado/Observaciones desde la pestaña "Visualizar Archivo".
SET search_path TO nexus, public;

-- Distingue de dónde vino cada fila: el sync del Excel poda (borra) las filas que no
-- toca en cada corrida, asumiendo que el Excel es la fuente completa — sin esta columna,
-- esa poda borraría también las filas que llegaron por correo (que el Excel no conoce).
ALTER TABLE nexus.variacion_costos
    ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'excel';
UPDATE nexus.variacion_costos SET origen = 'excel' WHERE origen IS NULL;

-- Tokens delegados: solo accesibles desde el servidor (service role). Sin políticas
-- de RLS a propósito — nunca debe llegar al navegador, ni siquiera de un admin.
CREATE TABLE IF NOT EXISTS nexus.microsoft_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    connected_by UUID REFERENCES nexus.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nexus.microsoft_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Correos ya ingeridos, para no duplicar filas si se corre "Revisar correos ahora"
-- varias veces o el cron se solapa con el botón manual.
CREATE TABLE IF NOT EXISTS nexus.variacion_correos_procesados (
    message_id TEXT PRIMARY KEY,
    received_at TIMESTAMPTZ,
    filas_insertadas INTEGER DEFAULT 0,
    procesado_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nexus.variacion_correos_procesados ENABLE ROW LEVEL SECURITY;

-- Edición inline de Estado/Observaciones desde "Visualizar Archivo" (hoy solo existía
-- una política de SELECT para admin; faltaba UPDATE).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'nexus' AND tablename = 'variacion_costos' AND policyname = 'Admin can update variacion_costos'
    ) THEN
        CREATE POLICY "Admin can update variacion_costos" ON nexus.variacion_costos
            FOR UPDATE
            USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'))
            WITH CHECK (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));
    END IF;
END $$;
