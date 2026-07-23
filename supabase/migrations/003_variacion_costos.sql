-- Mirror table for "Variacion del costo.xlsx" (SharePoint, sheet "BD"), refreshed nightly via Graph sync
SET search_path TO nexus, public;

CREATE TABLE IF NOT EXISTS nexus.variacion_costos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_correo DATE,
    tipo_documento TEXT,
    numero_documento TEXT,
    fecha_contabilizacion DATE,
    cod_proveedor TEXT,
    descripcion_proveedor TEXT,
    cod_item TEXT,
    descripcion_item TEXT,
    precio NUMERIC,
    precio_prom_almacen NUMERIC,
    diferencia_precios NUMERIC,
    porc_variacion NUMERIC,
    penultimo_precio_prov NUMERIC,
    dif_vs_penultimo_precio NUMERIC,
    porc_vs_penultimo NUMERIC,
    cantidad NUMERIC,
    total_linea NUMERIC,
    precio_lista_precios NUMERIC,
    numero_lista_precio TEXT,
    obs_nl TEXT,
    responsable TEXT,
    estado TEXT,
    avoidance_ahorro NUMERIC,
    si_no TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variacion_costos_cod_item ON nexus.variacion_costos(cod_item);
CREATE INDEX IF NOT EXISTS idx_variacion_costos_cod_proveedor ON nexus.variacion_costos(cod_proveedor);
CREATE INDEX IF NOT EXISTS idx_variacion_costos_fecha_correo ON nexus.variacion_costos(fecha_correo);

ALTER TABLE nexus.variacion_costos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read variacion_costos" ON nexus.variacion_costos
    FOR SELECT USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));
