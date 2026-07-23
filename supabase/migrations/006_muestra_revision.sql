-- Habilita el flujo de revisión (retroalimentar / aprobar / rechazar) sobre nexus.muestras:
-- columnas para adjuntar evidencia y registrar quién aprueba/rechaza en cada entrada del
-- historial, y políticas para que cualquier usuario autenticado (no solo el solicitante
-- original) pueda ver y revisar todas las muestras — es una cola compartida de revisión.
SET search_path TO nexus, public;

ALTER TABLE nexus.muestra_estados_hist
    ADD COLUMN IF NOT EXISTS evidencia_url TEXT,
    ADD COLUMN IF NOT EXISTS aprobador_nombre TEXT,
    ADD COLUMN IF NOT EXISTS aprobador_email TEXT;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'nexus' AND tablename = 'muestras' AND policyname = 'Authenticated can read all muestras'
    ) THEN
        CREATE POLICY "Authenticated can read all muestras" ON nexus.muestras
            FOR SELECT USING (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'nexus' AND tablename = 'muestras' AND policyname = 'Authenticated can update estado muestras'
    ) THEN
        CREATE POLICY "Authenticated can update estado muestras" ON nexus.muestras
            FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'nexus' AND tablename = 'muestra_estados_hist' AND policyname = 'Authenticated can read all estado hist'
    ) THEN
        CREATE POLICY "Authenticated can read all estado hist" ON nexus.muestra_estados_hist
            FOR SELECT USING (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'nexus' AND tablename = 'muestra_estados_hist' AND policyname = 'Authenticated can insert estado hist'
    ) THEN
        CREATE POLICY "Authenticated can insert estado hist" ON nexus.muestra_estados_hist
            FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;
