import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const SCREENSHOTS = 'C:/tmp/admin_test';
fs.mkdirSync(SCREENSHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASS = 'admin123';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const jsErrors = [];
page.on('console', msg => { if (msg.type() === 'error') jsErrors.push(msg.text()); });
page.on('pageerror', err => jsErrors.push('PAGE ERROR: ' + err.message));

const shot = async (name) => {
  const p = path.join(SCREENSHOTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  [📸] ${p}`);
};
const log = msg => console.log(`>> ${msg}`);

// ─── 1. HOME ─────────────────────────────────────────────────────────────────
log('=== 1. HOME ===');
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await shot('01_home');

// ─── 2. LOGIN ────────────────────────────────────────────────────────────────
log('=== 2. LOGIN ===');
// Login es una sección, no un modal
await page.evaluate(() => showSection('login'));
await page.waitForTimeout(600);
await shot('02_login_section');

// Llenar y enviar
await page.fill('#loginEmail', ADMIN_EMAIL);
await page.fill('#loginPassword', ADMIN_PASS);
await shot('03_credentials');
await page.click('#loginBtn, #login button[type="submit"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);
await shot('04_post_login');

// Verificar si "Admin" es visible en navbar
const adminNavVisible = await page.locator('#navAdmin').isVisible();
log(`Admin en navbar visible: ${adminNavVisible}`);

if (!adminNavVisible) {
  log('ADVERTENCIA: Usuario no es admin o login falló');
  // Mostrar el toast si hay
  const toast = await page.locator('.toast, .alert, .notification').first().textContent().catch(() => '');
  log(`Toast/mensaje: ${toast}`);
}

// ─── 3. PANEL ADMIN ──────────────────────────────────────────────────────────
log('=== 3. PANEL ADMIN ===');
await page.evaluate(() => showSection('admin'));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot('05_admin_panel');

// Stats del admin
const statsHtml = await page.locator('#adminStats').innerHTML().catch(() => '(vacío)');
log(`adminStats HTML (100c): ${statsHtml.slice(0, 100)}`);

// ─── 4. TABS ADMIN ───────────────────────────────────────────────────────────
log('=== 4. TABS ADMIN ===');
const tabs = await page.locator('.admin-tab').allTextContents();
log(`Tabs encontrados: ${tabs.join(' | ')}`);

for (const tab of tabs) {
  log(`  Clickeando tab: ${tab}`);
  await page.click(`.admin-tab:has-text("${tab}")`);
  await page.waitForTimeout(1200);
  const safeName = tab.toLowerCase()
    .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i').replace(/ó/g,'o').replace(/ú/g,'u')
    .replace(/[^a-z0-9]/g,'_');
  await shot(`06_admin_tab_${safeName}`);

  // Contar filas en tabla
  const rows = await page.locator('#adminContent table tbody tr, #adminContent .list-item').count();
  log(`  Filas/items en "${tab}": ${rows}`);
}

// ─── 5. VEHÍCULOS PÚBLICOS ───────────────────────────────────────────────────
log('=== 5. VEHÍCULOS ===');
await page.evaluate(() => showSection('vehicles'));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot('07_vehicles_list');
const vehicleCards = await page.locator('.vehicle-card, .card, [class*="vehicle"]').count();
log(`Cards de vehículos: ${vehicleCards}`);

// ─── 6. DETALLE DE VEHÍCULO ──────────────────────────────────────────────────
log('=== 6. DETALLE VEHÍCULO ===');
try {
  await page.locator('.vehicle-card, .card').first().click({ timeout: 3000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await shot('08_vehicle_detail');

  // Verificar mapa
  const mapVisible = await page.locator('#vehicleMap, .leaflet-container').isVisible();
  log(`Mapa visible: ${mapVisible}`);

  // Verificar historial de precios
  const priceHistory = await page.locator('.price-history, #priceHistoryChart').isVisible().catch(() => false);
  log(`Historial precios visible: ${priceHistory}`);

  // Verificar botón compartir
  const shareBtn = await page.locator('[onclick*="shareVehicle"], .share-btn, text=Compartir').isVisible().catch(() => false);
  log(`Botón compartir visible: ${shareBtn}`);
} catch (e) {
  log(`No se pudo abrir detalle: ${e.message}`);
}

// ─── 7. PUBLICAR ─────────────────────────────────────────────────────────────
log('=== 7. PUBLICAR ===');
await page.evaluate(() => showSection('publish'));
await page.waitForTimeout(1000);
await shot('09_publish_form');
const publishInputs = await page.locator('#publish input, #publish select, #publish textarea').count();
log(`Inputs en formulario publicar: ${publishInputs}`);

// ─── 8. MIS ANUNCIOS ─────────────────────────────────────────────────────────
log('=== 8. MIS ANUNCIOS ===');
await page.evaluate(() => showSection('my-vehicles'));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot('10_my_vehicles');

// ─── 9. MENSAJES ─────────────────────────────────────────────────────────────
log('=== 9. MENSAJES ===');
await page.evaluate(() => showSection('messages'));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot('11_messages');

// ─── 10. PERFIL ──────────────────────────────────────────────────────────────
log('=== 10. PERFIL ===');
await page.evaluate(() => showSection('profile'));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await shot('12_profile');

// ─── REPORTE FINAL ───────────────────────────────────────────────────────────
log('\n=== REPORTE DE ERRORES JS ===');
if (jsErrors.length === 0) {
  log('✅ Sin errores JS detectados');
} else {
  log(`❌ ${jsErrors.length} error(es):`);
  jsErrors.forEach((e, i) => log(`  ${i+1}. ${e}`));
}

await browser.close();
log(`\n✅ Test completo. Screenshots en: ${SCREENSHOTS}`);
