// Script de seed: agrega reseñas de prueba para Lucas Pelatti (user_id=28)
// Uso: node seed-ratings.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const REVIEWS = [
  { stars: 5, review: 'Excelente vendedor, muy responsable y el vehículo estaba en perfectas condiciones. ¡100% recomendable!' },
  { stars: 5, review: 'Trato impecable. Lucas fue muy honesto con el estado del auto y todo salió perfecto.' },
  { stars: 4, review: 'Buena experiencia de compra. Fue muy atento y respondió rápido. Lo recomiendo.' },
  { stars: 5, review: 'Todo perfecto, el auto estaba tal como se describía. Vendedor confiable y puntual.' },
  { stars: 4, review: 'Muy buena persona, sin complicaciones. Sin duda volvería a hacer negocios.' },
  { stars: 3, review: 'Trato correcto, aunque el proceso tardó un poco más de lo esperado. En general, bien.' },
];

async function main() {
  const TARGET_USER = 28; // Lucas Pelatti

  // Obtener otros usuarios
  const { data: users, error: usersErr } = await supabase
    .from('users').select('id').neq('id', TARGET_USER).limit(6);
  if (usersErr || !users?.length) { console.error('No se pudieron obtener usuarios:', usersErr?.message); return; }

  // Obtener un vehículo de Lucas para usar como contexto
  const { data: vehicles } = await supabase
    .from('vehicles').select('id').eq('user_id', TARGET_USER).limit(1);
  const vehicleId = vehicles?.[0]?.id;
  if (!vehicleId) { console.error('Lucas no tiene vehículos publicados'); return; }

  console.log(`Insertando reseñas para usuario ${TARGET_USER}, vehículo ${vehicleId}...`);

  let inserted = 0;
  for (let i = 0; i < Math.min(users.length, REVIEWS.length); i++) {
    const { error } = await supabase.from('ratings').insert({
      from_user_id: users[i].id,
      to_user_id: TARGET_USER,
      vehicle_id: vehicleId,
      stars: REVIEWS[i].stars,
      review: REVIEWS[i].review,
    });

    if (error) console.log(`  ✗ Error usuario ${users[i].id}: ${error.message}`);
    else { console.log(`  ✓ ${REVIEWS[i].stars}★ de usuario ${users[i].id}`); inserted++; }
  }
  console.log(`\nListo: ${inserted} reseñas insertadas.`);
}

main().catch(console.error);
