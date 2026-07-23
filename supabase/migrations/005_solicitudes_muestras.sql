-- Solicitudes de muestra a proveedor (distinto del flujo de homologación de nexus.muestras).
-- Cada solicitud dispara la creación de una tarea en Microsoft Planner.
SET search_path TO nexus, public;

CREATE TABLE IF NOT EXISTS nexus.solicitudes_muestras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitante_id UUID NOT NULL REFERENCES nexus.users(id),
    producto TEXT NOT NULL,
    especificaciones TEXT,
    proposito TEXT,
    observaciones TEXT,
    planner_task_id TEXT,
    planner_task_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nexus.solicitudes_muestras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solicitante can CRUD sus solicitudes de muestra" ON nexus.solicitudes_muestras
    FOR ALL USING (solicitante_id = auth.uid());

CREATE POLICY "Admin can manage all solicitudes de muestra" ON nexus.solicitudes_muestras
    FOR ALL USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));
