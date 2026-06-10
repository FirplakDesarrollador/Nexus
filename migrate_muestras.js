/**
 * Migration script: PowerApp "Registro de Muestras" CSV → Supabase nexus.muestras
 * 
 * STEP 1: Go to Supabase SQL Editor and run the ALTER TABLE below first.
 * STEP 2: Then run:  node migrate_muestras.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lnphhmowklqiomownurw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGhobW93a2xxaW9tb3dudXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjAzNDAyNSwiZXhwIjoyMDA3NjEwMDI1fQ.J-2EWGSL4Gro06MYBFVLQNnjbeDGYqjeLy1x8SdR2ms';

const CSV_PATH = path.join('C:\\Users\\milton.rendon\\Downloads', 'Registro de muestras.csv');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    db: { schema: 'nexus' }
});

// ─────────────────────────────────────────────
// 1. CSV Parser (handles quoted fields with newlines, commas, escaped quotes)
// ─────────────────────────────────────────────
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
        const ch = csvText[i];

        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < csvText.length && csvText[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                currentField += ch;
                i++;
                continue;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
                continue;
            } else if (ch === ',') {
                currentRow.push(currentField.trim());
                currentField = '';
                i++;
                continue;
            } else if (ch === '\r') {
                i++;
                continue;
            } else if (ch === '\n') {
                currentRow.push(currentField.trim());
                currentField = '';
                if (currentRow.length > 1 || currentRow[0] !== '') {
                    rows.push(currentRow);
                }
                currentRow = [];
                i++;
                continue;
            } else {
                currentField += ch;
                i++;
                continue;
            }
        }
    }

    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
    }

    return rows;
}

// ─────────────────────────────────────────────
// 2. Date Parsing
// ─────────────────────────────────────────────
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    const s = dateStr.trim();

    // "M/D/YYYY h:mm:ss AM/PM" or "M/D/YYYY h:mm AM/PM"
    const dtMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (dtMatch) {
        const month = parseInt(dtMatch[1]) - 1;
        const day = parseInt(dtMatch[2]);
        const year = parseInt(dtMatch[3]);
        let hours = parseInt(dtMatch[4]);
        const mins = parseInt(dtMatch[5]);
        const secs = dtMatch[6] ? parseInt(dtMatch[6]) : 0;
        const ampm = dtMatch[7];
        if (ampm) {
            if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
        }
        return new Date(year, month, day, hours, mins, secs).toISOString();
    }

    // "M/D/YYYY"
    const dMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dMatch) {
        const month = parseInt(dMatch[1]) - 1;
        const day = parseInt(dMatch[2]);
        const year = parseInt(dMatch[3]);
        return new Date(year, month, day, 12, 0, 0).toISOString();
    }

    return null;
}

// ─────────────────────────────────────────────
// 3. Estado mapping
// ─────────────────────────────────────────────
function mapEstado(rawEstado, aprobacion) {
    const e = (rawEstado || '').trim().toLowerCase();
    const a = (aprobacion || '').trim().toLowerCase();
    
    if (e === 'aprobado' || a === 'aprobado' || a === 'aprobado con cambios') return 'Aprobada';
    if (e === 'rechazado') return 'Rechazada';
    if (e === 'en proceso') return 'En Prueba';
    if (e === 'solicitado') return 'Pendiente';
    return 'Pendiente';
}

// ─────────────────────────────────────────────
// 4. Main
// ─────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  Migración de Muestras Homologadas (PowerApp → Nexus)   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // ─── Step 0: Add legacy columns via SQL ───
    console.log('🔧 Paso 0: Añadiendo columnas legacy al esquema...');
    let sqlError = null;
    try {
        const res = await supabase.rpc('exec_sql', { sql: `SELECT 1` });
        sqlError = res.error;
    } catch (e) {
        sqlError = e;
    }

    // Use direct SQL through the admin API
    const alterRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    }).catch(() => null);

    // We'll just try inserting - if columns don't exist, we'll get an error and print the SQL
    console.log('   → Se intentará insertar. Si faltan columnas, se mostrará el SQL necesario.\n');

    // ─── Step 1: Read CSV ───
    console.log('📄 Paso 1: Leyendo CSV...');
    const raw = fs.readFileSync(CSV_PATH, 'utf-8');
    const rows = parseCSV(raw);
    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`   ${dataRows.length} filas de datos encontradas\n`);

    // Map column indices
    const colIdx = {};
    headers.forEach((h, i) => { colIdx[h] = i; });

    // ─── Step 2: Build records ───
    console.log('🔨 Paso 2: Procesando registros...');
    const records = [];
    let skipped = 0;

    for (let r = 0; r < dataRows.length; r++) {
        const row = dataRows[r];
        
        const get = (col) => {
            const idx = colIdx[col];
            return (idx !== undefined && idx < row.length) ? row[idx] : '';
        };

        const solicitante = get('Solicitante de la muestra');
        const producto = get('Producto solicitado');
        const referencia = get('Referencia');
        const proveedorNuevo = get('Proveedor nuevo');
        const productoHomologo = get('Producto homólogo');
        const proveedorActual = get('Proveedor actual');
        const estadoRaw = get('Estado de la muestra');
        const aprobador = get('¿Quién debe aprobar?');
        const fechaIngreso = get('Fecha de ingreso de la muestra física');
        const ensayos = get('Ensayos efectuados');
        const resultados = get('Resultados');
        const conclusiones = get('Conclusiones');
        const creado = get('Creado');
        const modificado = get('Modificado');
        const modificadoPor = get('Modificado por');
        const adjuntos = get('Datos adjuntos') || '0';
        const aprobacion = get('Aprobacion');

        if (!producto && !solicitante) {
            skipped++;
            continue;
        }

        const estado = mapEstado(estadoRaw, aprobacion);

        records.push({
            ticket: `M-${String(r + 1).padStart(4, '0')}-L`,
            nombre_producto: (producto || 'Sin nombre').substring(0, 500),
            referencia: referencia || null,
            proveedor: proveedorNuevo || proveedorActual || 'No especificado',
            marca: null,
            categoria: 'Otro',
            unidad_medida: 'Unidades',
            cantidad: 1,
            descripcion: conclusiones ? conclusiones.substring(0, 5000) : null,
            proposito_homologacion: productoHomologo ? 'Nuevo proveedor alternativo' : null,
            aplicacion: ensayos ? ensayos.substring(0, 5000) : null,
            estado: estado,
            solicitante_nombre: solicitante || null,
            producto_homologo: productoHomologo || null,
            proveedor_actual: proveedorActual || null,
            aprobador_nombre: aprobador || null,
            fecha_ingreso_muestra: parseDate(fechaIngreso),
            ensayos_efectuados: ensayos || null,
            resultados: resultados || null,
            conclusiones_legacy: conclusiones || null,
            modificado_por: modificadoPor || null,
            tiene_adjuntos: parseInt(adjuntos) > 0,
            created_at: parseDate(creado) || new Date().toISOString(),
            updated_at: parseDate(modificado) || parseDate(creado) || new Date().toISOString(),
            es_migracion_legacy: true
        });
    }

    console.log(`   ✅ ${records.length} registros listos (${skipped} vacíos omitidos)\n`);

    // ─── Step 3: Insert in batches ───
    console.log('📥 Paso 3: Insertando en Supabase...\n');
    
    const BATCH_SIZE = 25;
    let insertedCount = 0;
    let errorCount = 0;
    const errorDetails = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(records.length / BATCH_SIZE);

        const { data, error } = await supabase
            .from('muestras')
            .insert(batch)
            .select('id, ticket');

        if (error) {
            errorCount += batch.length;
            errorDetails.push({ batch: batchNum, message: error.message, hint: error.hint });
            console.log(`   ❌ Lote ${batchNum}/${totalBatches}: ${error.message}`);

            if (error.message.includes('column') && error.message.includes('does not exist')) {
                console.log('\n   ╔══════════════════════════════════════════════════════════╗');
                console.log('   ║  ⚠️ FALTAN COLUMNAS EN LA TABLA                         ║');
                console.log('   ║  Ejecuta este SQL en Supabase SQL Editor:                ║');
                console.log('   ╚══════════════════════════════════════════════════════════╝\n');
                console.log(`ALTER TABLE nexus.muestras 
    ADD COLUMN IF NOT EXISTS solicitante_nombre text,
    ADD COLUMN IF NOT EXISTS producto_homologo text,
    ADD COLUMN IF NOT EXISTS proveedor_actual text,
    ADD COLUMN IF NOT EXISTS aprobador_nombre text,
    ADD COLUMN IF NOT EXISTS fecha_ingreso_muestra timestamptz,
    ADD COLUMN IF NOT EXISTS ensayos_efectuados text,
    ADD COLUMN IF NOT EXISTS resultados text,
    ADD COLUMN IF NOT EXISTS conclusiones_legacy text,
    ADD COLUMN IF NOT EXISTS modificado_por text,
    ADD COLUMN IF NOT EXISTS tiene_adjuntos boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS es_migracion_legacy boolean DEFAULT false;`);
                console.log('\n   Luego vuelve a ejecutar: node migrate_muestras.js\n');
                process.exit(1);
            }
        } else {
            insertedCount += data.length;
            const tickets = data.map(d => d.ticket).filter(Boolean);
            console.log(`   ✅ Lote ${batchNum}/${totalBatches}: ${data.length} registros (${tickets[0]} ... ${tickets[tickets.length - 1]})`);
        }

        // Rate limit delay
        await new Promise(r => setTimeout(r, 300));
    }

    // ─── Summary ───
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║       RESUMEN DE MIGRACIÓN            ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log(`║  ✅ Insertados:  ${String(insertedCount).padStart(4)}               ║`);
    console.log(`║  ❌ Errores:     ${String(errorCount).padStart(4)}               ║`);
    console.log(`║  📊 Total CSV:   ${String(records.length).padStart(4)}               ║`);
    console.log('╚═══════════════════════════════════════╝\n');

    if (errorDetails.length > 0 && errorCount > 0) {
        console.log('Errores:');
        errorDetails.forEach(e => console.log(`  Lote ${e.batch}: ${e.message}`));
    }

    if (insertedCount > 0) {
        console.log('🎉 ¡Migración completada! Los registros están en /muestras/historial');
    }
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
