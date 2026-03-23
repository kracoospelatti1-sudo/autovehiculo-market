// Script para descargar marcas y modelos de MercadoLibre Argentina
// Ejecutar: node scripts/fetch-brands.js
// Genera: public/brands-data.json

const https = require('https');
const fs = require('fs');
const path = require('path');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AutoVenta/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchBrandsAndModels(categoryId, label) {
  console.log(`\nFetching ${label} attributes...`);
  const attrs = await get(`https://api.mercadolibre.com/categories/${categoryId}/attributes`);

  const brandAttr = attrs.find(a => a.id === 'BRAND');
  const modelAttr  = attrs.find(a => a.id === 'MODEL');

  if (!brandAttr) throw new Error(`No BRAND attribute in ${categoryId}`);

  const brands = brandAttr.values || [];
  const allModels = modelAttr ? (modelAttr.values || []) : [];

  console.log(`  ${brands.length} marcas, ${allModels.length} modelos totales`);

  // Build brand→models map using model metadata (metadata.brand_id links models to brands)
  const brandById = {};
  for (const b of brands) brandById[b.id] = b.name;

  const result = {};

  // Initialize all brands with empty arrays
  for (const b of brands) result[b.name] = [];

  // Assign models to brands via metadata
  for (const m of allModels) {
    const brandId = m.metadata?.brand_id;
    if (brandId && brandById[brandId]) {
      result[brandById[brandId]].push(m.name);
    }
  }

  // Sort models for each brand, remove brands with 0 models
  const clean = {};
  for (const [brand, models] of Object.entries(result)) {
    if (models.length > 0) {
      clean[brand] = models.sort();
    }
  }

  // Log brands that got models
  const withModels = Object.keys(clean).length;
  console.log(`  ${withModels} marcas con modelos asignados`);

  return clean;
}

async function main() {
  const carBrands  = await fetchBrandsAndModels('MLA1744', 'Autos y Camionetas');
  const motoBrands = await fetchBrandsAndModels('MLA1763', 'Motos');

  const output = { carBrands, motoBrands };

  const outPath = path.join(__dirname, '../public/brands-data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone!`);
  console.log(`  Autos: ${Object.keys(carBrands).length} marcas`);
  console.log(`  Motos: ${Object.keys(motoBrands).length} marcas`);
  console.log(`  Guardado en public/brands-data.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
