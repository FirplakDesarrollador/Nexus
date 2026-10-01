-- Espejo diario de "Entradas de Mercancia" (SAP Business One, OPDN/PDN1, items NOT LIKE
-- 'Z%') tal como lo arma el Power BI "BI Compras". Llave de cruce contra
-- nexus.variacion_costos: (cod_proveedor, cod_articulo) — verificado manualmente que
-- coincide con el cod_item/cod_proveedor que ya usa variacion_costos.
SET search_path TO nexus, public;

CREATE TABLE IF NOT EXISTS nexus.bi_entradas_mercancia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    documento TEXT NOT NULL,
    linea INTEGER NOT NULL DEFAULT 0,
    fecha_contabilizacion DATE,
    grupo_articulo TEXT,
    cod_articulo TEXT,
    descripcion TEXT,
    cod_proveedor TEXT,
    proveedor TEXT,
    cantidad NUMERIC,
    unidad_medida TEXT,
    precio NUMERIC,
    total_linea NUMERIC,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bi_entradas_mercancia_doc_linea
    ON nexus.bi_entradas_mercancia(documento, linea);
CREATE INDEX IF NOT EXISTS idx_bi_entradas_mercancia_prov_item
    ON nexus.bi_entradas_mercancia(cod_proveedor, cod_articulo);

ALTER TABLE nexus.bi_entradas_mercancia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read bi_entradas_mercancia" ON nexus.bi_entradas_mercancia
    FOR SELECT USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));
