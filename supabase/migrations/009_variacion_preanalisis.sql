-- Motor de preanálisis automático de variación de costos: columnas de clasificación,
-- trazabilidad por fila y resumen por corrida (alimenta el botón "ANALIZAR" en la UI).
-- También remapea los estados existentes a los nuevos nombres canónicos.
SET search_path TO nexus, public;

ALTER TABLE nexus.variacion_costos
    ADD COLUMN IF NOT EXISTS prioridad TEXT CHECK (prioridad IN ('Alta', 'Media', 'Baja')),
    ADD COLUMN IF NOT EXISTS motivo_alerta TEXT,
    ADD COLUMN IF NOT EXISTS ultimo_costo_historico NUMERIC,
    ADD COLUMN IF NOT EXISTS fecha_ultimo_costo_historico DATE,
    ADD COLUMN IF NOT EXISTS origen_cierre TEXT CHECK (origen_cierre IN (
        'auto_mismo_costo', 'auto_penultimo', 'auto_bi', 'auto_material_nuevo',
        'auto_excluido', 'manual'
    )),
    ADD COLUMN IF NOT EXISTS analizado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS impacto_acumulado_grupo NUMERIC;

-- Remapeo de estados existentes a los nuevos nombres canónicos (PENDIENTE / EN ANÁLISIS
-- / FINALIZADO / NO APLICA). Los NULL se dejan como están — el motor los clasifica la
-- próxima vez que corra sobre filas "Entrada de Mercacía".
UPDATE nexus.variacion_costos SET estado = 'Pendiente' WHERE estado = 'Sin iniciar';
UPDATE nexus.variacion_costos SET estado = 'En análisis' WHERE estado = 'En proceso';

CREATE TABLE IF NOT EXISTS nexus.variacion_analisis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalizado_en TIMESTAMPTZ,
    total_recibidos INTEGER DEFAULT 0,
    total_auto_finalizado INTEGER DEFAULT 0,
    total_no_aplica INTEGER DEFAULT 0,
    total_pendiente INTEGER DEFAULT 0,
    total_en_analisis INTEGER DEFAULT 0,
    total_nuevos_pendientes INTEGER DEFAULT 0,
    prioridad_alta INTEGER DEFAULT 0,
    prioridad_media INTEGER DEFAULT 0,
    prioridad_baja INTEGER DEFAULT 0,
    impacto_pendiente_total NUMERIC DEFAULT 0,
    estado_run TEXT NOT NULL DEFAULT 'ok' CHECK (estado_run IN ('ok', 'error')),
    error_detalle TEXT
);

CREATE INDEX IF NOT EXISTS idx_variacion_analisis_runs_iniciado_en
    ON nexus.variacion_analisis_runs(iniciado_en DESC);

CREATE TABLE IF NOT EXISTS nexus.variacion_analisis_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES nexus.variacion_analisis_runs(id) ON DELETE CASCADE,
    variacion_costos_id UUID REFERENCES nexus.variacion_costos(id) ON DELETE CASCADE,
    cod_proveedor TEXT,
    cod_item TEXT,
    regla_aplicada TEXT NOT NULL,
    resultado_estado TEXT NOT NULL,
    observacion TEXT,
    ultimo_costo_historico NUMERIC,
    fecha_ultimo_costo_historico DATE,
    bi_consultado BOOLEAN NOT NULL DEFAULT false,
    bi_resultado TEXT,
    prioridad TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variacion_analisis_log_run_id ON nexus.variacion_analisis_log(run_id);
CREATE INDEX IF NOT EXISTS idx_variacion_analisis_log_variacion_costos_id ON nexus.variacion_analisis_log(variacion_costos_id);

ALTER TABLE nexus.variacion_analisis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.variacion_analisis_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read variacion_analisis_runs" ON nexus.variacion_analisis_runs
    FOR SELECT USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));

CREATE POLICY "Admin can read variacion_analisis_log" ON nexus.variacion_analisis_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));
