-- Add asistencia table
CREATE TABLE IF NOT EXISTS asistencia_chofer (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_chofer UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    estado TEXT NOT NULL CHECK (estado IN ('trabajo', 'descanso', 'falta', 'permiso')),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(id_chofer, fecha)
);

-- RLS Policies
ALTER TABLE asistencia_chofer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
    ON asistencia_chofer FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" 
    ON asistencia_chofer FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" 
    ON asistencia_chofer FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" 
    ON asistencia_chofer FOR DELETE USING (auth.role() = 'authenticated');
