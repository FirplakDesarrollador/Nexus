-- Create the nexus schema
CREATE SCHEMA IF NOT EXISTS nexus;
SET search_path TO nexus, public;

-- Users table (profiles)
CREATE TABLE IF NOT EXISTS nexus.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('SOLICITANTE', 'ADMIN')),
    area TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Centers
CREATE TABLE IF NOT EXISTS nexus.centros_costos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    codigo TEXT UNIQUE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Accounts
CREATE TABLE IF NOT EXISTS nexus.cuentas_contables (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Requests (Solicitudes)
CREATE TABLE IF NOT EXISTS nexus.solicitudes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket TEXT UNIQUE NOT NULL, -- Format like NEX-0001
    solicitante_id UUID NOT NULL REFERENCES nexus.users(id),
    responsable_id UUID REFERENCES nexus.users(id), -- From nexus.users
    titulo TEXT NOT NULL,
    proposito TEXT,
    cantidad INTEGER NOT NULL DEFAULT 1,
    proveedor_sugerido TEXT,
    exclusividad TEXT CHECK (exclusividad IN ('SI', 'NO', 'NA')),
    prioridad TEXT NOT NULL CHECK (prioridad IN ('Urgente', 'Alta', 'Media', 'Baja')),
    tipo_operacion TEXT CHECK (tipo_operacion IN ('PTS', 'PTO', 'COMPRA_UNICA')),
    fecha_entrega_requerida DATE,
    centro_costos_id INTEGER REFERENCES nexus.centros_costos(id),
    cuenta_contable_id INTEGER REFERENCES nexus.cuentas_contables(id),
    presupuesto_estimado DECIMAL(15,2),
    estado_actual TEXT NOT NULL DEFAULT 'Revisión',
    observacion_actual TEXT,
    motivo_rechazo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- Status History
CREATE TABLE IF NOT EXISTS nexus.solicitud_estados_hist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES nexus.solicitudes(id) ON DELETE CASCADE,
    estado TEXT NOT NULL,
    observacion TEXT,
    actor_id UUID REFERENCES nexus.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS nexus.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES nexus.solicitudes(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    mime TEXT,
    size BIGINT,
    uploaded_by UUID REFERENCES nexus.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications Outbox (for Power Automate)
CREATE TABLE IF NOT EXISTS nexus.notifications_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSED, ERROR
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- RLS Enablement
ALTER TABLE nexus.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.centros_costos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.cuentas_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.solicitud_estados_hist ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus.notifications_outbox ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Draft)
-- Users can read their own profile
CREATE POLICY "Users can read their own profile" ON nexus.users
    FOR SELECT USING (auth.uid() = id);

-- Admin can read all users
CREATE POLICY "Admins can read all users" ON nexus.users
    FOR SELECT USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));

-- Solicitante can CRUD their own requests
CREATE POLICY "Solicitante can CRUD their own requests" ON nexus.solicitudes
    FOR ALL USING (solicitante_id = auth.uid());

-- Admin can manage all requests
CREATE POLICY "Admin can manage all requests" ON nexus.solicitudes
    FOR ALL USING (EXISTS (SELECT 1 FROM nexus.users WHERE id = auth.uid() AND rol = 'ADMIN'));

-- Seed initial data for testing
INSERT INTO nexus.centros_costos (nombre, codigo) VALUES 
    ('Administración', 'CC001'), 
    ('Ventas', 'CC002'), 
    ('Producción', 'CC003'), 
    ('Mantenimiento', 'CC004');
INSERT INTO nexus.cuentas_contables (nombre, codigo) VALUES ('Gastos Generales', '510101'), ('Suministros', '510102'), ('Equipo Oficina', '510103');
