const { createClient } = require('@supabase/supabase-js');
const url = 'https://lnphhmowklqiomownurw.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';
const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.schema('nexus')
        .from('solicitudes')
        .select(`*, solicitante:users!solicitante_id(nombre, area), centro_costos:centros_costos(nombre), cierres_compra(proveedor, valor_total_compra, cantidad_total, tipo_resultado, created_at)`)
        .not('closed_at', 'is', null)
        .order('closed_at', { ascending: false });

    console.log(JSON.stringify(data, null, 2));
    if (error) console.error(error);
}
run();
