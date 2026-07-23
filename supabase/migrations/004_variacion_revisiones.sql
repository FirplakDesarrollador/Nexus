-- Identidad estable entre sincronizaciones e indicador de seguimiento.
-- Permite: (a) upsert por source_key en vez de truncar la tabla cada noche,
-- (b) detectar en el dashboard casos "En proceso" que llevan varias
-- sincronizaciones consecutivas sin cerrarse (posible negociación estancada).
SET search_path TO nexus, public;

ALTER TABLE nexus.variacion_costos
    ADD COLUMN IF NOT EXISTS source_key TEXT,
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS revisiones_en_proceso INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_variacion_costos_source_key ON nexus.variacion_costos(source_key);
