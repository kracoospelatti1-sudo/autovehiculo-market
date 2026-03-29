const PLACEHOLDER_IMG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1a2e"/><text x="200" y="140" text-anchor="middle" fill="#444" font-size="48">&#x1F697;</text><text x="200" y="185" text-anchor="middle" fill="#555" font-size="16">Sin imagen</text></svg>')}`;

const MAX_VEHICLE_IMAGES = 15;
let currentUser = null;
let currentVehicleId = null;
let vehicleMapInstance = null;
let currentConversationId = null;
let currentProfileId = null;
let pollingInterval = null;
let searchTimeout = null;
let adminSearchTimeout = null;
let uploadedImages = [];
let editUploadedImages = [];
let publishImageDragSourceIndex = null;
let publishImageTouchDropIndex = null;
let reportVehicleId = null;
let rateConversationId = null;
let rateRecipientId = null;
let rateVehicleId = null;
let prestitoVehicleContext = null;
let prestitoConfigCache = null;
let lastMessageId = 0;
let isLoadingMessages = false;
let pollCount = 0;
let vehicleSearchAbortController = null;
let dolarRate = null;
let dolarRateInterval = null;
let userFavoriteIds = new Set();
let filtersDirty = false;
let leafletCssLoaded = false;
let homeRecentLoadedAt = 0;
let publicStatsLoadedAt = 0;
let lucideLoadPromise = null;
let hCaptchaLoadPromise = null;
let googleIdentityLoadPromise = null;
let googleLoginConfigPromise = null;
let googleLoginInitialized = false;
let myVehiclesPage = 1;
let myVehiclesHasMore = false;
let profileVehiclesPage = 1;
let profileVehiclesHasMore = false;
let profileVehiclesUserId = null;
let editProfileTarget = null;
let modalStack = [];
let mobileMenuTrigger = null;
let keyboardClickableObserver = null;
let currentSectionId = 'home';
let vehiclesCurrentPage = 1;
let vehiclesHistorySyncTimer = null;
let isHandlingPopState = false;
let searchCorrectionDictionary = [];
let searchCorrectionDisplayMap = new Map();

const VEHICLES_STATE_STORAGE_KEY = 'vehicles:list-state:v1';
const VEHICLES_FILTER_IDS = [
  'filterBrand',
  'filterModel',
  'filterMinPrice',
  'filterMaxPrice',
  'filterMinYear',
  'filterMaxYear',
  'filterMinMileage',
  'filterMaxMileage',
  'filterFuel',
  'filterTransmission',
  'filterCity',
  'filterProvince',
  'filterSort',
  'filterVehicleType'
];

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function ensureLeafletCss() {
  if (leafletCssLoaded || document.querySelector('link[data-leaflet-css="1"]')) {
    leafletCssLoaded = true;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.setAttribute('data-leaflet-css', '1');
  document.head.appendChild(link);
  leafletCssLoaded = true;
}

function loadLeaflet() {
  return new Promise((resolve) => {
    ensureLeafletCss();
    if (window.L) return resolve();
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

function loadLucideIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
    return Promise.resolve();
  }
  if (lucideLoadPromise) return lucideLoadPromise;
  lucideLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/lucide@latest';
    script.defer = true;
    script.onload = () => {
      if (window.lucide) window.lucide.createIcons();
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return lucideLoadPromise;
}

function loadHCaptcha() {
  if (window.hcaptcha) return Promise.resolve();
  if (hCaptchaLoadPromise) return hCaptchaLoadPromise;
  hCaptchaLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://js.hcaptcha.com/1/api.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return hCaptchaLoadPromise;
}

function renderHCaptchaContainer(container) {
  if (!container || !window.hcaptcha) return;
  if (container.dataset.hcaptchaWidgetId !== undefined && container.dataset.hcaptchaWidgetId !== '') return;
  const sitekey = String(container.dataset.sitekey || '').trim();
  if (!sitekey) return;
  try {
    const widgetId = window.hcaptcha.render(container, {
      sitekey,
      size: container.dataset.size || 'normal'
    });
    container.dataset.hcaptchaWidgetId = String(widgetId);
  } catch (e) {
    // Ignore re-render errors; widget can already be mounted by hCaptcha internals.
  }
}

function ensureHCaptchaForSection(sectionId) {
  if (!['register', 'support'].includes(sectionId)) return;
  loadHCaptcha().then(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    setTimeout(() => {
      section.querySelectorAll('.h-captcha').forEach((container) => renderHCaptchaContainer(container));
    }, 50);
  });
}

function getHCaptchaToken(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !window.hcaptcha) return '';
  const widgetIdRaw = container.dataset.hcaptchaWidgetId;
  if (widgetIdRaw === undefined || widgetIdRaw === '') return '';
  const widgetId = Number(widgetIdRaw);
  if (!Number.isFinite(widgetId)) return '';
  try {
    return String(window.hcaptcha.getResponse(widgetId) || '').trim();
  } catch {
    return '';
  }
}

function resetHCaptchaWidget(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !window.hcaptcha) return;
  const widgetIdRaw = container.dataset.hcaptchaWidgetId;
  if (widgetIdRaw === undefined || widgetIdRaw === '') return;
  const widgetId = Number(widgetIdRaw);
  if (!Number.isFinite(widgetId)) return;
  try {
    window.hcaptcha.reset(widgetId);
  } catch {
    // no-op
  }
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityLoadPromise) return googleIdentityLoadPromise;
  googleIdentityLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return googleIdentityLoadPromise;
}

async function getGoogleLoginConfig() {
  if (googleLoginConfigPromise) return googleLoginConfigPromise;
  googleLoginConfigPromise = request('/auth/google/config')
    .catch(() => ({ enabled: false, clientId: null }));
  return googleLoginConfigPromise;
}

async function handleGoogleLoginCredentialResponse(response) {
  const credential = String(response?.credential || '').trim();
  if (!credential) {
    showToast('No se pudo leer la credencial de Google', 'error');
    return;
  }
  try {
    const data = await request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    setAuthToken(data.token);
    currentUser = await request('/user');
    if (!heartbeatInterval) heartbeatInterval = setInterval(() => { if (currentUser && document.visibilityState === 'visible') request('/ping', { method: 'PUT' }).catch(() => {}); }, 30000);
    if (!notifInterval) notifInterval = setInterval(() => { if (currentUser) { loadCounts(); } }, 30000);
    updateNav();
    loadUserFavoriteIds();
    showToast('Bienvenido!', 'success');
    showSection('home');
  } catch (err) {
    showToast(err.message || 'No se pudo iniciar sesion con Google', 'error');
  }
}

async function initGoogleLoginButton() {
  const wrap = document.getElementById('googleLoginWrap');
  const mount = document.getElementById('googleLoginBtn');
  if (!wrap || !mount) return;
  if (currentUser) {
    wrap.style.display = 'none';
    return;
  }

  const config = await getGoogleLoginConfig();
  const clientId = String(config?.clientId || '').trim();
  if (!config?.enabled || !clientId) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  await loadGoogleIdentity();
  if (!window.google?.accounts?.id) {
    wrap.style.display = 'none';
    return;
  }

  if (!googleLoginInitialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleLoginCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true
    });
    googleLoginInitialized = true;
  }

  mount.innerHTML = '';
  window.google.accounts.id.renderButton(mount, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    text: 'continue_with',
    shape: 'pill',
    width: Math.min(360, Math.max(240, window.innerWidth - 96))
  });
}

function isVisibleElement(el) {
  return !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
}

function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return Array.from(container.querySelectorAll(selector)).filter(el => isVisibleElement(el));
}

function setBodyScrollLocked(locked) {
  document.body.style.overflow = locked ? 'hidden' : '';
}

function syncModalOverlay() {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  const hasModal = modalStack.length > 0;
  overlay.style.display = hasModal ? 'block' : 'none';
  setBodyScrollLocked(hasModal || isVisibleElement(document.getElementById('mobileAccountMenu')));
}

function openAccessibleModal(modalId, options = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.style.display = options.display || 'block';
  const existingIndex = modalStack.findIndex(m => m.id === modalId);
  if (existingIndex !== -1) modalStack.splice(existingIndex, 1);
  modalStack.push({ id: modalId, lastFocused });
  syncModalOverlay();

  const focusSelector = options.initialFocusSelector;
  const focusTarget = focusSelector ? modal.querySelector(focusSelector) : null;
  const focusable = getFocusableElements(modal);
  const fallback = focusable[0] || modal;
  requestAnimationFrame(() => (focusTarget || fallback)?.focus?.());
}

function closeAccessibleModal(modalId, { restoreFocus = true } = {}) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
  const idx = modalStack.findIndex(m => m.id === modalId);
  const ctx = idx !== -1 ? modalStack[idx] : null;
  if (idx !== -1) modalStack.splice(idx, 1);
  syncModalOverlay();
  if (restoreFocus && ctx?.lastFocused && document.contains(ctx.lastFocused)) {
    requestAnimationFrame(() => ctx.lastFocused.focus());
  }
}

function closeTopAccessibleModal() {
  const top = modalStack[modalStack.length - 1];
  if (!top) return false;
  if (top.id === 'lightboxModal') closeLightbox();
  else if (top.id === 'editVehicleModal') closeEditModal();
  else if (top.id === 'tradeModal') closeTradeModal();
  else if (top.id === 'reportModal') closeReportModal();
  else if (top.id === 'rateModal') closeRateModal();
  else if (top.id === 'prestitoModal') closePrestitoQuoteModal();
  else if (top.id === 'confirmModal') closeConfirmModal();
  else if (top.id === 'editProfileModal') closeEditProfileModal();
  else if (top.id === 'publishPreviewModal') closePublishPreviewModal();
  else closeAccessibleModal(top.id);
  return true;
}

// SEO helpers
function setMeta(attr, key, value) {
  const el = document.querySelector(`meta[${attr}="${CSS.escape ? CSS.escape(key) : key}"]`);
  if (el) el.setAttribute('content', value);
}

function setRobotsMetaForSection(sectionId) {
  const indexableSections = new Set(['home', 'vehicles', 'vehicle-detail', 'terms']);
  const robotsValue = indexableSections.has(sectionId) ? 'index, follow' : 'noindex, nofollow';
  setMeta('name', 'robots', robotsValue);
}
function makeCacheToken(value = '') {
  // Small deterministic hash for cache-busting URLs.
  let h = 2166136261;
  const s = String(value || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function inferImageMimeType(url = '') {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function updateSEOMeta(vehicle, imageUrl) {
  const fixedArs = Number(vehicle?.price_original || 0);
  const convertedArs = dolarRate?.venta ? Number(vehicle.price || 0) * Number(dolarRate.venta) : 0;
  const priceArsValue = fixedArs > 0 ? fixedArs : (convertedArs > 0 ? convertedArs : Number(vehicle.price || 0));
  const priceArs = Math.round(priceArsValue).toLocaleString('es-AR');
  const mileage = Number(vehicle.mileage).toLocaleString('es-AR');
  const location = vehicle.city + (vehicle.province ? ', ' + vehicle.province : '');
  const title = `${vehicle.title} | ARS ${priceArs} | ${mileage} km`;
  const desc = `${vehicle.brand} ${vehicle.model} ${vehicle.year} - ${mileage} km${vehicle.fuel ? ` - ${vehicle.fuel}` : ''}${vehicle.transmission ? ` - ${vehicle.transmission}` : ''}${location ? ` - ${location}` : ''}. Ver publicacion en Autoventa.`;
  const imageAlt = `${vehicle.title} - ARS ${priceArs} - ${mileage} km`;
  const url = `https://autoventa.online/?vehicle=${vehicle.id}`;
  const ogImage = String(imageUrl || 'https://autoventa.online/og-default.png');
  const ogImageType = inferImageMimeType(ogImage);
  document.title = title;
  setMeta('name', 'description', desc);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:image', ogImage);
  setMeta('property', 'og:image:type', ogImageType);
  setMeta('property', 'og:image:alt', imageAlt);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', ogImage);
  setMeta('name', 'robots', 'index, follow');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = url;
  // JSON-LD por vehículo
  document.getElementById('vehicle-jsonld')?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'vehicle-jsonld';
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Car",
    "name": vehicle.title,
    "brand": { "@type": "Brand", "name": vehicle.brand },
    "model": vehicle.model,
    "vehicleModelDate": String(vehicle.year),
    "mileageFromOdometer": { "@type": "QuantitativeValue", "value": vehicle.mileage, "unitCode": "KMT" },
    "fuelType": vehicle.fuel,
    "vehicleTransmission": vehicle.transmission,
    "image": imageUrl,
    "description": vehicle.description || '',
      "url": url,
    "offers": {
      "@type": "Offer",
      "price": Math.round(priceArsValue || 0),
      "priceCurrency": "ARS",
      "availability": vehicle.status === 'active' ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      "url": url
    }
  });
  document.head.appendChild(script);
}

function resetSEOMeta() {
  const defaultTitle = 'Autoventa — Comprá y Vendé tu Vehículo en Argentina';
  const defaultDesc = 'La plataforma más moderna para comprar y vender vehículos en Argentina. Publica gratis, chatea con vendedores y cerrá negocios de forma segura.';
  const defaultUrl = 'https://autoventa.online/';
  const defaultImg = 'https://autoventa.online/og-default.png';
  document.title = defaultTitle;
  setMeta('name', 'description', defaultDesc);
  setMeta('property', 'og:title', defaultTitle);
  setMeta('property', 'og:description', defaultDesc);
  setMeta('property', 'og:image', defaultImg);
  setMeta('property', 'og:image:type', 'image/png');
  setMeta('property', 'og:url', defaultUrl);
  setMeta('name', 'twitter:title', defaultTitle);
  setMeta('name', 'twitter:description', defaultDesc);
  setMeta('name', 'twitter:image', defaultImg);
  setMeta('name', 'robots', 'index, follow');
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = defaultUrl;
  document.getElementById('vehicle-jsonld')?.remove();
}

// WebSocket
let wsConnection = null;
let wsReconnectTimeout = null;
// BUG-14: separate timeout variable for the 5-second fallback polling trigger
let wsFallbackTimeout = null;
let wsReconnectDelay = 1000;
let wsReconnectAttempts = 0;
let wsConnected = false;
let wsReadReceiptDebounce = null;
let wsTypingTimeout = null;
let isTyping = false;
let currentChatOtherUserId = null;

const API_URL = '/api';

let carBrands = {};
let motoBrands = {};
let utilitarioBrands = {};
let cuatriBrands = {};
let camionBrands = {};
let versionsData = {};
fetch('/brands-data.json?v=3').then(r => r.json()).then(d => {
  carBrands = d.carBrands || {};
  motoBrands = d.motoBrands || {};
  utilitarioBrands = d.utilitarioBrands || {};
  cuatriBrands = d.cuatriBrands || {};
  camionBrands = d.camionBrands || {};
  buildSearchCorrectionDictionary();
  if (typeof initBrandFilters === 'function') initBrandFilters();
  if (typeof updatePublishBrands === 'function') updatePublishBrands();
}).catch(() => {});
fetch('/versions-data.json?v=1').then(r => r.json()).then(d => { versionsData = d; }).catch(() => {});


function getBrandsForType(type) {
  if (type === 'moto') return motoBrands;
  if (type === 'auto') return carBrands;
  if (type === 'utilitario') return utilitarioBrands;
  if (type === 'cuatri') return cuatriBrands;
  if (type === 'camion') return camionBrands;
  return { ...carBrands, ...utilitarioBrands, ...motoBrands, ...cuatriBrands, ...camionBrands };
}

const TOP_CAR_BRANDS = ['Volkswagen','Toyota','Chevrolet','Ford','Renault','Fiat','Peugeot','Citroen','Honda','Hyundai','Jeep','Nissan','Kia','Mercedes-Benz','BMW','Audi','Mitsubishi','Mazda','Subaru','Suzuki'];
const TOP_MOTO_BRANDS = ['Honda','Yamaha','Bajaj','Motomel','Corven','Kawasaki','KTM','Gilera','Beta','Ducati','Harley-Davidson','BMW'];

function sortedBrandKeys(brandsObj, type) {
  const top = type === 'moto' ? TOP_MOTO_BRANDS : TOP_CAR_BRANDS;
  const all = Object.keys(brandsObj);
  const featured = top.filter(b => all.includes(b));
  const rest = all.filter(b => !featured.includes(b)).sort();
  return [...featured, ...rest];
}

const AR_CITIES = (() => {
  const data = {
    'Buenos Aires (CABA)': [
      'Buenos Aires','Palermo','Recoleta','Belgrano','Flores','Boedo','Villa Crespo',
      'Caballito','Almagro','Villa Urquiza','Núñez','Coghlan','Saavedra','Villa Pueyrredón',
      'Devoto','Villa del Parque','Parque Patricios','Barracas','La Boca','San Telmo',
      'Montserrat','Puerto Madero','Retiro','San Nicolás','Microcentro'
    ],
    'Buenos Aires (Prov.)': [
      // GBA Norte
      'Tigre','San Fernando','Escobar','Pilar','San Isidro','Vicente López','San Martín',
      'Tres de Febrero','Hurlingham','Ituzaingó','Morón','Malvinas Argentinas','José C. Paz',
      'San Miguel','General Rodríguez','General Las Heras','Marcos Paz','Luján','Exaltación de la Cruz',
      // GBA Oeste
      'La Matanza','Merlo','Moreno','San Justo','Ramos Mejía','Haedo','Castelar','Palomar',
      // GBA Sur
      'Quilmes','Lanús','Lomas de Zamora','Avellaneda','Florencio Varela','Berazategui',
      'Ezeiza','Esteban Echeverría','Monte Grande','Burzaco','Banfield','Temperley','Adrogué',
      'San Vicente','Guernica','Canning','Longchamps','Glew','Claypole',
      // La Plata y alrededores
      'La Plata','Berisso','Ensenada','Brandsen','Chascomús','Lezama','General Paz','Lobos',
      'Magdalena','Punta Indio',
      // Costa Atlántica
      'Mar del Plata','Pinamar','Villa Gesell','Necochea','Miramar','Mar de Ajó','San Clemente del Tuyú',
      'Santa Teresita','Mar del Tuyú','Dolores','General Lavalle','General Madariaga',
      // Centro
      'Tandil','Olavarría','Azul','Balcarce','Rauch','Ayacucho','Las Flores','Saladillo',
      'General Alvear','Roque Pérez','Tapalqué','Laprida','Benito Juárez','Lobería',
      'San Cayetano','Adolfo Gonzales Chaves',
      // Noroeste
      'Junín','Chacabuco','Arrecifes','Salto','Rojas','San Antonio de Areco','Ramallo',
      'San Pedro','San Nicolás de los Arroyos','Pergamino','Baradero','Zárate','Campana',
      'General Pinto','General Viamonte','Leandro N. Alem','Carlos Casares','Alberti',
      'Bragado','Chivilcoy','Suipacha','Mercedes','9 de Julio','Lincoln',
      // Oeste/Sur
      'Trenque Lauquen','Pehuajó','Bolívar','Nueve de Julio','Daireaux','Hipólito Yrigoyen',
      'General Villegas','Rivadavia','Salliqueló','Pellegrini','Henderson','Carlos Tejedor',
      // Sur
      'Bahía Blanca','Punta Alta','Coronel Rosales','Monte Hermoso','Coronel Dorrego',
      'Coronel Suárez','Tres Arroyos','Coronel Pringles','Pigüé','Saavedra',
      'Cañuelas','General Las Heras'
    ],
    'Córdoba': [
      'Córdoba','Río Cuarto','Villa María','Río Tercero','Villa Carlos Paz','Alta Gracia',
      'Bell Ville','San Francisco','Río Ceballos','Cosquín','La Falda','Cruz del Eje',
      'Dean Funes','Jesús María','Unquillo','Malagueño','Oncativo','Arroyito','Marcos Juárez',
      'Laboulaye','Río Segundo','Morteros','Oliva','La Carlota','General Cabrera','Villa Dolores',
      'Mina Clavero','Villa General Belgrano','Capilla del Monte','Huerta Grande','Bialet Massé',
      'Embalse','Almafuerte','Villa Nueva','Bower','Malvinas Argentinas','Mendiolaza'
    ],
    'Santa Fe': [
      'Rosario','Santa Fe','Rafaela','Reconquista','Venado Tuerto','San Lorenzo','Villa Constitución',
      'Casilda','Cañada de Gómez','Esperanza','Santo Tomé','Gálvez','Las Rosas','Pérez',
      'Funes','Roldan','Granadero Baigorria','Capitán Bermúdez','Fray Luis Beltrán','San Lorenzo',
      'Puerto General San Martín','Rufino','Firmat','Ceres','Vera','Tostado','San Jorge',
      'Sunchales','Sastre','Morteros','Helvecia','San Javier'
    ],
    'Mendoza': [
      'Mendoza','San Rafael','Godoy Cruz','Guaymallén','Las Heras','Maipú','Luján de Cuyo',
      'Rivadavia','San Martín','Junín','La Paz','General Alvear','Malargüe','Tunuyán',
      'Tupungato','Santa Rosa','Lavalle','Ciudad de Mendoza','Palmira','San Vicente'
    ],
    'Tucumán': [
      'San Miguel de Tucumán','Yerba Buena','Tafí Viejo','Concepción','Monteros','Aguilares',
      'Famaillá','Lules','Simoca','Bella Vista','Alberdi','Graneros','Juan Bautista Alberdi',
      'Buruyacu','Cruz Alta','El Kadri','Acheral','Tafí del Valle'
    ],
    'Salta': [
      'Salta','Tartagal','Orán','Metán','Cafayate','San Ramón de la Nueva Orán','Palpalá',
      'Libertador General San Martín','Rosario de la Frontera','Joaquín V. González',
      'General Güemes','Embarcación','Rivadavia','Cachi','Molinos','Animaná'
    ],
    'Jujuy': [
      'San Salvador de Jujuy','Palpalá','La Quiaca','Libertador General San Martín',
      'Humahuaca','Perico','Tilcara','Purmamarca','Abra Pampa','Fraile Pintado'
    ],
    'Entre Ríos': [
      'Paraná','Concordia','Gualeguaychú','Gualeguay','Colón','Federación','Chajarí',
      'Villaguay','Concepción del Uruguay','Victoria','Diamante','La Paz','Crespo',
      'Basavilbaso','Nogoyá','Rosario del Tala','San José','Ibicuy'
    ],
    'Corrientes': [
      'Corrientes','Paso de los Libres','Goya','Curuzú Cuatiá','Mercedes','Santo Tomé',
      'Saladas','Bella Vista','Monte Caseros','Yapeyú','Ituzaingó','Esquina'
    ],
    'Misiones': [
      'Posadas','Eldorado','Oberá','Apóstoles','Leandro N. Alem','Puerto Iguazú',
      'Jardín América','Montecarlo','Campo Grande','San Vicente','El Dorado','Aristóbulo del Valle'
    ],
    'Chaco': [
      'Resistencia','Presidencia Roque Sáenz Peña','Villa Ángela','Charata','Quitilipi',
      'Las Breñas','Juan José Castelli','Machagai','Roque Sáenz Peña','General San Martín'
    ],
    'Formosa': [
      'Formosa','Clorinda','Pirané','Las Lomitas','General Lucio Victorio Mansilla','El Colorado'
    ],
    'Santiago del Estero': [
      'Santiago del Estero','La Banda','Termas de Río Hondo','Añatuya','Frías','Loreto',
      'Quimilí','Ojo de Agua','Monte Quemado','Suncho Corral'
    ],
    'La Rioja': [
      'La Rioja','Chilecito','Aimogasta','Belén','Andalgalá','Tinogasta','Villa Unión',
      'Chamical','Chepes','Arauco'
    ],
    'Catamarca': [
      'San Fernando del Valle de Catamarca','Tinogasta','Belén','Andalgalá','Santa María',
      'Fiambalá','Antofagasta de la Sierra','Recreo','Pomán'
    ],
    'San Juan': [
      'San Juan','Rivadavia','Chimbas','Rawson','Santa Lucía','Pocito','Caucete',
      'San Martín','Albardón','Angaco','Calingasta','Jáchal','Ullum'
    ],
    'San Luis': [
      'San Luis','Villa Mercedes','Merlo','Quines','Justo Daract','Concarán',
      'Santa Rosa del Conlara','Buena Esperanza','La Toma'
    ],
    'Neuquén': [
      'Neuquén','Cutral-Có','Plaza Huincul','Zapala','San Martín de los Andes',
      'Junín de los Andes','Chos Malal','Catriel','Allen','Cipolletti','Plottier',
      'Centenario','Villa La Angostura','Las Lajas','Loncopué'
    ],
    'Río Negro': [
      'Viedma','San Carlos de Bariloche','Cipolletti','General Roca','Allen','Villa Regina',
      'Cinco Saltos','El Bolsón','Las Grutas','Sierra Grande','Maquinchao',
      'Ingeniero Jacobacci','Choele Choel','Luis Beltrán','Río Colorado','Catriel'
    ],
    'Chubut': [
      'Rawson','Trelew','Comodoro Rivadavia','Puerto Madryn','Esquel','Río Mayo',
      'Caleta Olivia','Sarmiento','Gaiman','Dolavon','Puerto Pirámides','El Hoyo'
    ],
    'Santa Cruz': [
      'Río Gallegos','Caleta Olivia','El Calafate','El Chaltén','Puerto Deseado',
      'Pico Truncado','Las Heras','Puerto San Julián','Gobernador Gregores','Río Turbio','28 de Noviembre'
    ],
    'Tierra del Fuego': ['Ushuaia','Río Grande','Tolhuin'],
    'La Pampa': [
      'Santa Rosa','General Pico','Toay','Victorica','General Acha','Eduardo Castex',
      'Realicó','Winifreda','Bernardo Larroudé','Catriló'
    ],
  };
  const result = [];
  for (const [prov, cities] of Object.entries(data)) {
    for (const city of cities) result.push({ label: `${city}, ${prov}`, city, prov });
  }
  return result.sort((a, b) => a.city.localeCompare(b.city, 'es'));
})();

const AR_PROVINCES = [...new Set(AR_CITIES.map(c => c.prov))].sort((a, b) => a.localeCompare(b, 'es'));

function setupProvinceCity(provinceId, cityId) {
  const provSelect = document.getElementById(provinceId);
  const citySelect = document.getElementById(cityId);
  if (!provSelect || !citySelect) return;

  // Poblar provincias
  AR_PROVINCES.forEach(prov => {
    const opt = document.createElement('option');
    opt.value = prov;
    opt.textContent = prov;
    provSelect.appendChild(opt);
  });

  // Al cambiar provincia, poblar ciudades
  provSelect.addEventListener('change', () => {
    const selectedProv = provSelect.value;
    citySelect.innerHTML = '<option value="">Seleccioná una ciudad</option>';
    if (!selectedProv) {
      citySelect.disabled = true;
      return;
    }
    const cities = AR_CITIES.filter(c => c.prov === selectedProv).sort((a, b) => a.city.localeCompare(b.city, 'es'));
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.city;
      opt.textContent = c.city;
      citySelect.appendChild(opt);
    });
    citySelect.disabled = false;
  });
}

// CURRENCY HELPERS
function getPriceBaseUSD(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  if (!currencyEl || !priceEl) return null;

  const stored = parseFloat(priceEl.dataset.usdBase || '');
  if (!isNaN(stored) && stored > 0) return stored;

  const val = parseFloat(priceEl.value);
  if (!val || isNaN(val)) return null;
  if (currencyEl.value === 'ARS') {
    if (!dolarRate?.venta) return null;
    return val / dolarRate.venta;
  }
  return val;
}

function syncPriceBaseUSD(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  if (!currencyEl || !priceEl) return;
  const val = parseFloat(priceEl.value);
  if (!val || isNaN(val)) {
    delete priceEl.dataset.usdBase;
    return;
  }
  if (currencyEl.value === 'ARS' && !dolarRate?.venta) {
    delete priceEl.dataset.usdBase;
    return;
  }
  const usd = currencyEl.value === 'ARS' ? (val / dolarRate.venta) : val;
  if (usd && !isNaN(usd)) priceEl.dataset.usdBase = String(usd);
}

function updatePriceHint(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  const hintEl = document.getElementById(`${prefix}PriceHint`);
  if (!currencyEl || !priceEl || !hintEl) return;
  const currency = currencyEl.value;
  const baseUSD = getPriceBaseUSD(prefix);
  if (!baseUSD || !dolarRate?.venta) { hintEl.textContent = ''; return; }
  if (currency === 'USD') {
    const ars = Math.round(baseUSD * dolarRate.venta);
    hintEl.textContent = `≈ ARS $${ars.toLocaleString('es-AR')}`;
  } else {
    const usd = Math.round(baseUSD);
    hintEl.textContent = `≈ USD $${usd.toLocaleString('es-AR')}`;
  }
}

function onCurrencyChange(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  if (!currencyEl || !priceEl) return;
  const baseUSD = getPriceBaseUSD(prefix);
  if (!baseUSD || !dolarRate?.venta) {
    currencyEl.dataset.prev = currencyEl.value;
    updatePriceHint(prefix);
    return;
  }
  // Always render from the same base (USD) to avoid drift across toggles.
  if (currencyEl.value === 'ARS') {
    priceEl.value = Math.round(baseUSD * dolarRate.venta);
  } else {
    priceEl.value = Math.round(baseUSD);
  }
  currencyEl.dataset.prev = currencyEl.value;
  priceEl.dataset.usdBase = String(baseUSD);
  updatePriceHint(prefix);
}

function getPriceInUSD(prefix) {
  const baseUSD = getPriceBaseUSD(prefix);
  if (!baseUSD) return baseUSD;
  return Math.round(baseUSD);
}

// ===== TEMA DÍA / NOCHE =====
function isDay() {
  const h = new Date().getHours();
  return h >= 7 && h < 20;
}

function applyTheme(day) {
  document.body.classList.toggle('day-mode', day);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = day ? '🌙' : '☀️';
  const mobileBtn = document.getElementById('mobileThemeToggle');
  if (mobileBtn) mobileBtn.textContent = day ? '🌙 Cambiar a modo noche' : '☀️ Cambiar a modo día';
}

function initTheme() {
  // Usar override de sesión si existe, si no usar modo noche por defecto
  const override = sessionStorage.getItem('themeOverride');
  applyTheme(override !== null ? override === 'day' : false);
}

function toggleTheme() {
  const newDay = !document.body.classList.contains('day-mode');
  sessionStorage.setItem('themeOverride', newDay ? 'day' : 'night');
  applyTheme(newDay);
}

function setStarRating(value) {
  const rating = document.getElementById('starRating');
  if (!rating) return;
  const stars = Array.from(rating.querySelectorAll('.star'));
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  rating.dataset.value = String(safeValue);
  stars.forEach((star, idx) => {
    const active = idx < safeValue;
    star.classList.toggle('active', active);
    star.setAttribute('aria-checked', idx === Math.max(0, safeValue - 1) && safeValue > 0 ? 'true' : 'false');
    star.setAttribute('tabindex', idx === Math.max(0, safeValue - 1) ? '0' : '-1');
  });
  if (safeValue === 0 && stars[0]) stars[0].setAttribute('tabindex', '0');
}

function initStarRatingA11y() {
  const rating = document.getElementById('starRating');
  if (!rating) return;
  rating.setAttribute('role', 'radiogroup');
  if (!rating.getAttribute('aria-label')) rating.setAttribute('aria-label', 'Calificación por estrellas');
  const stars = Array.from(rating.querySelectorAll('.star'));
  stars.forEach((star, idx) => {
    star.setAttribute('role', 'radio');
    star.setAttribute('aria-label', `${idx + 1} estrella${idx === 0 ? '' : 's'}`);
    star.setAttribute('tabindex', idx === 0 ? '0' : '-1');
  });
  setStarRating(0);
}

function wireImplicitFormLabels() {
  document.querySelectorAll('.form-group label:not([for])').forEach((label, idx) => {
    const group = label.closest('.form-group');
    if (!group) return;
    const field = group.querySelector('input:not([type="hidden"]), select, textarea');
    if (!field) return;
    if (!field.id) field.id = `fieldAuto${idx + 1}`;
    label.setAttribute('for', field.id);
  });
}

function initAccessibilitySemantics() {
  const modalDefs = [
    { id: 'editVehicleModal', label: 'Editar publicación' },
    { id: 'tradeModal', label: 'Proponer permuta' },
    { id: 'reportModal', label: 'Reportar publicación' },
    { id: 'rateModal', label: 'Calificar vendedor' },
    { id: 'prestitoModal', label: 'Cotizador Préstito' },
    { id: 'confirmModal', label: 'Confirmación' },
    { id: 'editProfileModal', label: 'Editar perfil' }
  ];
  modalDefs.forEach(({ id, label }) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', '-1');
    const title = modal.querySelector('.modal-header h3');
    if (title) {
      if (!title.id) title.id = `${id}Title`;
      modal.setAttribute('aria-labelledby', title.id);
    } else {
      modal.setAttribute('aria-label', label);
    }
  });

  const closeButtons = document.querySelectorAll('.modal-close:not([aria-label])');
  closeButtons.forEach(btn => btn.setAttribute('aria-label', 'Cerrar modal'));

  const lightbox = document.getElementById('lightboxModal');
  if (lightbox) {
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('tabindex', '-1');
    if (!lightbox.getAttribute('aria-label')) lightbox.setAttribute('aria-label', 'Galería de imágenes');
  }
  document.querySelector('.lightbox-close')?.setAttribute('aria-label', 'Cerrar galería');
  document.querySelector('.lightbox-prev')?.setAttribute('aria-label', 'Imagen anterior');
  document.querySelector('.lightbox-next')?.setAttribute('aria-label', 'Siguiente imagen');

  const toastContainer = document.getElementById('toastContainer');
  if (toastContainer) {
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
  }

  const mobileMenu = document.getElementById('mobileAccountMenu');
  if (mobileMenu) {
    mobileMenu.setAttribute('role', 'dialog');
    mobileMenu.setAttribute('aria-modal', 'true');
    mobileMenu.setAttribute('tabindex', '-1');
    mobileMenu.querySelector('.mobile-menu-header button')?.setAttribute('aria-label', 'Cerrar menú');
  }

  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  if (mobileThemeToggle) {
    mobileThemeToggle.setAttribute('href', '#');
    mobileThemeToggle.removeAttribute('onclick');
    mobileThemeToggle.addEventListener('click', (event) => {
      event.preventDefault();
      toggleTheme();
    });
  }

  wireImplicitFormLabels();
  initStarRatingA11y();
}

function makeElementKeyboardClickable(el) {
  if (!el || el.dataset.kbClick === '1') return;
  const tag = el.tagName;
  if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  if (el.matches('.modal-overlay, .mobile-menu-backdrop, .lightbox-overlay, .lightbox-thumbs')) return;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.dataset.kbClick = '1';
}

function enhanceKeyboardClickables(root = document) {
  if (!root) return;
  if (root instanceof Element) {
    if (root.hasAttribute('onclick')) makeElementKeyboardClickable(root);
    if (!root.querySelector) return;
    if (root.querySelector('[onclick]')) {
      root.querySelectorAll('[onclick]').forEach(makeElementKeyboardClickable);
    }
    return;
  }
  if (root.querySelectorAll) {
    root.querySelectorAll('[onclick]').forEach(makeElementKeyboardClickable);
  }
}

function initKeyboardClickableObserver() {
  if (keyboardClickableObserver || !document.body) return;
  keyboardClickableObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) enhanceKeyboardClickables(n);
      });
    });
  });
  keyboardClickableObserver.observe(document.body, { childList: true, subtree: true });
}

// Init province/city selects when DOM ready
async function handleEmailLinks() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const type = params.get('type');
  if (!token || !type) return false;

  // Limpiar URL para que no quede el token visible
  window.history.replaceState({}, '', window.location.pathname);

  if (type === 'verify') {
    try {
      const data = await request(`/auth/verify-email?token=${token}`);
      showToast(data.message || '¡Email verificado!', 'success');
      showSection('login');
    } catch (err) {
      showToast(err.message || 'El link de verificación es inválido o expiró', 'error');
      showSection('login');
    }
    return true;
  } else if (type === 'reset') {
    document.getElementById('resetToken').value = token;
    showSection('reset-password');
    return true;
  }
  return false;
}

// Botón atrás del navegador
function getActiveVehiclesPageFromDom() {
  const active = document.querySelector('#vehiclesPagination button.active');
  const parsed = parseInt(active?.textContent || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function collectVehiclesFilterState() {
  const filters = {};
  VEHICLES_FILTER_IDS.forEach((id) => {
    const el = document.getElementById(id);
    filters[id] = el?.value || '';
  });
  filters.searchInput = document.getElementById('searchInput')?.value || '';
  return filters;
}

function applyVehiclesFilterState(filters = {}) {
  const vehicleTypeEl = document.getElementById('filterVehicleType');
  if (vehicleTypeEl) {
    const hasStoredType = Object.prototype.hasOwnProperty.call(filters, 'filterVehicleType');
    const nextType = hasStoredType
      ? String(filters.filterVehicleType || '')
      : String(vehicleTypeEl.value || '');
    if (vehicleTypeEl.value !== nextType) {
      vehicleTypeEl.value = nextType;
      initBrandFilters();
    }
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput && typeof filters.searchInput === 'string') {
    searchInput.value = filters.searchInput;
  }

  [
    'filterMinPrice',
    'filterMaxPrice',
    'filterMinYear',
    'filterMaxYear',
    'filterMinMileage',
    'filterMaxMileage',
    'filterFuel',
    'filterTransmission',
    'filterCity',
    'filterProvince',
    'filterSort'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el && filters[id] !== undefined) el.value = filters[id] || '';
  });

  const brandEl = document.getElementById('filterBrand');
  if (brandEl) {
    brandEl.value = filters.filterBrand || '';
    updateFilterModels();
    if (typeof syncBrandPickerTrigger === 'function') syncBrandPickerTrigger('filterBrand');
  }

  const modelEl = document.getElementById('filterModel');
  if (modelEl) {
    const desiredModel = filters.filterModel || '';
    const hasOption = [...modelEl.options].some(o => o.value === desiredModel);
    modelEl.value = hasOption ? desiredModel : '';
  }

  filtersDirty = false;
  updateMobileFilterApplyButton();
}

function getStoredVehiclesListState() {
  try {
    const raw = sessionStorage.getItem(VEHICLES_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function persistVehiclesListState({ scrollY } = {}) {
  if (!window.history || typeof window.history.replaceState !== 'function') return;
  const page = getActiveVehiclesPageFromDom() || vehiclesCurrentPage || 1;
  const snapshot = {
    page: Number(page) > 0 ? Number(page) : 1,
    scrollY: Number.isFinite(scrollY) ? Math.max(0, Math.round(scrollY)) : Math.max(0, Math.round(window.scrollY || 0)),
    filters: collectVehiclesFilterState(),
    ts: Date.now()
  };

  const currentState = history.state && typeof history.state === 'object' ? history.state : {};
  history.replaceState({ ...currentState, section: 'vehicles', vehiclesState: snapshot }, '', '/?section=vehicles');

  try {
    sessionStorage.setItem(VEHICLES_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
}

function scheduleVehiclesListStateSync() {
  if (currentSectionId !== 'vehicles') return;
  clearTimeout(vehiclesHistorySyncTimer);
  vehiclesHistorySyncTimer = setTimeout(() => {
    if (currentSectionId !== 'vehicles' || isHandlingPopState) return;
    persistVehiclesListState();
  }, 120);
}

async function restoreVehiclesListState(stateFromHistory = null) {
  const snapshot = (stateFromHistory && typeof stateFromHistory === 'object')
    ? stateFromHistory
    : getStoredVehiclesListState();
  const hasSnapshot = !!snapshot;
  const targetPage = hasSnapshot
    ? Math.max(1, Number(snapshot?.page || 1))
    : (getActiveVehiclesPageFromDom() || vehiclesCurrentPage || 1);
  const targetScrollY = Math.max(0, Number(snapshot?.scrollY || 0));

  showSection('vehicles', { pushHistory: false, preserveScroll: true, skipSectionLoad: true });
  if (snapshot?.filters) applyVehiclesFilterState(snapshot.filters);

  const cardsCount = document.querySelectorAll('#vehiclesList .vehicle-card').length;
  const currentPageDom = getActiveVehiclesPageFromDom() || vehiclesCurrentPage || 1;
  const needsReload = cardsCount === 0 || (hasSnapshot && currentPageDom !== targetPage);

  if (needsReload) {
    await loadVehicles(targetPage, false, { skipStateSync: true });
  } else {
    vehiclesCurrentPage = currentPageDom;
  }

  if (targetScrollY > 0) {
    window.scrollTo({ top: targetScrollY, behavior: 'auto' });
    requestAnimationFrame(() => window.scrollTo({ top: targetScrollY, behavior: 'auto' }));
    setTimeout(() => window.scrollTo({ top: targetScrollY, behavior: 'auto' }), 80);
  }

  persistVehiclesListState({ scrollY: targetScrollY });
}

window.addEventListener('scroll', () => {
  if (currentSectionId !== 'vehicles' || isHandlingPopState) return;
  scheduleVehiclesListStateSync();
}, { passive: true });

window.addEventListener('popstate', async (e) => {
  isHandlingPopState = true;
  try {
    const section = e.state?.section;
    const vehicleId = e.state?.vehicleId;
    const stateProfileId = e.state?.profileId;
    const stateVehicles = e.state?.vehiclesState;
    const query = new URLSearchParams(window.location.search);
    const queryProfileId = query.get('profile');
    const querySection = query.get('section');
    const queryVehicleId = query.get('vehicle');

    const resolvedVehicleId = vehicleId || (queryVehicleId ? parseInt(queryVehicleId, 10) : null);
    if (resolvedVehicleId) {
      await viewVehicle(resolvedVehicleId, { pushHistory: false });
      return;
    }

    const resolvedSection = section || querySection;
    if (resolvedSection === 'vehicles') {
      await restoreVehiclesListState(stateVehicles);
      return;
    }

    if (stateProfileId || queryProfileId) {
      viewProfile(stateProfileId || queryProfileId);
      return;
    }

    if (resolvedSection === 'profile') {
      if (currentUser?.id) viewProfile(currentUser.id);
      else showSection('home', { pushHistory: false });
      return;
    }

    if (resolvedSection === 'vehicle-detail') {
      await restoreVehiclesListState(stateVehicles);
      return;
    }

    if (resolvedSection) {
      showSection(resolvedSection, { pushHistory: false });
    } else {
      showSection('home', { pushHistory: false });
    }
  } finally {
    isHandlingPopState = false;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAccessibilitySemantics();
  enhanceKeyboardClickables();
  initKeyboardClickableObserver();
  setupProvinceCity('publishProvince', 'publishCity');
  setupProvinceCity('editProvince', 'editCity');
  const publishForm = document.querySelector('#publish form');
  if (publishForm) publishForm.noValidate = true;

  const pwdInput = document.getElementById('registerPassword');
  if (pwdInput) {
    pwdInput.addEventListener('input', function () {
      let errSpan = document.getElementById('passwordError');
      if (!errSpan) {
        errSpan = document.createElement('span');
        errSpan.id = 'passwordError';
        errSpan.style.cssText = 'color:#ef4444;font-size:0.8rem;display:block;margin-top:0.25rem;';
        this.parentNode.insertBefore(errSpan, this.nextSibling);
      }
      if (this.value.length > 0 && this.value.length < 6) {
        errSpan.textContent = 'Mínimo 6 caracteres';
        this.style.borderColor = '#ef4444';
      } else {
        errSpan.textContent = '';
        this.style.borderColor = '';
      }
    });
  }

  // Marcar username como editado manualmente para no sobreescribirlo
  const usernameInput = document.getElementById('registerUsername');
  if (usernameInput) {
    usernameInput.addEventListener('input', () => { usernameInput.dataset.edited = 'true'; });
  }

  // Currency selectors
  ['publish', 'edit'].forEach(prefix => {
    const currencyEl = document.getElementById(`${prefix}Currency`);
    const priceEl = document.getElementById(`${prefix}Price`);
    if (currencyEl) {
      currencyEl.dataset.prev = currencyEl.value || 'ARS';
      currencyEl.addEventListener('change', () => onCurrencyChange(prefix));
    }
    if (priceEl) {
      priceEl.addEventListener('input', () => {
        syncPriceBaseUSD(prefix);
        updatePriceHint(prefix);
      });
    }
  });

  ['publish', 'edit'].forEach(prefix => {
    const financingCheckbox = document.getElementById(`${prefix}AcceptsFinancing`);
    if (financingCheckbox) {
      financingCheckbox.addEventListener('change', () => toggleFinancingProviderField(prefix));
      toggleFinancingProviderField(prefix);
    }
  });

  updateMobileFilterApplyButton();
  window.addEventListener('resize', updateMobileFilterApplyButton);
});

function toggleEngineCCField(prefix = 'publish') {
  const typeEl = document.getElementById(`${prefix}VehicleTypeTop`) || document.getElementById(`${prefix}VehicleType`);
  const ccGroup = document.getElementById(`${prefix}EngineCCGroup`);
  if (!typeEl || !ccGroup) return;
  ccGroup.style.display = typeEl.value === 'moto' ? 'block' : 'none';
}

function shouldShowBodyTypeField(prefix = 'publish') {
  const typeEl = document.getElementById(`${prefix}VehicleTypeTop`) || document.getElementById(`${prefix}VehicleType`);
  return !!typeEl && typeEl.value === 'auto';
}

function toggleBodyTypeField(prefix = 'publish') {
  const group = document.getElementById(`${prefix}BodyTypeGroup`);
  const select = document.getElementById(`${prefix}BodyType`);
  if (!group || !select) return;
  const visible = shouldShowBodyTypeField(prefix);
  group.style.display = visible ? '' : 'none';
  if (!visible) select.value = '';
}

function toggleFinancingProviderField(prefix = 'publish') {
  const checkbox = document.getElementById(`${prefix}AcceptsFinancing`);
  const group = document.getElementById(`${prefix}FinancingProviderGroup`);
  const select = document.getElementById(`${prefix}FinancingProvider`);
  if (!checkbox || !group || !select) return;
  const visible = checkbox.checked === true;
  group.style.display = visible ? 'block' : 'none';
  if (!visible) select.value = 'prestito';
}

function normalizeTextForCompare(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function buildSearchCorrectionDictionary() {
  const tokenMap = new Map();
  const addTermTokens = (term) => {
    const pieces = String(term || '').match(/[A-Za-zÀ-ÿ0-9]+/g) || [];
    for (const piece of pieces) {
      if (piece.length < 2) continue;
      const normalized = normalizeTextForCompare(piece);
      if (!normalized || normalized.length < 2) continue;
      if (!tokenMap.has(normalized)) tokenMap.set(normalized, piece);
    }
  };
  const addBrandMap = (brandsMap) => {
    Object.entries(brandsMap || {}).forEach(([brand, models]) => {
      addTermTokens(brand);
      (models || []).forEach(addTermTokens);
    });
  };
  addBrandMap(carBrands);
  addBrandMap(motoBrands);
  addBrandMap(utilitarioBrands);
  addBrandMap(cuatriBrands);
  addBrandMap(camionBrands);
  searchCorrectionDisplayMap = tokenMap;
  searchCorrectionDictionary = Array.from(tokenMap.keys());
}

function levenshteinDistance(a = '', b = '', maxDistance = Infinity) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  if (Math.abs(aLen - bLen) > maxDistance) return maxDistance + 1;

  let prev = Array.from({ length: bLen + 1 }, (_, i) => i);
  for (let i = 1; i <= aLen; i++) {
    const curr = [i];
    let minInRow = curr[0];
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < minInRow) minInRow = curr[j];
    }
    if (minInRow > maxDistance) return maxDistance + 1;
    prev = curr;
  }
  return prev[bLen];
}

function findBestSearchTokenMatch(normalizedToken = '') {
  if (!normalizedToken || searchCorrectionDictionary.length === 0) return null;
  if (searchCorrectionDisplayMap.has(normalizedToken)) return null;
  const maxDistance = normalizedToken.length <= 4 ? 1 : normalizedToken.length <= 7 ? 2 : 3;
  let bestToken = null;
  let bestDistance = Infinity;
  for (const candidate of searchCorrectionDictionary) {
    if (Math.abs(candidate.length - normalizedToken.length) > maxDistance) continue;
    if (normalizedToken.length > 3 && candidate.charAt(0) !== normalizedToken.charAt(0)) continue;
    const distance = levenshteinDistance(normalizedToken, candidate, maxDistance);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestToken = candidate;
    }
    if (distance === 1) break;
  }
  if (!bestToken || bestDistance > maxDistance) return null;
  const similarity = 1 - (bestDistance / Math.max(bestToken.length, normalizedToken.length));
  if (similarity < 0.58) return null;
  return searchCorrectionDisplayMap.get(bestToken) || null;
}

function normalizeSearchQueryWithTypos(rawQuery = '') {
  const source = String(rawQuery || '').trim();
  if (!source) return { query: '', corrected: false };
  const tokens = source.split(/\s+/);
  let corrected = false;
  const resolvedTokens = tokens.map((token) => {
    const normalized = normalizeTextForCompare(token);
    if (!normalized || normalized.length < 3 || /^\d+$/.test(normalized)) return token;
    const replacement = findBestSearchTokenMatch(normalized);
    if (!replacement) return token;
    corrected = corrected || normalizeTextForCompare(token) !== normalizeTextForCompare(replacement);
    return replacement;
  });
  return {
    query: resolvedTokens.join(' ').trim(),
    corrected
  };
}

function updateSearchCorrectionHint(rawQuery = '', correctedQuery = '', corrected = false) {
  const hint = document.getElementById('searchCorrectionHint');
  if (!hint) return;
  if (!corrected || !correctedQuery || normalizeTextForCompare(rawQuery) === normalizeTextForCompare(correctedQuery)) {
    hint.style.display = 'none';
    hint.textContent = '';
    return;
  }
  hint.textContent = `Mostrando resultados para: ${correctedQuery}`;
  hint.style.display = 'block';
}

function isPickupBodyType(bodyType = '') {
  const v = normalizeTextForCompare(bodyType);
  if (!v) return false;
  return v.includes('camioneta') || v.includes('pickup') || v.includes('pick up');
}

function normalizedDrivetrainValue(value = '') {
  const v = String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x');
  if (v === '4x2' || v === '4x4') return v;
  return '';
}

function shouldShowDrivetrainField(prefix = 'publish') {
  const typeEl = document.getElementById(`${prefix}VehicleTypeTop`) || document.getElementById(`${prefix}VehicleType`);
  if (!typeEl || typeEl.value !== 'auto') return false;
  const bodyTypeEl = document.getElementById(`${prefix}BodyType`);
  const bodyType = bodyTypeEl?.value || '';
  return isPickupBodyType(bodyType);
}

function toggleDrivetrainField(prefix = 'publish') {
  const group = document.getElementById(`${prefix}DrivetrainGroup`);
  const select = document.getElementById(`${prefix}Drivetrain`);
  if (!group || !select) return;
  const visible = shouldShowDrivetrainField(prefix);
  group.style.display = visible ? '' : 'none';
  if (!visible) select.value = '';
}

function updateVehicleTypeOptions(prefix = 'publish') {
  const typeEl = document.getElementById(`${prefix}VehicleType`);
  const type = typeEl?.value || '';
  const isFilter = prefix === 'filter';
  const isMoto = type === 'moto';
  const isAuto = type === 'auto';
  const isAll = !type; // "Todos" — solo aplica en filtros

  const autoFuels = [['Nafta', 'Nafta'], ['Diesel', 'Diesel'], ['Híbrido', 'Híbrido'], ['GNC', 'GNC']];
  const motoFuels = [['Nafta', 'Nafta']];
  const commonFuels = [['Eléctrico', 'Eléctrico']];

  const autoTrans = [['Automático', 'Automático'], ['Automático CVT', 'Automático CVT'], ['Automático DSG', 'Automático DSG']];
  const motoTrans = [['Automático', 'Automático'], ['Quick Shifter', 'Quick Shifter']];

  let fuels, transmissions;
  if (isMoto) {
    fuels = [...motoFuels, ...commonFuels];
    transmissions = [['Manual', 'Manual'], ...motoTrans];
  } else if (isAuto) {
    fuels = [...autoFuels, ...commonFuels];
    transmissions = [['Manual', 'Manual'], ...autoTrans];
  } else {
    // "Todos" en filtros — mostrar todo excepto opciones exclusivas de moto
    fuels = [...autoFuels, ...commonFuels];
    transmissions = [['Manual', 'Manual'], ...autoTrans];
  }

  const placeholder = isFilter ? '' : '';
  const fuelPlaceholder = isFilter ? [['', 'Todos']] : [['', 'Seleccionar']];
  const tranPlaceholder = isFilter ? [['', 'Todas']] : [['', 'Seleccionar']];

  const fuelEl = document.getElementById(`${prefix}Fuel`);
  const transEl = document.getElementById(`${prefix}Transmission`);

  if (fuelEl) {
    const prev = fuelEl.value;
    const opts = [...fuelPlaceholder, ...fuels];
    fuelEl.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if (opts.some(([v]) => v === prev)) fuelEl.value = prev;
  }
  if (transEl) {
    const prev = transEl.value;
    const opts = [...tranPlaceholder, ...transmissions];
    transEl.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if (opts.some(([v]) => v === prev)) transEl.value = prev;
  }
}


async function initVehicleMap(city, province) {
  await loadLeaflet();
  if (vehicleMapInstance) { vehicleMapInstance.remove(); vehicleMapInstance = null; }
  const el = document.getElementById('vehicleMapSecondary') || document.getElementById('vehicleMap');
  if (!el) return;
  try {
    // Limpiar nombre de provincia: quitar paréntesis y su contenido (ej: "Buenos Aires (Prov.)" → "Buenos Aires")
    const cleanProvince = province ? province.replace(/\s*\(.*?\)/g, '').trim() : '';
    const byCity = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'ar', addressdetails: '1' });
    if (cleanProvince) {
      byCity.set('city', city);
      byCity.set('state', cleanProvince);
      byCity.set('country', 'Argentina');
    } else {
      byCity.set('q', `${city}, Argentina`);
    }
    const byCityRes = await fetch(`https://nominatim.openstreetmap.org/search?${byCity}`);
    const data = await byCityRes.json();

    if (!data?.length) { el.parentElement.style.display = 'none'; return; }
    const { lat, lon, display_name } = data[0];
    vehicleMapInstance = L.map(el, {
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([parseFloat(lat), parseFloat(lon)], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(vehicleMapInstance);
    const icon = L.divIcon({
      html: `<div style="background:var(--primary,#f59e0b);width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [14, 14],
      className: ''
    });
    L.marker([parseFloat(lat), parseFloat(lon)], { icon }).addTo(vehicleMapInstance)
      .bindPopup(`<b>${city}</b><br><span style="font-size:0.78rem;color:#555">${display_name.split(',').slice(0, 3).join(',')}</span>`)
      .openPopup();
  } catch { el?.parentElement && (el.parentElement.style.display = 'none'); }
}

function verifiedBadge() {
  return `<span class="verified-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>Verificado</span>`;
}

function verifiedCheckIcon(extraClass = '') {
  const cls = extraClass ? `verified-check-icon ${extraClass}` : 'verified-check-icon';
  return `<span class="${cls}" title="Verificado" aria-label="Verificado"><img src="/icons/verificar.png" alt="" loading="lazy"></span>`;
}

function verifiedImageBadge(extraClass = '') {
  const cls = extraClass ? `verified-image-badge ${extraClass}` : 'verified-image-badge';
  return `<span class="${cls}" title="Verificado" aria-label="Verificado"><img src="/icons/verificar.png" alt="" loading="lazy"><span>Verificado</span></span>`;
}

let authTokenMemory = '';

function getAuthToken() {
  if (authTokenMemory) return authTokenMemory;
  try {
    authTokenMemory = String(localStorage.getItem('token') || '').trim();
  } catch {
    authTokenMemory = '';
  }
  return authTokenMemory;
}

function setAuthToken(token = '') {
  authTokenMemory = String(token || '').trim();
  try {
    if (authTokenMemory) localStorage.setItem('token', authTokenMemory);
    else localStorage.removeItem('token');
  } catch {
    // If storage is blocked, keep in-memory token for this session.
  }
}

function clearAuthToken() {
  setAuthToken('');
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers, signal: options.signal });
  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  const text = contentType.includes('application/json') ? '' : await response.text().catch(() => '');
  if (!response.ok) {
    const fallbackHttpMsg = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const rawText = String(text || '').trim();
    const looksLikeHtml = /<!doctype|<html|<head|<body/i.test(rawText) || rawText.startsWith('<');
    const normalizedText = looksLikeHtml
      ? ''
      : rawText.replace(/\s+/g, ' ').slice(0, 180);
    const err = new Error(data.error || data.message || normalizedText || fallbackHttpMsg);
    err.status = response.status;
    if (data.needsVerification) err.needsVerification = true;
    throw err;
  }
  return data;
}

function showSection(sectionId, options = {}) {
  const pushHistory = options.pushHistory !== false && !isHandlingPopState;
  const preserveScroll = options.preserveScroll === true;
  const skipSectionLoad = options.skipSectionLoad === true;
  const vehiclesPage = Number(options.vehiclesPage) > 0 ? Number(options.vehiclesPage) : 1;

  if (sectionId !== 'vehicle-detail') resetSEOMeta();
  setRobotsMetaForSection(sectionId);
  if (sectionId !== 'home') {
    loadLucideIcons();
  }
  if (currentUser && (sectionId === 'login' || sectionId === 'register')) return;
  // Push state para que el botón atrás funcione dentro del SPA
  if (pushHistory) {
    const publicSections = ['home', 'vehicles', 'support', 'login', 'register', 'forgot-password', 'terms'];
    const profileRoute = sectionId === 'profile' && currentProfileId
      ? `/?section=profile&profile=${encodeURIComponent(String(currentProfileId))}`
      : null;
    if (sectionId === 'vehicle-detail') {
      // El ruteo de detalle se controla en viewVehicle(...) con ?vehicle=<id>
    } else if (publicSections.includes(sectionId)) {
      const url = sectionId === 'home' ? '/' : `/?section=${sectionId}`;
      history.pushState({ section: sectionId }, '', url);
    } else if (sectionId === 'profile' && profileRoute) {
      history.pushState({ section: sectionId, profileId: String(currentProfileId) }, '', profileRoute);
    } else {
      history.pushState({ section: sectionId }, '', `/?section=${sectionId}`);
    }
  }
  // Limpiar el div de reenvío de verificación al salir del login
  document.getElementById('resendVerificationDiv')?.remove();
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
    // Avoid animating home to reduce CLS on first paint and route transitions.
    if (sectionId === 'home') section.classList.remove('fade-in');
    else section.classList.add('fade-in');
  }
  currentSectionId = sectionId;
  wireImplicitFormLabels();
  setBottomNavActive(sectionId);
  if (!skipSectionLoad) {
    if (sectionId === 'home') { loadHomeRecent(); }
    else if (sectionId === 'vehicles') loadVehicles(vehiclesPage, false, { skipStateSync: !pushHistory });
    else if (sectionId === 'my-vehicles') loadMyVehicles();
    else if (sectionId === 'messages') {
      if (!getAuthToken()) {
        showToast('Iniciá sesión para usar el chat', 'warning');
        showSection('login');
      } else {
        document.querySelector('.messages-container')?.classList.remove('chat-open');
        loadConversations();
      }
    }
    else if (sectionId === 'favorites') loadFavorites();
    else if (sectionId === 'notifications') loadNotifications();
    else if (sectionId === 'following-feed') loadFollowingFeed(1, true);
    else if (sectionId === 'admin') loadAdmin();
    else if (sectionId === 'login') {
      initGoogleLoginButton();
    }
    else if (sectionId === 'register') {
      ensureHCaptchaForSection('register');
    }
    else if (sectionId === 'publish') {
      resetPublishForm();
    }
    else if (sectionId === 'support') {
      prefillSupportContact();
      ensureHCaptchaForSection('support');
    }
  }
  if (sectionId !== 'messages') stopPolling();
  if (sectionId !== 'messages') currentConversationId = null;
  if (sectionId !== 'vehicle-detail') currentVehicleId = null;
  if (!preserveScroll) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  if (sectionId === 'vehicles') {
    scheduleVehiclesListStateSync();
  }
}

function initHomeWithoutShift() {
  setRobotsMetaForSection('home');
  setBottomNavActive('home');
  const home = document.getElementById('home');
  if (home) {
    home.style.display = 'block';
    home.classList.remove('fade-in');
  }
  document.querySelectorAll('.section').forEach(s => {
    if (s.id !== 'home') s.style.display = 'none';
  });
  currentSectionId = 'home';
  loadHomeRecent();
}

function setBottomNavActive(sectionId) {
  const items = document.querySelectorAll('.bottom-nav .bottom-nav-item');
  if (!items.length) return;
  items.forEach(el => el.classList.remove('active'));
  const map = {
    'home': 0,
    'vehicles': 1,
    'vehicle-detail': 1,
    'messages': 2,
    'publish': 3,
    'favorites': 4,
    'following-feed': 4,
    'my-vehicles': 4,
    'notifications': 4,
    'support': 4,
    'profile': 4,
    'admin': 4,
  };
  const idx = map[sectionId];
  if (idx !== undefined && items[idx]) items[idx].classList.add('active');
}

function autofillPublishLocationFromProfile() {
  if (!currentUser?.profile?.city) return;
  const match = AR_CITIES.find(c => c.city === currentUser.profile.city);
  if (!match) return;
  setTimeout(() => {
    const provEl = document.getElementById('publishProvince');
    if (provEl && !provEl.value) {
      provEl.value = match.prov;
      provEl.dispatchEvent(new Event('change'));
      setTimeout(() => {
        const cityEl = document.getElementById('publishCity');
        if (cityEl) cityEl.value = match.city;
      }, 50);
    }
  }, 50);
}

function resetPublishForm() {
  const form = document.querySelector('#publish form');
  if (form) form.reset();

  uploadedImages = [];
  renderImagePreviews();

  const imageInput = document.getElementById('imageInput');
  if (imageInput) imageInput.value = '';

  const titleInput = document.getElementById('publishTitle');
  if (titleInput) titleInput.value = '';
  const titlePreview = document.getElementById('publishTitlePreview');
  if (titlePreview) {
    titlePreview.textContent = 'Completá marca, modelo y año para ver el título';
    titlePreview.style.color = 'var(--text-3)';
  }

  const cityEl = document.getElementById('publishCity');
  if (cityEl) {
    cityEl.innerHTML = '<option value="">Primero seleccioná una provincia</option>';
    cityEl.disabled = true;
  }

  const typeEl = document.getElementById('publishVehicleType');
  if (typeEl) typeEl.value = 'auto';
  const publishBodyTypeEl = document.getElementById('publishBodyType');
  if (publishBodyTypeEl) publishBodyTypeEl.value = '';
  toggleEngineCCField('publish');
  toggleBodyTypeField('publish');
  toggleDrivetrainField('publish');
  updateVehicleTypeOptions('publish');
  updatePublishBrands();
  const publishBrandEl = document.getElementById('publishBrand');
  if (publishBrandEl) {
    publishBrandEl.value = '';
    syncBrandPickerTrigger('publishBrand');
  }
  const publishModelEl = document.getElementById('publishModel');
  if (publishModelEl) publishModelEl.value = '';
  const publishModelSel = document.getElementById('publishModel');
  if (publishModelSel) populateSelect(publishModelSel, [], 'Seleccionar modelo');
  const publishDrivetrainEl = document.getElementById('publishDrivetrain');
  if (publishDrivetrainEl) publishDrivetrainEl.value = '';
  const publishFinancingProviderEl = document.getElementById('publishFinancingProvider');
  if (publishFinancingProviderEl) publishFinancingProviderEl.value = 'prestito';
  toggleFinancingProviderField('publish');

  const pubCurrencyEl = document.getElementById('publishCurrency');
  if (pubCurrencyEl) {
    pubCurrencyEl.value = 'ARS';
    pubCurrencyEl.dataset.prev = 'ARS';
  }
  syncPriceBaseUSD('publish');

  const pubHintEl = document.getElementById('publishPriceHint');
  if (pubHintEl) pubHintEl.textContent = '';

  const btn = document.getElementById('publishBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Publicar Vehículo';
  }

  // Mostrar campo de teléfono de contacto solo para admins
  const phoneGroup = document.getElementById('publishContactPhoneGroup');
  if (phoneGroup) phoneGroup.style.display = currentUser?.profile?.is_admin ? 'block' : 'none';
  const addressGroup = document.getElementById('publishContactAddressGroup');
  if (addressGroup) addressGroup.style.display = currentUser?.profile?.is_admin ? 'block' : 'none';
  const addressEl = document.getElementById('publishContactAddress');
  if (addressEl) addressEl.value = '';

  autofillPublishLocationFromProfile();
  initPublishYearSelect();
  initPublishStepperObserver();
}


function suggestUsername() {
  const first = document.getElementById('registerFirstName')?.value.trim().toLowerCase() || '';
  const last = document.getElementById('registerLastName')?.value.trim().toLowerCase() || '';
  const usernameEl = document.getElementById('registerUsername');
  if (!usernameEl || usernameEl.dataset.edited === 'true') return;
  const suggestion = (first + last).replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  if (suggestion) usernameEl.placeholder = suggestion;
  usernameEl.value = suggestion;
}

function updatePasswordStrength(password, scope = 'register') {
  const ids = scope === 'reset'
    ? { fill: 'resetPasswordStrengthFill', label: 'resetPasswordStrengthLabel' }
    : { fill: 'registerPasswordStrengthFill', label: 'registerPasswordStrengthLabel' };
  const fill = document.getElementById(ids.fill);
  const label = document.getElementById(ids.label);
  if (!fill || !label) return;

  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const variety = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  let score = 0;
  if (len >= 6) score++;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (variety >= 3) score++;
  if (variety === 4) score++;

  const levels = [
    { pct: 0,   color: 'transparent', text: '' },
    { pct: 20,  color: '#ef4444', text: '🔴 Muy débil' },
    { pct: 45,  color: '#f97316', text: '🟠 Débil' },
    { pct: 65,  color: '#eab308', text: '🟡 Moderada' },
    { pct: 85,  color: '#22c55e', text: '🟢 Fuerte' },
    { pct: 100, color: '#6c63ff', text: '💜 Muy fuerte' },
  ];

  const level = levels[Math.min(score, 5)];
  fill.style.width = len === 0 ? '0%' : `${level.pct}%`;
  fill.style.background = level.color;
  label.textContent = level.text;
  label.style.color = level.color;
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Registrando...';
  
  const firstName = document.getElementById('registerFirstName').value.trim();
  const lastName = document.getElementById('registerLastName').value.trim();
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  let captchaToken = getHCaptchaToken('registerCaptcha');
  if (!captchaToken) {
    showToast('Por favor completá el captcha', 'error');
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  try {
    const data = await request('/register', { method: 'POST', body: JSON.stringify({ username, email, password, captchaToken, firstName, lastName }) });
    if (data.needsVerification) {
      showSection('login');
      showToast('¡Cuenta creada! Te enviamos un email de verificación. Revisá tu bandeja de entrada.', 'success');
    } else {
      // fallback por si el email no está configurado
      setAuthToken(data.token);
      currentUser = data.user;
      if (!heartbeatInterval) heartbeatInterval = setInterval(() => { if (currentUser && document.visibilityState === 'visible') request('/ping', { method: 'PUT' }).catch(() => {}); }, 30000);
      if (!notifInterval) notifInterval = setInterval(() => { if (currentUser) { loadCounts(); } }, 30000);
      updateNav();
      loadUserFavoriteIds();
      showToast('Registro exitoso. ¡Bienvenido!', 'success');
      showSection('home');
    }
  } catch (err) {
    showToast(err.message, 'error');
    resetHCaptchaWidget('registerCaptcha');
  }
  finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Iniciando sesión...';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setAuthToken(data.token);
    currentUser = await request('/user');
    if (!heartbeatInterval) heartbeatInterval = setInterval(() => { if (currentUser && document.visibilityState === 'visible') request('/ping', { method: 'PUT' }).catch(() => {}); }, 30000);
    if (!notifInterval) notifInterval = setInterval(() => { if (currentUser) { loadCounts(); } }, 30000);
    updateNav();
    loadUserFavoriteIds();
    showToast('¡Bienvenido!', 'success');
    showSection('home');
  } catch (err) {
    if (err.needsVerification) {
      showToast(err.message, 'error');
      // Mostrar opción de reenviar verificación
      const loginForm = document.querySelector('#login .form-container');
      if (loginForm && !document.getElementById('resendVerificationBtn')) {
        const resendDiv = document.createElement('p');
        resendDiv.id = 'resendVerificationDiv';
        resendDiv.style.cssText = 'text-align:center;margin-top:0.75rem;font-size:0.88rem;color:var(--text-2);';
        const resendLink = document.createElement('a');
        resendLink.id = 'resendVerificationBtn';
        resendLink.textContent = 'Reenviar';
        resendLink.style.cssText = 'color:var(--primary-light);cursor:pointer;font-weight:600;';
        resendLink.dataset.email = email; // Sin insertar en onclick — evita XSS
        resendLink.addEventListener('click', () => resendVerification(resendLink.dataset.email));
        resendDiv.append('¿No recibiste el email? ', resendLink);
        loginForm.appendChild(resendDiv);
      }
    } else {
      showToast(err.message, 'error');
    }
  }
  finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  const email = document.getElementById('forgotEmail').value;
  try {
    await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    showToast('Si el email existe, te enviamos el link de recuperación. Revisá tu bandeja.', 'success');
    showSection('login');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetPasswordConfirm').value;
  const token = document.getElementById('resetToken').value;
  if (password !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
    showToast('¡Contraseña actualizada! Ya podés iniciar sesión.', 'success');
    showSection('login');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function resendVerification(email) {
  const btn = document.getElementById('resendVerificationBtn');
  if (btn) { btn.textContent = 'Enviando...'; btn.style.pointerEvents = 'none'; }
  try {
    await request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
    showToast('Email de verificación reenviado. Revisá tu bandeja.', 'success');
    if (btn) btn.textContent = 'Enviado ✓';
  } catch (err) {
    showToast(err.message, 'error');
    if (btn) { btn.textContent = 'Reenviar'; btn.style.pointerEvents = ''; }
  }
}

function logout() {
  clearAuthToken();
  currentUser = null;
  uploadedImages = [];
  userFavoriteIds = new Set();
  // BUG-06: clear heartbeat and notif intervals
  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  clearInterval(notifInterval);
  notifInterval = null;
  // BUG-20: clear dolar rate interval so it doesn't keep running post-logout
  if (dolarRateInterval) { clearInterval(dolarRateInterval); dolarRateInterval = null; }
  stopPolling();
  updateNav();
  showToast('Sesión cerrada', 'success');
  showSection('home');
}

// VEHICLES
async function loadVehicles(page = 1, scrollToResults = false, options = {}) {
  const targetPage = Number(page) > 0 ? Number(page) : 1;
  vehiclesCurrentPage = targetPage;
  if (vehicleSearchAbortController) {
    vehicleSearchAbortController.abort();
  }
  vehicleSearchAbortController = new AbortController();
  const container = document.getElementById('vehiclesList');
  if (targetPage === 1 && container) {
    container.innerHTML = Array(6).fill().map(() => `
      <div class="vehicle-card" style="padding: 1rem;">
        <div class="skeleton skeleton-img"></div>
        <div style="padding: 1rem 0;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width: 50%"></div>
        </div>
      </div>
    `).join('');
  }
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('searchInput')?.value || '';
    const normalizedSearch = normalizeSearchQueryWithTypos(search);
    if (normalizedSearch.query) params.append('search', normalizedSearch.query);
    updateSearchCorrectionHint(search, normalizedSearch.query, normalizedSearch.corrected);
    ['brand', 'model', 'minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage', 'fuel', 'transmission', 'city', 'province', 'sort'].forEach(key => {
      const el = document.getElementById('filter' + key.charAt(0).toUpperCase() + key.slice(1));
      if (el?.value) params.append(key, el.value);
    });
    const vehicleTypeEl = document.getElementById('filterVehicleType');
    if (vehicleTypeEl?.value) params.append('vehicle_type', vehicleTypeEl.value);
    params.append('page', targetPage);
    const { vehicles = [], total = 0 } = await request(`/vehicles?${params}`, { signal: vehicleSearchAbortController.signal }) || {};
    if (!vehicles?.length) {
      container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg><h3>No hay vehículos</h3><p>Sé el primero en publicar</p></div>';
      return;
    }
    container.innerHTML = vehicles.map((v, idx) => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" width="520" height="325" decoding="async" ${idx === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} onerror="this.src=PLACEHOLDER_IMG">
          <div class="vehicle-img-overlay"></div>
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${buildVehicleStatusBadges(v)}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)" aria-label="Agregar a favoritos"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          ${buildVehicleMetaHtml(v)}
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <div class="avatar-tiny">${(v.seller_verified ? v.seller_dealership : (v.seller_first_name || v.seller_name))?.charAt(0)?.toUpperCase()}</div>
              <div class="vehicle-seller-info">
                <div class="vehicle-seller-name-row">
                <span>${escapeHtml(v.seller_verified && v.seller_dealership ? v.seller_dealership : (v.seller_first_name && v.seller_last_name ? `${v.seller_first_name} ${v.seller_last_name}` : (v.seller_name || 'Anónimo')))}</span>
                ${v.seller_verified ? verifiedCheckIcon() : ''}
                </div>
              </div>
            </div>
            <div class="vehicle-views">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ${v.view_count || 0}
            </div>
          </div>
        </div>
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
    renderPagination(total, targetPage);
    if (scrollToResults) {
      const nav = document.querySelector('.navbar');
      const navHeight = nav ? nav.getBoundingClientRect().height : 0;
      const y = container.getBoundingClientRect().top + window.scrollY - navHeight - 10;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
    if (!options.skipStateSync && currentSectionId === 'vehicles') {
      scheduleVehiclesListStateSync();
      if (scrollToResults) {
        setTimeout(() => {
          if (currentSectionId === 'vehicles') persistVehiclesListState();
        }, 450);
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
    showToast(err.message, 'error');
  }
}

function renderPagination(total, current) {
  const perPage = 12;
  const pages = Math.ceil(total / perPage);
  const container = document.getElementById('vehiclesPagination');
  if (pages <= 1) { container.innerHTML = ''; return; }
  const pagesToShow = new Set(
    [1, pages, current - 1, current, current + 1].filter(p => p >= 1 && p <= pages)
  );
  const sortedPages = [...pagesToShow].sort((a, b) => a - b);
  let html = '';
  let prevPage = 0;
  for (const p of sortedPages) {
    if (p - prevPage > 1) {
      html += `<button class="" disabled style="cursor:default;opacity:0.5;">…</button>`;
    }
    html += `<button class="${p === current ? 'active' : ''}" onclick="loadVehicles(${p}, true)">${p}</button>`;
    prevPage = p;
  }
  container.innerHTML = html;
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadVehicles(1), 500);
}

function debounceAdmin(fn) {
  clearTimeout(adminSearchTimeout);
  adminSearchTimeout = setTimeout(fn, 400);
}

function toggleFilters() {
  const panel = document.getElementById('filtersPanel');
  const btn = document.getElementById('filterToggleBtn');
  if (!panel) return;
  panel.style.display = '';
  const isOpen = panel.classList.toggle('open');
  panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (isOpen) updateMobileFilterApplyButton();
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function updateMobileFilterApplyButton() {
  const btn = document.getElementById('filterApplyBtn');
  if (!btn) return;
  if (!isMobileViewport()) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'inline-flex';
  btn.disabled = !filtersDirty;
  btn.style.opacity = filtersDirty ? '1' : '0.7';
}

function applyFilters(force = false) {
  if (isMobileViewport() && !force) {
    filtersDirty = true;
    updateMobileFilterApplyButton();
    return;
  }
  filtersDirty = false;
  updateMobileFilterApplyButton();
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadVehicles(1), 300);
}

function applyFiltersNow() {
  applyFilters(true);
}

function clearFilters() {
  ['filterVehicleType', 'filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxYear', 'filterBrand', 'filterModel', 'filterFuel', 'filterTransmission', 'filterCity', 'filterMaxMileage', 'filterProvince', 'filterSort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  initBrandFilters();
  const filterModelEl = document.getElementById('filterModel');
  if (filterModelEl) filterModelEl.innerHTML = '<option value="">Todos</option>';
  const filterCityEl = document.getElementById('filterCity');
  if (filterCityEl) { filterCityEl.innerHTML = '<option value="">Todas las ciudades</option>'; filterCityEl.disabled = true; }
  filtersDirty = false;
  updateMobileFilterApplyButton();
  loadVehicles(1);
}

function formatPesos(usdPrice, vehicle) {
  const fixedArs = Number(vehicle?.price_original || 0);
  if (fixedArs > 0) return '$' + Math.round(fixedArs).toLocaleString('es-AR');
  return null;
}

function isCompactVehicleCardsMobile() {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(max-width: 768px)').matches;
}

function buildVehicleStatusBadges(v, { compact = false } = {}) {
  if (!v || v.status === 'sold') return '';

  const tradeLabel = v.accepts_trade
    ? (compact ? 'Permuta' : '🔄 Permuta')
    : 'Sin permuta';
  const badges = [
    `<span class="vehicle-trade-badge ${v.accepts_trade ? 'trade-yes' : 'trade-no'}">${tradeLabel}</span>`
  ];

  if (v.accepts_financing) {
    const financingLabel = compact ? 'Financiación' : '💳 Financiación';
    badges.push(`<span class="vehicle-trade-badge finance-yes">${financingLabel}</span>`);
  }

  return `<div class="vehicle-badges">${badges.join('')}</div>`;
}

function buildVehicleMetaHtml(v) {
  const chips = [];
  const addChip = (html) => {
    if (html && !chips.includes(html)) chips.push(html);
  };
  const mileageChip = v.mileage === 0
    ? '<span class="badge-nuevo">NUEVO</span>'
    : `<span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${formatNumber(v.mileage)} km</span>`;
  addChip(mileageChip);

  const rawFuel = String(v.fuel || '').trim();
  const hasFuel = rawFuel && rawFuel.toLowerCase() !== 'n/a' && rawFuel.toLowerCase() !== 'na';
  const rawTransmission = String(v.transmission || '').trim();
  const rawBodyType = String(v.body_type || '').trim();
  const rawDrivetrain = String(v.drivetrain || '').trim();
  const normalizedBodyType = rawBodyType.toLowerCase();
  const isTruckBodyType = ['camioneta', 'pickup', 'pick-up'].includes(normalizedBodyType);

  if (hasFuel) {
    addChip(`<span>${escapeHtml(rawFuel)}</span>`);
  }

  if (rawTransmission) {
    addChip(`<span>${escapeHtml(rawTransmission)}</span>`);
  }

  if (v.vehicle_type === 'moto') {
    if (v.engine_cc) {
      addChip(`<span>${v.engine_cc} cc</span>`);
    }
  } else {
    if (rawBodyType) {
      addChip(`<span>${escapeHtml(rawBodyType)}</span>`);
    }
    if (rawDrivetrain && (isTruckBodyType || !rawBodyType)) {
      addChip(`<span>${escapeHtml(rawDrivetrain)}</span>`);
    }
  }

  if (isCompactVehicleCardsMobile()) {
    chips.splice(4);
  }

  return `<div class="vehicle-meta">${chips.join('')}</div>`;
}

function updateDolarWidget() {
  const el = document.getElementById('dolarWidget');
  if (!el) return;
  if (!dolarRate?.venta) { el.style.display = 'none'; return; }
  el.style.display = 'inline-flex';
  el.textContent = `💵 Blue $${Number(dolarRate.venta).toLocaleString('es-AR')}`;
}

async function loadDolarRate() {
  try {
    const data = await request('/dolar');
    if (data?.venta) {
      dolarRate = data;
      updateDolarWidget();
    }
  } catch { /* silencioso */ }
}

// ===== BRAND PICKER =====
const BRAND_LOGO_MAP = {
  'Alfa Romeo': 'alfa-romeo', 'Audi': 'audi', 'BMW': 'bmw', 'Chevrolet': 'chevrolet',
  'Citroën': 'citroen', 'Fiat': 'fiat', 'Ford': 'ford', 'Honda': 'honda',
  'Hyundai': 'hyundai', 'Jeep': 'jeep', 'Kia': 'kia', 'Land Rover': 'land-rover',
  'Mazda': 'mazda', 'Mercedes-Benz': 'mercedes-benz', 'Mini': 'mini',
  'Mitsubishi': 'mitsubishi', 'Nissan': 'nissan', 'Peugeot': 'peugeot',
  'Porsche': 'porsche', 'Ram': 'ram', 'Renault': 'renault', 'Subaru': 'subaru',
  'Suzuki': 'suzuki', 'Toyota': 'toyota', 'Volkswagen': 'volkswagen', 'Volvo': 'volvo',
};

function brandLogoUrl(brand) {
  const key = BRAND_LOGO_MAP[brand];
  return key ? `/brand-logos/${key}.png` : null;
}

function initBrandPicker(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  // Remove old picker if re-initializing
  const old = select.parentElement.querySelector('.brand-picker');
  if (old) old.remove();
  // Native HTML5 validation can't focus hidden controls.
  // Persist the original required state and disable native required on the hidden select.
  if (!select.dataset.wasRequired) select.dataset.wasRequired = String(select.required);
  select.required = false;
  select.style.display = 'none';

  const emptyLabel = select.options[0]?.text || 'Seleccionar';
  const picker = document.createElement('div');
  picker.className = 'brand-picker';
  picker.dataset.selectId = selectId;

  picker.innerHTML = `
    <button type="button" class="brand-picker-trigger" onclick="toggleBrandPicker('${selectId}')">
      <img class="brand-picker-logo" style="display:none" alt="">
      <span class="brand-picker-label">${emptyLabel}</span>
      <svg class="brand-picker-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
    <div class="brand-picker-dropdown" id="brand-picker-dropdown-${selectId}">
      <input class="brand-picker-search" type="text" placeholder="Buscar marca..." oninput="filterBrandPicker('${selectId}', this.value)">
      <div class="brand-picker-options" id="brand-picker-options-${selectId}"></div>
    </div>
  `;
  select.parentElement.insertBefore(picker, select);
  buildBrandPickerOptions(selectId);
  syncBrandPickerTrigger(selectId);
}

function buildBrandPickerOptions(selectId) {
  const select = document.getElementById(selectId);
  const container = document.getElementById(`brand-picker-options-${selectId}`);
  if (!select || !container) return;
  container.innerHTML = '';
  for (const opt of select.options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'brand-picker-option' + (opt.value === select.value ? ' selected' : '');
    btn.dataset.value = opt.value;
    if (!opt.value) {
      btn.innerHTML = `<span class="brand-picker-option-empty">${escapeHtml(opt.text)}</span>`;
    } else {
      const logo = brandLogoUrl(opt.value);
      btn.innerHTML = `${logo ? `<img src="${logo}" alt="${escapeHtml(opt.value)}" loading="lazy">` : '<span style="width:24px"></span>'}<span>${escapeHtml(opt.text)}</span>`;
    }
    btn.onclick = () => selectBrandPicker(selectId, opt.value, opt.text);
    container.appendChild(btn);
  }
}

function syncBrandPickerTrigger(selectId) {
  const select = document.getElementById(selectId);
  const picker = select?.parentElement.querySelector('.brand-picker');
  if (!select || !picker) return;
  const trigger = picker.querySelector('.brand-picker-trigger');
  const logoEl = trigger.querySelector('.brand-picker-logo');
  const labelEl = trigger.querySelector('.brand-picker-label');
  const selectedOpt = select.options[select.selectedIndex];
  const value = select.value || '';
  const label = selectedOpt?.text || (select.options[0]?.text || 'Seleccionar');
  const logo = value ? brandLogoUrl(value) : null;
  if (logo) { logoEl.src = logo; logoEl.style.display = 'block'; }
  else { logoEl.style.display = 'none'; }
  labelEl.textContent = label;
}

function selectBrandPicker(selectId, value, label) {
  const select = document.getElementById(selectId);
  const picker = select?.parentElement.querySelector('.brand-picker');
  if (!select || !picker) return;
  select.value = value;
  const trigger = picker.querySelector('.brand-picker-trigger');
  const logoEl = trigger.querySelector('.brand-picker-logo');
  const labelEl = trigger.querySelector('.brand-picker-label');
  const logo = value ? brandLogoUrl(value) : null;
  if (logo) { logoEl.src = logo; logoEl.style.display = 'block'; }
  else { logoEl.style.display = 'none'; }
  labelEl.textContent = label;
  picker.querySelectorAll('.brand-picker-option').forEach(b => b.classList.toggle('selected', b.dataset.value === value));
  closeBrandPicker(selectId);
  select.dispatchEvent(new Event('change'));
}

function toggleBrandPicker(selectId) {
  const select = document.getElementById(selectId);
  const dropdown = document.getElementById(`brand-picker-dropdown-${selectId}`);
  const trigger = select?.parentElement.querySelector('.brand-picker-trigger');
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  // Close all other pickers
  document.querySelectorAll('.brand-picker-dropdown.open').forEach(d => {
    d.classList.remove('open');
    d.closest('.brand-picker')?.querySelector('.brand-picker-trigger')?.classList.remove('open');
  });
  if (!isOpen) {
    dropdown.classList.add('open');
    trigger?.classList.add('open');
    dropdown.querySelector('.brand-picker-search')?.focus();
  }
}

function closeBrandPicker(selectId) {
  const dropdown = document.getElementById(`brand-picker-dropdown-${selectId}`);
  const select = document.getElementById(selectId);
  dropdown?.classList.remove('open');
  select?.parentElement.querySelector('.brand-picker-trigger')?.classList.remove('open');
}

function filterBrandPicker(selectId, query) {
  const container = document.getElementById(`brand-picker-options-${selectId}`);
  if (!container) return;
  const q = query.toLowerCase();
  container.querySelectorAll('.brand-picker-option').forEach(btn => {
    const text = btn.querySelector('span:last-child')?.textContent || btn.textContent;
    btn.style.display = !q || text.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Close picker on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.brand-picker')) {
    document.querySelectorAll('.brand-picker-dropdown.open').forEach(d => {
      d.classList.remove('open');
      d.closest('.brand-picker')?.querySelector('.brand-picker-trigger')?.classList.remove('open');
    });
  }
});

function initBrandFilters() {
  const select = document.getElementById('filterBrand');
  const provinceSelect = document.getElementById('filterProvince');
  if (provinceSelect && provinceSelect.options.length <= 1) {
    AR_PROVINCES.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      provinceSelect.appendChild(opt);
    });
  }
  if (select) {
    const filterType = document.getElementById('filterVehicleType')?.value ?? '';
    const filterBrandsObj = getBrandsForType(filterType);
    select.innerHTML = '<option value="">Todas</option>';
    sortedBrandKeys(filterBrandsObj, filterType).forEach(brand => {
      const opt = document.createElement('option');
      opt.value = brand;
      opt.textContent = brand;
      select.appendChild(opt);
    });
    // Reset model select when brands change
    const filterModel = document.getElementById('filterModel');
    if (filterModel) filterModel.innerHTML = '<option value="">Todos</option>';
    initBrandPicker('filterBrand');
  }
}

function updateFilterCities() {
  const provSelect = document.getElementById('filterProvince');
  const citySelect = document.getElementById('filterCity');
  if (!provSelect || !citySelect) return;
  const prov = provSelect.value;
  citySelect.innerHTML = '<option value="">Todas las ciudades</option>';
  if (!prov) {
    citySelect.disabled = true;
    return;
  }
  AR_CITIES.filter(c => c.prov === prov).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.city;
    opt.textContent = c.city;
    citySelect.appendChild(opt);
  });
  citySelect.disabled = false;
}

function updateFilterModels() {
  const brand = document.getElementById('filterBrand').value;
  const modelSelect = document.getElementById('filterModel');
  modelSelect.innerHTML = '<option value="">Todos</option>';
  const type = document.getElementById('filterVehicleType')?.value || '';
  let models = [];
  if (brand) {
    if (type) {
      const brands = getBrandsForType(type);
      models = Array.isArray(brands[brand]) ? brands[brand] : [];
    } else {
      const merged = [
        ...(carBrands[brand] || []),
        ...(utilitarioBrands[brand] || []),
        ...(motoBrands[brand] || []),
        ...(cuatriBrands[brand] || []),
        ...(camionBrands[brand] || [])
      ];
      models = [...new Set(merged)];
    }
  }
  models.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
}

function populateSelect(selectEl, options, placeholder) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  options.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v; selectEl.appendChild(o); });
}

function updatePublishBrands() {
  const type = document.getElementById('publishVehicleType')?.value || 'auto';
  const sel = document.getElementById('publishBrand');
  if (!sel) return;
  const brandsObj = getBrandsForType(type);
  const prev = sel.value;
  sel.innerHTML = '<option value="">Seleccionar marca</option>';
  sortedBrandKeys(brandsObj, type).forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand; opt.textContent = brand;
    sel.appendChild(opt);
  });
  if (prev && brandsObj[prev]) sel.value = prev;
  initBrandPicker('publishBrand');
  updatePublishModels();
}

function updatePublishModels() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const type = document.getElementById('publishVehicleType')?.value || 'auto';
  const modelSel = document.getElementById('publishModel');
  if (!modelSel) return;
  const brandsObj = getBrandsForType(type);
  const models = (brand && brandsObj[brand]) ? brandsObj[brand] : [];
  populateSelect(modelSel, models, 'Seleccionar modelo');
  updatePublishVersions();
  const bte = document.getElementById('publishBodyType'); if (bte) bte.value = '';
  toggleBodyTypeField('publish'); toggleDrivetrainField('publish');
}

function toggleVersionInput(prefix) {
  const sel = document.getElementById(`${prefix}Version`);
  const manual = document.getElementById(`${prefix}VersionManual`);
  const btn = document.getElementById(`${prefix}VersionToggle`);
  if (!sel || !manual || !btn) return;
  const isManual = manual.style.display !== 'none';
  if (isManual) {
    // switch back to select
    manual.style.display = 'none';
    sel.style.display = '';
    btn.textContent = '✏️ Escribir';
    manual.value = '';
  } else {
    // switch to manual input — copy current select value
    manual.value = sel.value || '';
    sel.style.display = 'none';
    manual.style.display = '';
    btn.textContent = '☰ Lista';
  }
}

function getVersionValue(prefix) {
  const manual = document.getElementById(`${prefix}VersionManual`);
  if (manual && manual.style.display !== 'none') return manual.value.trim();
  return document.getElementById(`${prefix}Version`)?.value || '';
}

function updatePublishVersions() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const sel   = document.getElementById('publishVersion');
  if (!sel) return;
  const versions = versionsData[brand]?.[model] || [];
  populateSelect(sel, versions, 'Seleccionar versión');
  sel.disabled = !brand || !model;
}

// VEHICLE DETAIL
async function viewVehicle(id, options = {}) {
  const previousSection = currentSectionId;
  if (previousSection === 'vehicles') {
    persistVehiclesListState();
  }
  currentVehicleId = id;
  showSection('vehicle-detail', { pushHistory: false });
  const detailContainer = document.getElementById('vehicleDetailContent');
  if (detailContainer) {
    detailContainer.innerHTML = `
      <div style="padding: 2rem;">
        <div class="skeleton" style="height: 400px; border-radius: var(--radius); margin-bottom: 1.5rem;"></div>
        <div class="skeleton" style="height: 2rem; width: 60%; margin-bottom: 0.75rem;"></div>
        <div class="skeleton" style="height: 1.5rem; width: 40%; margin-bottom: 1.5rem;"></div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          ${Array(6).fill('<div class="skeleton" style="height: 80px; border-radius: var(--radius);"></div>').join('')}
        </div>
        <div class="skeleton" style="height: 120px; border-radius: var(--radius);"></div>
      </div>
    `;
  }
  try {
    const vehicle = await request(`/vehicles/${id}`);
    const isOwner = currentUser?.id === vehicle.seller_id || currentUser?.profile?.is_admin;
    const isAdminView = !!currentUser?.profile?.is_admin;
    const isLoggedIn = !!getAuthToken();
    let isFavorite = false;
    if (isLoggedIn) {
      try { const r = await request(`/favorites/${id}/check`); isFavorite = r.favorited; } catch {}
    }

    const sortedVehicleImages = (vehicle.vehicle_images || [])
      .filter(img => img?.url)
      .sort((a, b) => {
        const aPrimary = a.is_primary ? 0 : 1;
        const bPrimary = b.is_primary ? 0 : 1;
        if (aPrimary !== bPrimary) return aPrimary - bPrimary;
        const aOrder = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.id || 0) - (b.id || 0);
      });
    const images = sortedVehicleImages.length ? sortedVehicleImages : [{ url: vehicle.image_url || PLACEHOLDER_IMG }];
    const mainImgUrl = (images.find(img => img.is_primary)?.url || images[0].url);
    updateSEOMeta(vehicle, mainImgUrl);
    const nextDetailState = { section: 'vehicle-detail', vehicleId: Number(vehicle.id) };
    if (options.pushHistory === false || isHandlingPopState) {
      window.history.replaceState(nextDetailState, '', `?vehicle=${vehicle.id}`);
    } else {
      window.history.pushState(nextDetailState, '', `?vehicle=${vehicle.id}`);
    }
    const ownerWhatsapp = (vehicle.contact_phone || '').replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    const ownerLocationAddress = (vehicle.contact_address || '').trim();
    const ownerLocationProvince = (vehicle.province || '').replace(/\s*\(.*?\)/g, '').trim();
    const ownerLocationCity = (vehicle.city || '').trim();
    const ownerLocationSummary = [ownerLocationCity, ownerLocationProvince].filter(Boolean).join(', ');
    const ownerLocationDisplay = [ownerLocationAddress, ownerLocationCity, ownerLocationProvince].filter(Boolean).join(', ') || ownerLocationSummary;
    const ownerLocationQuery = [ownerLocationAddress, ownerLocationCity, ownerLocationProvince].filter(Boolean).join(', ');
    const ownerLocationUrl = ownerLocationQuery ? googleMapsSearchUrl(ownerLocationQuery) : '';
    const showDealershipLocationButton = !!ownerLocationAddress;
    const profileWhatsapp = (vehicle.seller_profile?.phone || '').replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    const sellerAddress = String(vehicle.seller_profile?.dealership_address || '').trim();
    const sellerCityMatch = AR_CITIES.find(c => c.city === vehicle.seller_profile?.city);
    const sellerCity = sellerCityMatch ? String(vehicle.seller_profile?.city || '').trim() : '';
    const sellerProvince = sellerCityMatch ? String(sellerCityMatch.prov || '').replace(/\s*\(.*?\)/g, '').trim() : '';
    const sellerLocationDisplay = [sellerAddress, sellerCity, sellerProvince].filter(Boolean).join(', ') || sellerAddress;
    const sellerLocationQuery = [sellerAddress, sellerCity, sellerProvince].filter(Boolean).join(', ');
    const sellerMapsUrl = sellerLocationQuery ? googleMapsSearchUrl(sellerLocationQuery) : '';
    const whatsappText = encodeURIComponent(`Hola, te contacto desde la pagina *Autoventa* por el siguiente anuncio: https://autoventa.online/?vehicle=${vehicle.id}`);
    const prestitoWhatsappText = encodeURIComponent(`Hola, vi en *Autoventa* este vehículo (${vehicle.title}). Quiero consultar financiación con Préstito: https://autoventa.online/?vehicle=${vehicle.id}`);
    const ownFinancingWhatsappText = encodeURIComponent(`Hola, vi en *Autoventa* este vehículo (${vehicle.title}). Quiero consultar la financiación propia del vendedor: https://autoventa.online/?vehicle=${vehicle.id}`);
    const financingProvider = String(vehicle.financing_provider || '').trim().toLowerCase();
    const isOwnFinancing = financingProvider === 'propia';
    const financingUsesPrestito = financingProvider === 'prestito';
    const financingTitleText = isOwnFinancing
      ? 'Este vendedor ofrece financiacion propia'
      : 'Este vendedor ofrece financiacion';
    const financingSubtitleText = financingUsesPrestito
      ? 'Podes simular cuotas y consultar requisitos'
      : 'Consulta condiciones directamente con el vendedor';
    const financingPrimaryCtaHtml = financingUsesPrestito
      ? `<button class="btn btn-primary financing-cta-btn" onclick="openPrestitoQuoteModal(${vehicle.id}, ${Number(vehicle.year || 0)}, ${Number(vehicle.price || 0)}, ${Number(vehicle.price_original || 0)}, '${escapeHtml(vehicle.title).replace(/'/g, '&#39;')}')">Cotizar con Prestito</button>`
      : '';
    const financingQuickMessage = financingUsesPrestito
      ? 'Quiero consultar financiacion con Prestito.'
      : (isOwnFinancing ? 'Quiero consultar financiacion propia.' : 'Quiero consultar financiacion.');
    const financingSecondaryCtaHtml = (vehicle.seller_profile?.phone && vehicle.seller_profile?.show_phone !== false)
      ? `<a href="https://wa.me/${escapeHtml(profileWhatsapp)}?text=${financingUsesPrestito ? prestitoWhatsappText : ownFinancingWhatsappText}" target="_blank" rel="noopener" class="btn btn-secondary financing-cta-btn">Consultar con el vendedor</a>`
      : (isLoggedIn
          ? `<button class="btn btn-secondary financing-cta-btn" onclick="const qm=document.getElementById('quickMsgInput'); if(qm){qm.value='${financingQuickMessage}'; qm.focus();}">Consultar por chat</button>`
          : '');
    const descriptionParagraphs = String(vehicle.description || '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);
    const normalizedDescriptionParagraphs = descriptionParagraphs.length
      ? descriptionParagraphs
      : String(vehicle.description || '')
          .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
          .reduce((chunks, sentence) => {
            const clean = sentence.trim();
            if (!clean) return chunks;
            if (!chunks.length || chunks[chunks.length - 1].length > 140) chunks.push(clean);
            else chunks[chunks.length - 1] += ` ${clean}`;
            return chunks;
          }, []);
    const descriptionHtml = normalizedDescriptionParagraphs.length
      ? normalizedDescriptionParagraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')
      : '';
    const pickupLocationLabel = [ownerLocationCity, ownerLocationProvince].filter(Boolean).join(', ');

    const content = document.getElementById('vehicleDetailContent');
    content.innerHTML = `
      <div class="detail-container">
        <div class="detail-gallery desktop-only">
          <div class="main-image" style="position:relative;">
            <img src="${escapeHtml(mainImgUrl)}" id="detailMainImage" alt="Vehículo" fetchpriority="high" style="cursor:pointer;" onclick="openLightbox(window._detailImages, window._detailImages.indexOf(this.src) >= 0 ? window._detailImages.indexOf(this.src) : 0)">
            ${vehicle.status === 'sold' ? '<div class="detail-sold-overlay"><span>VENDIDO</span></div>' : ''}
          </div>
          <div class="thumbnail-list" id="imageThumbnails">
            ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" class="${i === 0 ? 'active' : ''}" data-url="${escapeHtml(img.url || '')}" data-index="${i}" loading="lazy" onclick="document.getElementById('detailMainImage').src=this.dataset.url;this.parentElement.querySelectorAll('img').forEach(x=>x.classList.remove('active'));this.classList.add('active')">`).join('')}
          </div>
        </div>
        <div class="mobile-only" style="overflow-x: auto; scroll-snap-type: x mandatory; gap: 0.5rem; padding-bottom: 0.5rem; margin-bottom: 1.5rem; display:flex; position:relative;">
          ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" style="flex: 0 0 92%; scroll-snap-align: center; height: 350px; object-fit: cover; border-radius: var(--radius-lg); cursor:pointer;" loading="${i === 0 ? 'eager' : 'lazy'}" onclick="openLightbox(window._detailImages, ${i})">`).join('')}
          ${vehicle.status === 'sold' ? '<div class="detail-sold-overlay" style="border-radius:var(--radius-lg);"><span>VENDIDO</span></div>' : ''}
        </div>
        <div class="detail-info detail-info-primary" id="vehicleDetail">
          ${vehicle.status === 'paused' ? '<div class="sold-banner" style="border-color:rgba(245,158,11,0.3);color:var(--primary);background:rgba(245,158,11,0.08);">PAUSADO</div>' : ''}
          <h1>${escapeHtml(vehicle.title)}</h1>
          <p class="detail-subtitle">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</p>
          <div class="detail-price-block">
            ${formatPesos(vehicle.price, vehicle) ? `<div class="detail-price">${formatPesos(vehicle.price, vehicle)}</div><div class="detail-price-ars">USD ${formatNumber(vehicle.price)}</div>` : `<div class="detail-price">USD ${formatNumber(vehicle.price)}</div>`}
            ${ownerLocationDisplay ? `
              <div class="detail-price-location">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                ${escapeHtml(ownerLocationDisplay)}
              </div>
            ` : ''}
            ${vehicle.contact_phone && vehicle.status !== 'sold' ? `
              <a href="https://wa.me/${escapeHtml(ownerWhatsapp)}?text=${whatsappText}" target="_blank" rel="noopener" class="btn btn-primary" style="background:#25D366;border:none;width:100%;margin-top:0.75rem;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right:0.4rem;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Contactar al dueño
              </a>
            ` : ''}
            ${showDealershipLocationButton ? `
              <a href="${escapeHtml(ownerLocationUrl)}" target="_blank" rel="noopener" class="btn btn-primary" style="background:#2563eb;border:none;width:100%;margin-top:0.6rem;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:0.4rem;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                Ubicacion de la concesionaria
              </a>
            ` : ''}
          </div>
          <div class="detail-specs">
            <div class="spec-card">
              <div class="spec-head"><img class="spec-icon" src="/icons/spec-year.svg" alt="" loading="lazy"><div class="label">Año</div></div>
              <div class="value">${escapeHtml(String(vehicle.year))}</div>
            </div>
            <div class="spec-card">
              <div class="spec-head"><img class="spec-icon" src="/icons/spec-mileage.svg" alt="" loading="lazy"><div class="label">Kilometraje</div></div>
              <div class="value">${vehicle.mileage === 0 ? '<span class="badge-nuevo">NUEVO</span>' : formatNumber(vehicle.mileage) + ' km'}</div>
            </div>
            ${vehicle.version ? `<div class="spec-card"><div class="spec-head"><img class="spec-icon" src="/icons/spec-version.svg" alt="" loading="lazy"><div class="label">Versión</div></div><div class="value">${escapeHtml(vehicle.version)}</div></div>` : ''}
            <div class="spec-card">
              <div class="spec-head"><img class="spec-icon" src="/icons/spec-fuel.svg" alt="" loading="lazy"><div class="label">Combustible</div></div>
              <div class="value">${escapeHtml(vehicle.fuel || 'N/A')}</div>
            </div>
            <div class="spec-card">
              <div class="spec-head"><img class="spec-icon" src="/icons/spec-transmission.svg" alt="" loading="lazy"><div class="label">Transmisión</div></div>
              <div class="value">${escapeHtml(vehicle.transmission || 'N/A')}</div>
            </div>
            ${vehicle.drivetrain ? `<div class="spec-card"><div class="spec-head"><img class="spec-icon" src="/icons/spec-transmission.svg" alt="" loading="lazy"><div class="label">Tracción</div></div><div class="value">${escapeHtml(vehicle.drivetrain)}</div></div>` : ''}
            ${vehicle.vehicle_type === 'moto' && vehicle.engine_cc ? `<div class="spec-card"><div class="spec-head"><img class="spec-icon" src="/icons/spec-transmission.svg" alt="" loading="lazy"><div class="label">Cilindrada</div></div><div class="value">${vehicle.engine_cc} cc</div></div>` : ''}
          </div>
        </div>
        <div class="detail-secondary-grid">
          <div class="detail-secondary-main">
          ${vehicle.description ? `
            <div class="detail-description">
              <div class="detail-section-eyebrow">Historia del vehiculo</div>
              <h4>Descripción</h4>
              <div class="detail-description-copy">${descriptionHtml}</div>
            </div>
          ` : ''}
          </div>
          <div class="detail-secondary-sidebar">
          <div class="seller-card">
            <div class="seller-avatar">${vehicle.seller_profile?.avatar_url ? `<img src="${escapeHtml(vehicle.seller_profile.avatar_url || '')}" alt="" loading="lazy">` : (vehicle.seller_name?.charAt(0)?.toUpperCase() || '?')}</div>
            <div class="seller-info">
              <h4 onclick="viewProfile(${vehicle.seller_id})">${vehicle.seller_verified && vehicle.seller_profile?.dealership_name ? escapeHtml(vehicle.seller_profile.dealership_name) : (vehicle.seller_profile?.first_name && vehicle.seller_profile?.last_name ? escapeHtml(`${vehicle.seller_profile.first_name} ${vehicle.seller_profile.last_name}`) : escapeHtml(vehicle.seller_name))}</h4>
              ${vehicle.seller_verified ? `<div style="margin-bottom:0.5rem;">${verifiedImageBadge('verified-image-badge-detail')}</div>` : ''}
              ${vehicle.seller_rating ? `<div class="rating">${'★'.repeat(Math.round(vehicle.seller_rating))}${'☆'.repeat(5-Math.round(vehicle.seller_rating))} <span>(${vehicle.seller_ratings_count} reseñas)</span></div>` : '<div class="rating"><span style="color:var(--text-secondary)">Sin reseñas aún</span></div>'}
              <div class="seller-stats">
                <span><strong>${vehicle.seller_vehicles_count}</strong> vehículos</span>
                <span><strong id="followersCount">${vehicle.seller_followers_count || 0}</strong> seguidores</span>
              </div>
            </div>
            
            ${(vehicle.seller_verified && (vehicle.seller_profile?.dealership_address || vehicle.seller_profile?.instagram)) || vehicle.seller_profile?.phone ? `
              <div class="seller-contact-actions">
                ${vehicle.seller_verified && sellerMapsUrl ? `
                  <a href="${escapeHtml(sellerMapsUrl)}" target="_blank" rel="noopener" class="seller-contact-link location" title="${escapeHtml(sellerLocationDisplay || '')}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    Ver ubicación concesionaria
                  </a>
                ` : ''}
                ${vehicle.seller_profile?.instagram ? `
                  <a href="${escapeHtml(instagramUrl(vehicle.seller_profile.instagram))}" target="_blank" rel="noopener" class="seller-contact-link instagram">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Ver su instagram
                  </a>
                ` : ''}
                ${(vehicle.seller_profile?.phone && vehicle.seller_profile?.show_phone !== false) && vehicle.status !== 'sold' ? `
                  <a href="https://wa.me/${escapeHtml(profileWhatsapp)}?text=${whatsappText}" target="_blank" rel="noopener" class="seller-contact-link whatsapp">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Contactar por WhatsApp
                  </a>
                ` : ''}
              </div>
            ` : ''}
          </div>
          
          
          ${ownerLocationDisplay ? `
            <div class="detail-map-section">
              <h4 style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--text-2);display:flex;align-items:center;gap:0.4rem;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Ubicacion: ${escapeHtml(ownerLocationDisplay)}
                </h4>
                <div id="vehicleMap" class="vehicle-map"></div>
              </div>
            ` : ''}
          </div>
          <div class="detail-secondary-tail">

${vehicle.accepts_trade && isLoggedIn && !isOwner && vehicle.status === 'active' ? `
            <div style="margin-top:1.5rem;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div>
                <div style="font-weight:600;font-size:0.95rem;">🔄 Este vendedor acepta permutas</div>
                <div style="font-size:0.82rem;color:var(--text-2);margin-top:2px;">Podés proponer tu vehículo a cambio</div>
              </div>
              <button class="btn btn-primary" style="white-space:nowrap;" onclick="openTradeModal(${vehicle.id})">Proponer permuta</button>
            </div>
          ` : ''}
          ${vehicle.accepts_financing && vehicle.status !== 'sold' ? `
            <div style="margin-top:0.75rem;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.22);border-radius:var(--radius-md);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div class="financing-card-copy">
                <div class="financing-card-title">
                  ${financingUsesPrestito ? `<img src="/logoprestito.png" alt="Prestito" class="financing-prestito-logo" loading="lazy">` : ''}
                  <span>${financingTitleText}</span>
                </div>
                <div style="font-size:0.82rem;color:var(--text-2);margin-top:2px;">${financingSubtitleText}</div>
              </div>
              <div class="financing-cta-buttons">
                ${financingPrimaryCtaHtml}
                ${financingSecondaryCtaHtml}
              </div>
            </div>
          ` : ''}

          ${isLoggedIn && !isOwner && vehicle.status === 'active' ? `
            <div class="marketplace-chat-box" style="margin-top:1.5rem;background:var(--dark-2);padding:1.5rem;border-radius:var(--radius-lg);border:1px solid var(--border);" id="chatBoxContainer">
              <div id="existingConvBanner" style="display:none;text-align:center;">
                <p style="margin-bottom:0.75rem;color:var(--text-secondary);">Ya consultaste sobre este vehículo</p>
                <button class="btn btn-primary" id="goToChatBtn" style="width:100%;">Ir al chat</button>
              </div>
              <div id="newMessageBox">
                <h4 style="margin-bottom:1rem;font-size:1.1rem;">Preguntar al vendedor</h4>
                <div class="quick-messages" style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
                  <button class="btn btn-ghost btn-sm" onclick="document.getElementById('quickMsgInput').value = '¿Sigue disponible?'">¿Sigue disponible?</button>
                  <button class="btn btn-ghost btn-sm" onclick="document.getElementById('quickMsgInput').value = '¿Cuál es el precio final?'">¿Precio final?</button>
                  <button class="btn btn-ghost btn-sm" onclick="document.getElementById('quickMsgInput').value = '¿Aceptas permutas?'">¿Permutas?</button>
                  ${vehicle.accepts_financing ? `<button class="btn btn-ghost btn-sm" onclick="document.getElementById('quickMsgInput').value = '¿Ofreces financiación?'">¿Financiación?</button>` : ''}
                </div>
                <div class="chat-input-row" style="display:flex;gap:0.5rem;">
                  <input type="text" id="quickMsgInput" placeholder="Envía un mensaje..." style="flex:1;">
                  <button class="btn btn-primary" onclick="handleQuickMessage(${vehicle.id})">Enviar</button>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="detail-actions-zone">
            <div class="detail-actions" style="margin-top:1.5rem;display:flex;gap:1rem;flex-direction:column;">
              <button class="btn btn-secondary share-btn" onclick="shareVehicle(${vehicle.id}, '${escapeHtml(vehicle.title).replace(/'/g, '&#39;')}', ${Number(vehicle.price || 0)}, ${Number(vehicle.price_original || 0)})"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right:0.5rem;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>Compartir</button>
              ${isAdminView ? `
                <button id="igPublishBtn" class="btn btn-secondary" onclick="publishVehicleToInstagram(${vehicle.id}, event)"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right:0.5rem;"><path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5a4.25 4.25 0 0 0 4.25 4.25h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5a4.25 4.25 0 0 0-4.25-4.25h-8.5zM17.5 6.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>Publicar en Instagram</button>
                <button class="btn btn-ghost" onclick="configureInstagramFromAdmin(event)">Config Instagram</button>
              ` : ''}
              ${isLoggedIn && (vehicle.status !== 'sold' || isFavorite) ? `<button id="detailFavBtn" class="btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}" onclick="toggleFavorite(${vehicle.id}, event)"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" style="margin-right:0.5rem;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>` : ''}
              ${isLoggedIn && !isOwner ? `<button class="btn btn-ghost" onclick="openReportModal(${vehicle.id})" style="color:var(--text-3);">Reportar esta publicación</button>` : ''}
              ${!isLoggedIn ? `<button class="btn btn-primary" style="width:100%" onclick="showSection('login')">Iniciar sesión para mejorar la experiencia</button>` : ''}
            </div>
          </div>
          ${isAdminView ? `
            <div class="admin-edit-outside">
              <button class="btn admin-edit-btn" onclick="openEditModal(${vehicle.id}, event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
                Editar
              </button>
            </div>
          ` : ''}
          </div>
          ${ownerLocationDisplay ? `
            <div class="detail-secondary-map">
              <div class="detail-map-section detail-map-section-secondary">
                <h4 style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--text-2);display:flex;align-items:center;gap:0.4rem;">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    Ubicacion: ${escapeHtml(ownerLocationDisplay)}
                  </h4>
                  <div id="vehicleMapSecondary" class="vehicle-map"></div>
                </div>
              </div>
            ` : ''}
      </div>
      </div>
      <div class="similar-vehicles-section" id="similarVehiclesSection">
        <h3 class="similar-title">Vehículos similares</h3>
        <div class="similar-vehicles-grid" id="similarVehiclesGrid">
          <div class="similar-loading">Cargando...</div>
        </div>
      </div>
    `;
    window._detailImages = images.map(img => img.url);
    if (currentVehicleId !== id) return;
    if (vehicle.city || ownerLocationAddress) initVehicleMap(vehicle.city, vehicle.province);
    loadSimilarVehicles(vehicle.id);

    // Check if user already has a conversation for this vehicle
    if (isLoggedIn && !isOwner) {
      try {
        const convRes = await request('/conversations');
        // Guard: user may have navigated away during await
        if (currentVehicleId !== id) return;
        const convs = convRes.conversations || convRes;
        const existing = convs.find(c => c.vehicle_id === vehicle.id);
        if (existing) {
          const banner = document.getElementById('existingConvBanner');
          const msgBox = document.getElementById('newMessageBox');
          if (banner && msgBox) {
            banner.style.display = 'block';
            msgBox.style.display = 'none';
            document.getElementById('goToChatBtn').onclick = () => {
              currentConversationId = existing.id;
              showSection('messages');
            };
          }
        }
      } catch {}
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// PUBLISH
async function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Error al comprimir la imagen')); return; }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg', lastModified: Date.now() });
          resolve({ file: compressedFile, preview: canvas.toDataURL('image/jpeg', quality) });
        }, 'image/jpeg', quality);
      };
      img.onerror = error => reject(error);
    };
  });
}

async function handleImageSelect(e) {
  const files = Array.from(e.target.files).slice(0, Math.max(0, MAX_VEHICLE_IMAGES - uploadedImages.length));
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressed = await compressImage(file, 1920, 1080, 0.8);
      uploadedImages.push({ file: compressed.file, preview: compressed.preview });
      renderImagePreviews();
    } catch {
      showToast('Error al procesar la imagen', 'error');
    }
  }
  e.target.value = '';
}

async function getUploadErrorMessage(res, fallback) {
  try {
    const data = await res.clone().json();
    if (data?.error) return data.error;
  } catch {}
  try {
    const text = (await res.text()).trim();
    if (text) return text;
  } catch {}
  return fallback;
}

async function uploadImages() {
  const urls = [];
  for (let i = 0; i < uploadedImages.length; i++) {
    const img = uploadedImages[i];
    if (img.url) { urls.push(img.url); continue; }
    const formData = new FormData();
    formData.append('image', img.file);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` }, body: formData });
    if (!res.ok) throw new Error(await getUploadErrorMessage(res, `Error al subir la imagen ${i + 1}`));
    const data = await res.json();
    urls.push(data.url);
  }
  return urls;
}

async function handleEditImageSelect(e) {
  const files = Array.from(e.target.files).slice(0, Math.max(0, MAX_VEHICLE_IMAGES - editUploadedImages.length));
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressed = await compressImage(file, 1920, 1080, 0.8);
      editUploadedImages.push({ file: compressed.file, preview: compressed.preview });
      renderEditImagePreviews();
    } catch {
      showToast('Error al procesar la imagen', 'error');
    }
  }
  e.target.value = '';
}

async function uploadEditImages() {
  const urls = [];
  for (let i = 0; i < editUploadedImages.length; i++) {
    const img = editUploadedImages[i];
    if (img.url) { urls.push(img.url); continue; }
    const formData = new FormData();
    formData.append('image', img.file);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` }, body: formData });
    if (!res.ok) throw new Error(await getUploadErrorMessage(res, `Error al subir la imagen ${i + 1}`));
    const data = await res.json();
    urls.push(data.url);
  }
  return urls;
}

function renderEditImagePreviews() {
  const container = document.getElementById('editImagePreview');
  if (!container) return;
  container.innerHTML = editUploadedImages.map((img, i) => `
    <div class="preview-item ${i === 0 ? 'primary' : ''}">
      <img src="${escapeHtml(img.preview || img.url || '')}" alt="" loading="lazy">
      <span class="preview-order-badge">${i + 1}</span>
      <button class="preview-remove" type="button" onclick="removeEditImage(${i})">&times;</button>
      <div class="preview-controls">
        <button class="preview-move" type="button" onclick="moveEditImage(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Mover antes" aria-label="Mover foto antes">&#8593;</button>
        <button class="preview-move" type="button" onclick="moveEditImage(${i}, 1)" ${i === editUploadedImages.length - 1 ? 'disabled' : ''} title="Mover después" aria-label="Mover foto después">&#8595;</button>
        <button class="preview-cover ${i === 0 ? 'active' : ''}" type="button" onclick="setEditCoverImage(${i})">Portada</button>
      </div>
    </div>
  `).join('');
}

function moveEditImage(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= editUploadedImages.length) return;
  const item = editUploadedImages.splice(index, 1)[0];
  editUploadedImages.splice(newIndex, 0, item);
  renderEditImagePreviews();
}

function setEditCoverImage(index) {
  if (index === 0) return;
  const item = editUploadedImages.splice(index, 1)[0];
  editUploadedImages.unshift(item);
  renderEditImagePreviews();
}

function removeEditImage(index) {
  editUploadedImages.splice(index, 1);
  renderEditImagePreviews();
}

function reorderUploadedImage(fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return false;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= uploadedImages.length || toIndex >= uploadedImages.length) return false;
  if (fromIndex === toIndex) return false;
  const item = uploadedImages.splice(fromIndex, 1)[0];
  uploadedImages.splice(toIndex, 0, item);
  renderImagePreviews();
  return true;
}

function clearPublishImageDragState(container) {
  if (container) {
    container.classList.remove('drag-sorting');
    container.querySelectorAll('.preview-item').forEach((item) => item.classList.remove('dragging', 'drop-target'));
  }
  publishImageDragSourceIndex = null;
  publishImageTouchDropIndex = null;
}

function setupPublishImageDragHandlers() {
  const container = document.getElementById('imagePreview');
  if (!container) return;
  const items = Array.from(container.querySelectorAll('.preview-item'));
  if (!items.length) {
    clearPublishImageDragState(container);
    return;
  }

  const resolvePreviewItem = (eventTarget) => eventTarget?.closest?.('.preview-item') || null;
  const isControlTarget = (eventTarget) => !!eventTarget?.closest?.('.preview-controls, .preview-remove');

  items.forEach((item) => {
    const index = Number(item.dataset.index);
    item.draggable = true;

    item.addEventListener('dragstart', (event) => {
      if (isControlTarget(event.target)) {
        event.preventDefault();
        return;
      }
      publishImageDragSourceIndex = index;
      item.classList.add('dragging');
      container.classList.add('drag-sorting');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try { event.dataTransfer.setData('text/plain', String(index)); } catch {}
      }
    });

    item.addEventListener('dragover', (event) => {
      event.preventDefault();
      const target = resolvePreviewItem(event.target);
      if (!target) return;
      container.querySelectorAll('.preview-item').forEach((preview) => preview.classList.remove('drop-target'));
      target.classList.add('drop-target');
    });

    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const target = resolvePreviewItem(event.target);
      if (!target) return;
      const toIndex = Number(target.dataset.index);
      reorderUploadedImage(publishImageDragSourceIndex, toIndex);
    });

    item.addEventListener('dragend', () => {
      clearPublishImageDragState(container);
    });

    item.addEventListener('touchstart', (event) => {
      if (isControlTarget(event.target)) return;
      publishImageDragSourceIndex = index;
      publishImageTouchDropIndex = index;
      item.classList.add('dragging');
      container.classList.add('drag-sorting');
    }, { passive: true });

    item.addEventListener('touchmove', (event) => {
      if (publishImageDragSourceIndex === null) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      event.preventDefault();
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest?.('#imagePreview .preview-item');
      if (!target) return;
      const toIndex = Number(target.dataset.index);
      publishImageTouchDropIndex = Number.isInteger(toIndex) ? toIndex : null;
      container.querySelectorAll('.preview-item').forEach((preview) => preview.classList.remove('drop-target'));
      target.classList.add('drop-target');
    }, { passive: false });

    item.addEventListener('touchend', () => {
      reorderUploadedImage(publishImageDragSourceIndex, publishImageTouchDropIndex);
      clearPublishImageDragState(container);
    });

    item.addEventListener('touchcancel', () => {
      clearPublishImageDragState(container);
    });
  });
}

function renderImagePreviews() {
  const container = document.getElementById('imagePreview');
  if (!container) return;
  container.innerHTML = uploadedImages.map((img, i) => `
    <div class="preview-item ${i === 0 ? 'primary' : ''}" data-index="${i}">
      <img src="${escapeHtml(img.preview || img.url || '')}" alt="" loading="lazy">
      <span class="preview-order-badge">${i + 1}</span>
      <button class="preview-remove" type="button" onclick="removeImage(${i})">&times;</button>
      <div class="preview-controls">
        <button class="preview-move" type="button" onclick="moveImage(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Mover antes" aria-label="Mover foto antes">&#8593;</button>
        <button class="preview-move" type="button" onclick="moveImage(${i}, 1)" ${i === uploadedImages.length - 1 ? 'disabled' : ''} title="Mover después" aria-label="Mover foto después">&#8595;</button>
        <button class="preview-cover ${i === 0 ? 'active' : ''}" type="button" onclick="setCoverImage(${i})">Portada</button>
      </div>
    </div>
  `).join('');
  setupPublishImageDragHandlers();
}

function moveImage(index, direction) {
  reorderUploadedImage(index, index + direction);
}

function setCoverImage(index) {
  if (index === 0) return; // already cover
  reorderUploadedImage(index, 0);
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

function resolvePublishValidationElement(fieldId) {
  if (fieldId === 'publishBrand') {
    const select = document.getElementById('publishBrand');
    return select?.parentElement?.querySelector('.brand-picker-trigger') || select || null;
  }
  return document.getElementById(fieldId);
}

function clearPublishValidationErrors() {
  const fieldIds = [
    'publishBrand',
    'publishModel',
    'publishYear',
    'publishPrice',
    'publishFuel',
    'publishTransmission',
    'publishProvince',
    'publishCity',
    'publishDescription',
    'imageUploadArea',
  ];
  fieldIds.forEach((fieldId) => {
    const el = resolvePublishValidationElement(fieldId);
    if (!el) return;
    el.classList.remove('publish-field-error', 'upload-error-shake');
  });
}

function markPublishValidationError(fieldId, options = {}) {
  const el = resolvePublishValidationElement(fieldId);
  if (!el) return;
  el.classList.add('publish-field-error');
  if (options.shake) {
    el.classList.add('upload-error-shake');
    setTimeout(() => el.classList.remove('upload-error-shake'), 700);
  }
}

function focusPublishValidationIssue(issue) {
  if (!issue) return;
  if (issue.anchorId) {
    scrollToPublishSection(issue.anchorId);
  }
  const el = resolvePublishValidationElement(issue.fieldId);
  if (!el || typeof el.focus !== 'function') return;
  setTimeout(() => {
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, 220);
}

async function handlePublish(e) {
  e.preventDefault();

  const province = document.getElementById('publishProvince').value;
  const city = document.getElementById('publishCity').value;
  const brand = document.getElementById('publishBrand').value;
  const model = document.getElementById('publishModel').value;
  const year = document.getElementById('publishYear').value;
  const price = getPriceInUSD('publish');
  const fuel = document.getElementById('publishFuel').value;
  const transmission = document.getElementById('publishTransmission').value;
  const description = document.getElementById('publishDescription').value.trim();

  clearPublishValidationErrors();
  const issues = [];
  if (!brand) issues.push({ fieldId: 'publishBrand', anchorId: 'publishStepVehicle' });
  if (!model) issues.push({ fieldId: 'publishModel', anchorId: 'publishStepVehicle' });
  if (!year) issues.push({ fieldId: 'publishYear', anchorId: 'publishStepVehicle' });
  if (!price || isNaN(price) || price <= 0) issues.push({ fieldId: 'publishPrice', anchorId: 'publishStepPrice' });
  if ((document.getElementById('publishCurrency')?.value || 'USD') === 'ARS' && !dolarRate?.venta) {
    issues.push({ fieldId: 'publishPrice', anchorId: 'publishStepPrice' });
  }
  if (!fuel) issues.push({ fieldId: 'publishFuel', anchorId: 'publishStepPrice' });
  if (!transmission) issues.push({ fieldId: 'publishTransmission', anchorId: 'publishStepPrice' });
  if (!province) issues.push({ fieldId: 'publishProvince', anchorId: 'publishStepPrice' });
  if (!city) issues.push({ fieldId: 'publishCity', anchorId: 'publishStepPrice' });
  if (!uploadedImages.length) issues.push({ fieldId: 'imageUploadArea', anchorId: 'publishStepPhotos', shake: true });
  if (!description) issues.push({ fieldId: 'publishDescription', anchorId: 'publishStepDescription' });

  if (issues.length) {
    issues.forEach((issue) => markPublishValidationError(issue.fieldId, { shake: !!issue.shake }));
    focusPublishValidationIssue(issues[0]);
    showToast('Completa los campos marcados para continuar', 'error');
    return;
  }

  // Publicar directamente sin paso de vista previa
  await _doPublish();
}

async function _doPublish() {
  const btn = document.getElementById('publishBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }
  try {
    const province = document.getElementById('publishProvince').value;
    const city = document.getElementById('publishCity').value;
    const publishVehicleType = document.getElementById('publishVehicleType')?.value || 'auto';
    const publishBodyType = document.getElementById('publishBodyType')?.value || '';

    const urls = await uploadImages();
    const publishCurrency = document.getElementById('publishCurrency')?.value || 'USD';
    const publishRawPrice = parseFloat(document.getElementById('publishPrice').value) || null;
    const publishPriceUSD = getPriceInUSD('publish');
    const publishFrozenArs = publishCurrency === 'ARS' ? publishRawPrice : (dolarRate?.venta ? Math.round(publishPriceUSD * dolarRate.venta) : null);
    const acceptsFinancing = document.getElementById('publishAcceptsFinancing')?.checked || false;
    const data = {
      title: document.getElementById('publishTitle').value,
      brand: document.getElementById('publishBrand').value,
      model: document.getElementById('publishModel').value,
      version: getVersionValue('publish'),
      year: document.getElementById('publishYear').value,
      price: publishPriceUSD,
      // Si se publicó en ARS, guardamos el monto ingresado para trazabilidad histórica.
      price_original: publishFrozenArs,
      price_currency: publishCurrency,
      transmission: document.getElementById('publishTransmission').value,
      mileage: document.getElementById('publishMileage').value || 0,
      fuel: document.getElementById('publishFuel').value,
      city: city,
      province: province,
      description: document.getElementById('publishDescription').value,
      accepts_trade: document.getElementById('publishAcceptsTrade').checked,
      accepts_financing: acceptsFinancing,
      financing_provider: acceptsFinancing
        ? (document.getElementById('publishFinancingProvider')?.value || 'prestito')
        : null,
      vehicle_type: publishVehicleType,
      body_type: publishVehicleType === 'auto' ? (publishBodyType || null) : null,
      drivetrain: normalizedDrivetrainValue(document.getElementById('publishDrivetrain')?.value) || null,
      engine_cc: document.getElementById('publishEngineCC')?.value ? parseInt(document.getElementById('publishEngineCC').value) : null,
      contact_phone: document.getElementById('publishContactPhone')?.value?.trim() || null,
      contact_address: document.getElementById('publishContactAddress')?.value?.trim() || null,
      images: urls
    };
    const createdVehicle = await request('/vehicles', { method: 'POST', body: JSON.stringify(data) });
    if (acceptsFinancing && createdVehicle && !Object.prototype.hasOwnProperty.call(createdVehicle, 'financing_provider')) {
      showToast('No se guardo el tipo de financiacion. Ejecuta la migracion add-financing-provider-to-vehicles.sql', 'error');
    }
    showToast('¡Vehículo publicado!', 'success');
    resetPublishForm();
    showSection('my-vehicles');
  } catch (err) { showToast(err.message, 'error'); }
  finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publicar Vehículo'; }
  }
}

// MY VEHICLES
async function loadMyVehicles(page = 1) {
  try {
    const response = await request(`/my-vehicles?page=${page}&limit=12`);
    const vehicles = Array.isArray(response) ? response : (response.vehicles || []);
    myVehiclesHasMore = Array.isArray(response) ? false : !!response.has_more;
    myVehiclesPage = page;

    const vehicleStats = await request('/my-vehicles/stats').catch(() => []);
    const statsMap = Object.fromEntries((vehicleStats || []).map(s => [String(s.id), s]));
    const container = document.getElementById('myVehiclesList');
    const moreWrap = document.getElementById('myVehiclesMoreWrap');
    const moreBtn = document.getElementById('myVehiclesMoreBtn');
    if (!container) return;

    if (page === 1) {
      const stats = await request('/stats').catch(() => null);
      const dashboard = document.getElementById('statsDashboard');
      if (dashboard) dashboard.innerHTML = stats ? `
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg></div><div class="stat-meta"><div class="number">${stats.vehicles_count}</div><div class="label">Vehículos</div></div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/></svg></div><div class="stat-meta"><div class="number">${stats.total_views}</div><div class="label">Vistas totales</div></div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></div><div class="stat-meta"><div class="number">${stats.conversations_count}</div><div class="label">Conversaciones</div></div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div><div class="stat-meta"><div class="number">${stats.favorites_count}</div><div class="label">Favoritos</div></div></div>
    ` : '';

      if (!vehicles?.length) {
        container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><h3>Sin publicaciones</h3><p>Publica tu primer vehículo</p></div>';
        if (moreWrap) moreWrap.style.display = 'none';
        return;
      }
    }

    const html = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <span class="vehicle-badge ${v.status === 'sold' ? 'badge-sold' : ''}">${v.status === 'active' ? 'Activo' : v.status === 'sold' ? 'VENDIDO' : v.status === 'paused' ? 'Pausado' : v.status}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          <div class="vehicle-mini-stats">
            <span title="Vistas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(statsMap[String(v.id)]?.view_count || v.view_count || 0)}</span>
            <span title="Guardados"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${(statsMap[String(v.id)]?.favorites_count || 0)}</span>
            <span title="Consultas"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${(statsMap[String(v.id)]?.messages_count || 0)}</span>
          </div>
          <div class="my-vehicle-actions">
            <select class="my-vehicle-status-select" onclick="event.stopPropagation()" onchange="changeVehicleStatus(${v.id}, this.value, this)">
              <option value="active" ${v.status === 'active' ? 'selected' : ''}>Activo</option>
              <option value="reserved" ${v.status === 'reserved' ? 'selected' : ''}>Reservado</option>
              <option value="sold" ${v.status === 'sold' ? 'selected' : ''}>Vendido</option>
              <option value="paused" ${v.status === 'paused' ? 'selected' : ''}>Pausado</option>
            </select>
            <button class="btn btn-secondary" onclick="openEditModal(${v.id}, event)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>Editar</button>
            <button class="btn btn-danger" onclick="deleteVehicle(${v.id}, event)">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');

    if (page === 1) container.innerHTML = html;
    else container.insertAdjacentHTML('beforeend', html);

    applyCardCascade(container);
    if (page === 1) loadTradeOffers();

    if (moreWrap && moreBtn) {
      moreWrap.style.display = myVehiclesHasMore ? 'block' : 'none';
      moreBtn.disabled = false;
      moreBtn.textContent = 'Cargar más';
      moreBtn.onclick = () => {
        moreBtn.disabled = true;
        moreBtn.textContent = 'Cargando...';
        loadMyVehicles(myVehiclesPage + 1);
      };
    }
  } catch (err) { showToast(err.message, 'error'); }
}
async function changeVehicleStatus(id, status, selectEl) {
  const prev = selectEl.dataset.prev || selectEl.value;
  selectEl.dataset.prev = status;
  try {
    await request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast(`Estado actualizado: ${status === 'sold' ? 'Vendido' : status === 'reserved' ? 'Reservado' : status === 'paused' ? 'Pausado' : 'Activo'}`, 'success');
    // Actualizar badge visible en la tarjeta
    const badge = selectEl.closest('.vehicle-card')?.querySelector('.vehicle-badge');
    if (badge) {
      badge.className = `vehicle-badge${status === 'sold' ? ' badge-sold' : ''}`;
      badge.textContent = status === 'active' ? 'Activo' : status === 'sold' ? 'VENDIDO' : status === 'paused' ? 'Pausado' : 'Reservado';
    }
  } catch (err) {
    selectEl.value = prev;
    showToast(err.message || 'Error al actualizar', 'error');
  }
}

function deleteVehicle(id, e) {
  e.stopPropagation();
  showConfirmModal('Eliminar vehículo', 'Esta acción no se puede deshacer. Se eliminarán todas las imágenes, conversaciones y favoritos asociados.', 'Eliminar', async () => {
    try { await request(`/vehicles/${id}`, { method: 'DELETE' }); showToast('Eliminado', 'success'); loadMyVehicles(); } catch (err) { showToast(err.message, 'error'); }
  });
}

async function openEditModal(id, e) {
  if (e?.stopPropagation) e.stopPropagation();
  try {
    const v = await request(`/vehicles/${id}`);
    const canEdit = !!currentUser && (String(currentUser.id) === String(v.user_id) || !!currentUser.profile?.is_admin);
    if (!canEdit) {
      showToast('No tenés permisos para editar esta publicación', 'error');
      return;
    }
    editUploadedImages = (v.vehicle_images?.length ? v.vehicle_images : (v.image_url ? [{ url: v.image_url }] : []))
      .map(img => ({ url: img.url, preview: img.url }));
    document.getElementById('editVehicleId').value = v.id;
    document.getElementById('editTitle').value = v.title || '';
    // Vehicle type (top)
    const editTypeTopEl = document.getElementById('editVehicleTypeTop');
    if (editTypeTopEl) editTypeTopEl.value = v.vehicle_type || 'auto';
    // Populate brands from local data and set vehicle's brand
    const _vType = v.vehicle_type || 'auto';
    const _brandsObj = getBrandsForType(_vType);
    const editBrandEl = document.getElementById('editBrand');
    if (editBrandEl) {
      editBrandEl.innerHTML = '<option value="">Seleccionar marca</option>';
      sortedBrandKeys(_brandsObj, _vType).forEach(brand => {
        const opt = document.createElement('option');
        opt.value = brand; opt.textContent = brand;
        editBrandEl.appendChild(opt);
      });
      editBrandEl.value = v.brand || '';
      initBrandPicker('editBrand');
    }
    // Populate models from local data and set vehicle's model
    const editModelEl = document.getElementById('editModel');
    if (editModelEl) {
      const _models = (v.brand && _brandsObj[v.brand]) ? _brandsObj[v.brand] : [];
      populateSelect(editModelEl, _models, 'Seleccionar modelo');
      editModelEl.value = v.model || '';
    }
    const editBodyTypeEl = document.getElementById('editBodyType');
    if (editBodyTypeEl) editBodyTypeEl.value = v.body_type || '';
    toggleBodyTypeField('edit');
    const editDrivetrainEl = document.getElementById('editDrivetrain');
    if (editDrivetrainEl) editDrivetrainEl.value = normalizedDrivetrainValue(v.drivetrain);
    toggleDrivetrainField('edit');
    initYearSelect('editYear', v.year);
    // Populate versions from local versionsData and set vehicle's version
    const editVersionSel = document.getElementById('editVersion');
    if (editVersionSel) {
      const _versions = versionsData[v.brand]?.[v.model] || [];
      populateSelect(editVersionSel, _versions, 'Seleccionar versión');
      editVersionSel.disabled = !v.brand || !v.model;
      if (v.version) {
        if (![...editVersionSel.options].some(o => o.value === v.version)) {
          const opt = document.createElement('option'); opt.value = v.version; opt.textContent = v.version; editVersionSel.appendChild(opt);
        }
        editVersionSel.value = v.version;
      }
    }
    toggleEngineCCField('edit');
    updateEditTitle();
    const editCurrencyEl = document.getElementById('editCurrency');
    const editPriceEl = document.getElementById('editPrice');
    if (editCurrencyEl && editPriceEl) {
      const vehicleCurrency = v.price_currency || 'USD';
      editCurrencyEl.value = vehicleCurrency;
      editCurrencyEl.dataset.prev = vehicleCurrency;
      if (vehicleCurrency === 'ARS' && v.price_original) {
        editPriceEl.value = v.price_original;
      } else {
        editPriceEl.value = v.price || '';
      }
      syncPriceBaseUSD('edit');
      updatePriceHint('edit');
    }
    document.getElementById('editMileage').value = v.mileage || '';
    document.getElementById('editFuel').value = v.fuel || '';
    document.getElementById('editTransmission').value = v.transmission || '';
    const editProvSelect = document.getElementById('editProvince');
    const editCitySelect = document.getElementById('editCity');
    editProvSelect.value = v.province || '';
    editProvSelect.dispatchEvent(new Event('change'));
    requestAnimationFrame(() => {
      if (editCitySelect) editCitySelect.value = v.city || '';
    });
    document.getElementById('editStatus').value = v.status || 'active';
    // Description: pre-fill but don't mark as user-edited so auto-gen can run
    const editDescEl = document.getElementById('editDescription');
    editDescEl.value = v.description || '';
    editDescEl.dataset.userEdited = 'true'; // existing desc = user content, don't overwrite
    editDescEl.removeEventListener('input', markEditDescriptionEdited);
    editDescEl.addEventListener('input', markEditDescriptionEdited);
    document.getElementById('editAcceptsTrade').checked = !!v.accepts_trade;
    const editFinancingEl = document.getElementById('editAcceptsFinancing');
    if (editFinancingEl) editFinancingEl.checked = !!v.accepts_financing;
    const editFinancingProviderEl = document.getElementById('editFinancingProvider');
    if (editFinancingProviderEl) {
      editFinancingProviderEl.value = String(v.financing_provider || 'prestito').toLowerCase() === 'propia'
        ? 'propia'
        : 'prestito';
    }
    toggleFinancingProviderField('edit');
    const editCCEl = document.getElementById('editEngineCC');
    if (editCCEl) editCCEl.value = v.engine_cc || '';
    toggleEngineCCField('edit');
    const editPhoneGroup = document.getElementById('editContactPhoneGroup');
    if (editPhoneGroup) editPhoneGroup.style.display = currentUser?.profile?.is_admin ? 'block' : 'none';
    const editAddressGroup = document.getElementById('editContactAddressGroup');
    if (editAddressGroup) editAddressGroup.style.display = currentUser?.profile?.is_admin ? 'block' : 'none';
    const editPhoneEl = document.getElementById('editContactPhone');
    if (editPhoneEl) editPhoneEl.value = v.contact_phone || '';
    const editAddressEl = document.getElementById('editContactAddress');
    if (editAddressEl) editAddressEl.value = v.contact_address || '';
    const editImageInput = document.getElementById('editImageInput');
    if (editImageInput) editImageInput.value = '';
    renderEditImagePreviews();
    openAccessibleModal('editVehicleModal', { initialFocusSelector: '#editBrand' });
  } catch (err) { showToast(err.message, 'error'); }
}

function closeEditModal() {
  closeAccessibleModal('editVehicleModal');
  const editCur = document.getElementById('editCurrency');
  if (editCur) { editCur.value = 'USD'; editCur.dataset.prev = 'USD'; }
  const editDrive = document.getElementById('editDrivetrain');
  if (editDrive) editDrive.value = '';
  const editHint = document.getElementById('editPriceHint');
  if (editHint) editHint.textContent = '';
  editUploadedImages = [];
  const editImageInput = document.getElementById('editImageInput');
  if (editImageInput) editImageInput.value = '';
  const editPreview = document.getElementById('editImagePreview');
  if (editPreview) editPreview.innerHTML = '';
}

async function handleEditVehicle(e) {
  e.preventDefault();
  const btn = document.getElementById('editVehicleBtn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  const id = document.getElementById('editVehicleId').value;
  try {
    const province = document.getElementById('editProvince').value;
    const city = document.getElementById('editCity').value;
    if (!province || !city) {
      showToast('Seleccioná la provincia y la ciudad', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
      return;
    }
    if ((document.getElementById('editCurrency')?.value || 'USD') === 'ARS' && !dolarRate?.venta) {
      showToast('No se pudo obtener la cotizacion del dolar para convertir ARS a USD', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
      return;
    }
    const editBrand = document.getElementById('editBrand')?.value || '';
    const editModel = document.getElementById('editModel')?.value || '';
    const editYear  = document.getElementById('editYear')?.value || '';
    const editVersion = getVersionValue('edit');
    const editVehicleType = document.getElementById('editVehicleTypeTop')?.value || 'auto';
    const editBodyType = document.getElementById('editBodyType')?.value || '';
    const editAcceptsFinancing = document.getElementById('editAcceptsFinancing')?.checked || false;
    const editCurrency = document.getElementById('editCurrency')?.value || 'USD';
    const editRawPrice = parseFloat(document.getElementById('editPrice').value) || null;
    const editPriceUSD = getPriceInUSD('edit');
    const editFrozenArs = editCurrency === 'ARS' ? editRawPrice : (dolarRate?.venta ? Math.round(editPriceUSD * dolarRate.venta) : null);
    if (!editUploadedImages.length) {
      showToast('Debe quedar al menos una foto', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar cambios';
      return;
    }
    const editImageUrls = await uploadEditImages();
    const autoTitle = `${editBrand} ${editModel} ${editVersion} ${editYear}`.replace(/\s+/g, ' ').trim();
    const updatedVehicle = await request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: autoTitle,
        brand: editBrand,
        model: editModel,
        year: editYear,
        version: editVersion,
        price: editPriceUSD,
        price_original: editFrozenArs,
        price_currency: editCurrency,
        mileage: document.getElementById('editMileage').value,
        fuel: document.getElementById('editFuel').value,
        transmission: document.getElementById('editTransmission').value,
        city: city,
        province: province,
        status: document.getElementById('editStatus').value,
        description: document.getElementById('editDescription').value,
        accepts_trade: document.getElementById('editAcceptsTrade').checked,
        accepts_financing: editAcceptsFinancing,
        financing_provider: editAcceptsFinancing
          ? (document.getElementById('editFinancingProvider')?.value || 'prestito')
          : null,
        vehicle_type: editVehicleType,
        body_type: editVehicleType === 'auto' ? (editBodyType || null) : null,
        drivetrain: normalizedDrivetrainValue(document.getElementById('editDrivetrain')?.value) || null,
        engine_cc: document.getElementById('editEngineCC')?.value ? parseInt(document.getElementById('editEngineCC').value) : null,
        contact_phone: document.getElementById('editContactPhone')?.value?.trim() || null,
        contact_address: document.getElementById('editContactAddress')?.value?.trim() || null,
        images: editImageUrls
      })
    });
    if (editAcceptsFinancing && updatedVehicle && !Object.prototype.hasOwnProperty.call(updatedVehicle, 'financing_provider')) {
      showToast('No se guardo el tipo de financiacion. Ejecuta la migracion add-financing-provider-to-vehicles.sql', 'error');
    }
    showToast('¡Publicación actualizada!', 'success');
    closeEditModal();
    if (String(currentVehicleId) === String(id)) {
      viewVehicle(Number(id));
    }
    loadMyVehicles();
  } catch (err) { showToast(err.message, 'error'); }
  btn.disabled = false;
  btn.textContent = 'Guardar cambios';
}

// FAVORITES
async function loadFavorites() {
  try {
    const vehicles = await request('/favorites');
    const container = document.getElementById('favoritesList');
    if (!vehicles?.length) { container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><h3>Sin favoritos</h3><p>Agrega vehículos a tus favoritos</p></div>'; return; }
    container.innerHTML = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.[0]?.url || v.image_url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          ${v.status === 'sold' ? '<div class="sold-overlay"><span>VENDIDO</span></div>' : ''}
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:0.5rem;color:var(--text-3);width:100%;" onclick="toggleFavorite(${v.id}, event);this.closest('.vehicle-card').remove()">Eliminar de favoritos</button>
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleFavorite(id, e) {
  if (e) e.stopPropagation();
  if (!getAuthToken()) { showToast('Inicia sesión para agregar favoritos', 'error'); return; }
  try {
    const res = await request(`/favorites/${id}`, { method: 'POST' });
    showToast(res.favorited ? 'Agregado a favoritos' : 'Eliminado de favoritos', 'success');

    // Update global favorites set
    if (res.favorited) {
      userFavoriteIds.add(id);
    } else {
      userFavoriteIds.delete(id);
    }

    // Update all heart buttons for this vehicle in the listing (without re-rendering)
    document.querySelectorAll(`.favorite-btn[data-vehicle-id="${id}"]`).forEach(btn => {
      btn.classList.toggle('active', res.favorited);
    });

    // Update the favorite button in the detail view if open
    const detailFavBtn = document.getElementById('detailFavBtn');
    if (detailFavBtn) {
      detailFavBtn.className = `btn ${res.favorited ? 'btn-primary' : 'btn-secondary'}`;
      const svgPath = detailFavBtn.querySelector('svg path');
      if (svgPath) svgPath.setAttribute('fill', res.favorited ? 'currentColor' : 'none');
      // Update text node (last child after SVG)
      const textNode = [...detailFavBtn.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = res.favorited ? 'En favoritos' : 'Guardar en favoritos';
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// CONTACT / CONVERSATIONS
async function handleQuickMessage(vehicleId) {
  if (!getAuthToken()) {
    showToast('Iniciá sesión para escribir mensajes', 'warning');
    showSection('login');
    return;
  }
  const input = document.getElementById('quickMsgInput');
  const msg = input.value.trim();
  if (!msg) return;
  try {
    const conv = await request('/conversations', { method: 'POST', body: JSON.stringify({ vehicle_id: vehicleId, initial_message: msg }) });
    showToast('Mensaje enviado', 'success');
    currentConversationId = conv.id;
    showSection('messages');
  } catch (err) { showToast(err.message, 'error'); }
}

let conversationsPage = 1;
async function loadConversations(page = 1) {
  if (!getAuthToken()) {
    showToast('Iniciá sesión para ver tus conversaciones', 'warning');
    showSection('login');
    return;
  }
  try {
    const res = await request(`/conversations?page=${page}`);
    const conversations = res.conversations || res;
    const total = res.total || conversations.length;
    const container = document.getElementById('conversationsListContent');
    if (page === 1 && !conversations?.length) {
      container.innerHTML = `<div class="empty-state" style="padding: 2rem; text-align: center;">
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3; margin-bottom: 1rem;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
  <h3 style="margin-bottom: 0.5rem; font-size: 1rem;">Sin conversaciones aún</h3>
  <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Cuando contactes a un vendedor, el chat aparecerá aquí.</p>
  <button class="btn btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1.25rem;" onclick="showSection('vehicles')">Explorar vehículos</button>
</div>`;
      renderEmptyChat(); return;
    }
    const html = conversations.map(c => `
      <div class="conversation-item ${String(currentConversationId) === String(c.id) ? 'active' : ''}" data-conv-id="${c.id}" onclick="openConversation(${c.id}, this)">
        <div class="conversation-avatar">${c.other_user?.avatar_url ? `<img src="${escapeHtml(c.other_user.avatar_url || '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (c.other_user?.username ? c.other_user.username.charAt(0).toUpperCase() : '?')}</div>
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.other_user?.username || 'Usuario')}</div>
          <div class="conversation-vehicle">${escapeHtml(c.vehicle?.title || '')}</div>
          <div class="conversation-preview">${(() => { const text = c.last_message?.startsWith('__TRADE_CARD__') ? 'Propuesta de permuta' : (c.last_message || ''); const prefix = c.last_message_sender_id === currentUser?.id ? 'Tú: ' : ''; return escapeHtml(prefix + text); })()}</div>
        </div>
        <div class="conversation-meta" style="display:flex;flex-direction:column;align-items:flex-end;">
          <span class="conversation-time">${formatRelTime(c.updated_at)}</span>
          ${c.unread_count > 0 ? `<div style="background:#ef4444;color:#fff;font-size:0.75rem;font-weight:800;border-radius:99px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;margin-top:0.3rem;padding:0 5px;">${c.unread_count}</div>` : ''}
        </div>
      </div>
    `).join('');
    if (page === 1) container.innerHTML = html; else { const old = container.querySelector('.load-more-btn'); if (old) old.remove(); container.insertAdjacentHTML('beforeend', html); }
    conversationsPage = page;
    if (total > page * 100) {
      container.insertAdjacentHTML('beforeend', `<button class="btn btn-ghost btn-sm load-more-btn" style="width:100%;margin-top:0.5rem;" onclick="loadConversations(${page + 1})">Cargar más</button>`);
    }
    if (page === 1) { if (currentConversationId) loadChatFull(currentConversationId); else renderEmptyChat(); }
  } catch (err) {
    const container = document.getElementById('conversationsListContent');
    if (container && page === 1) {
      container.innerHTML = `
        <div class="empty-state" style="padding:1.5rem;text-align:center;">
          <h3 style="margin-bottom:0.5rem;font-size:1rem;">No pudimos cargar tus chats</h3>
          <p style="color:var(--text-2);font-size:0.9rem;margin-bottom:0.9rem;">Reintenta en unos segundos.</p>
          <button class="btn btn-secondary btn-sm" onclick="loadConversations(1)">Reintentar</button>
        </div>
      `;
      renderEmptyChat();
    }
    showToast(err.message || 'No se pudieron cargar las conversaciones', 'error');
  }
}

async function openConversation(convId, el) {
  currentConversationId = convId;
  lastMessageId = 0;
  pollCount = 0;
  document.querySelectorAll('.conversation-item').forEach(e => e.classList.remove('active'));
  // BUG-19: use only the passed `el` parameter; do not reference the global `event`
  const target = el || null;
  if (target) {
    target.classList.add('active');
    // Clear unread badge immediately on open
    target.querySelector('[style*="background:#ef4444"]')?.remove();
  }
  openMobileChat();
  await loadChatFull(convId);
  startPolling();
}

async function loadChatFull(convId) {
  lastMessageId = 0;
  pollCount = 0;
  try {
    isLoadingMessages = true;
    const [conv, messagesData] = await Promise.all([
      request(`/conversations/${convId}`),
      request(`/conversations/${convId}/messages`)
    ]);
    const { messages, read_receipts } = messagesData;

    const otherUser = conv.buyer_id === currentUser?.id ? conv.seller : conv.buyer;
    // BUG-15: assign so online_status WS events can be matched to the right user
    currentChatOtherUserId = otherUser?.id || null;
    const vehicle = conv.vehicle;
    const chatView = document.getElementById('chatView');

    // Build read_at lookup from receipts
    const readMap = {};
    (read_receipts || []).forEach(r => { readMap[r.id] = r.read_at; });
    // Also use read_at from messages themselves
    (messages || []).forEach(m => { if (m.read_at) readMap[m.id] = m.read_at; });

    const vehicleImg = vehicle?.image_url || PLACEHOLDER_IMG;

    chatView.innerHTML = `
      <div class="chat-active-header">
        <button class="chat-back-btn" style="display:none;align-items:center;background:none;border:none;color:var(--text);cursor:pointer;padding:0.25rem;margin-right:0.5rem;font-size:1.3rem;" onclick="closeMobileChat()">&#8249;</button>
        <div class="conversation-avatar">${otherUser?.avatar_url ? `<img src="${escapeHtml(otherUser.avatar_url || '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (otherUser?.username ? otherUser.username.charAt(0).toUpperCase() : '?')}</div>
        <div class="chat-header-info">
          <h4 style="cursor:pointer;" onclick="viewProfile(${otherUser?.id})" title="Ver perfil">${escapeHtml(otherUser?.username || 'Usuario')}</h4>
          <span id="chatOnlineStatus" style="color:var(--text-secondary);font-size:0.8rem;transition:color 0.3s;font-weight:600;">Calculando...</span>
        </div>

        ${vehicle ? `
        <div class="chat-vehicle-ref-inline" onclick="viewVehicle(${vehicle.id})" title="Ver publicación">
          <img src="${escapeHtml(vehicleImg)}" onerror="this.src=PLACEHOLDER_IMG" alt="" loading="lazy">
          <div class="chat-vehicle-ref-inline-info">
            <div class="chat-vehicle-ref-title">${escapeHtml(vehicle.title || (vehicle.brand + ' ' + vehicle.model))}</div>
            <div class="chat-vehicle-ref-price">$${formatNumber(vehicle.price)}</div>
          </div>
          <span class="chat-vehicle-ref-arrow">›</span>
        </div>
        ` : ''}

        ${conv.buyer_id === currentUser?.id ? `<button class="chat-header-btn" onclick="openRateModal(${convId}, ${otherUser?.id}, ${vehicle?.id || 'null'})" title="Calificar">★</button>` : ''}
      </div>

      <div class="chat-messages-container" id="chatMessagesContainer"></div>
      <div class="chat-input-container"><input type="text" id="chatMessageInput" placeholder="Escribe un mensaje..." onkeypress="if(event.key==='Enter')sendMessage()"><button class="btn btn-primary" onclick="sendMessage()"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>
    `;

    // Render all messages
    (messages || []).forEach(m => appendMessageToDOM(m, readMap[m.id]));
    lastMessageId = messages?.length ? messages[messages.length - 1].id : 0;

    updateOnlineStatus(otherUser);
    scrollChat();
    updateTradeCardStatuses();

    // Mark messages as read (fire-and-forget)
    request(`/conversations/${convId}/read`, { method: 'PUT' }).catch(() => {});
  } catch (err) { showToast(err.message, 'error'); }
  finally { isLoadingMessages = false; }
}

async function pollNewMessages(convId) {
  if (isLoadingMessages || convId !== currentConversationId) return;
  isLoadingMessages = true;
  try {
    const { messages, read_receipts } = await request(`/conversations/${convId}/messages?after=${lastMessageId}`);

    // Guard: conversation may have changed during await
    if (convId !== currentConversationId) return;

    // Update read receipts on existing sent messages
    if (read_receipts?.length) updateReadReceipts(read_receipts);

    if (messages?.length) {
      const isAtBottom = hasUserScrolledToBottom();
      const incoming = messages.filter(m => m.sender_id !== currentUser?.id);

      messages.forEach(m => appendMessageToDOM(m, m.read_at));
      lastMessageId = messages[messages.length - 1].id;

      if (isAtBottom) scrollChat();

      // Mark new incoming messages as read
      if (incoming.length > 0) {
        request(`/conversations/${convId}/read`, { method: 'PUT' }).catch(() => {});
        loadUnreadMessageCount();
      }
      // Update conversation preview in list
      const lastMsg = messages[messages.length - 1];
      const activeItem = document.querySelector(`.conversation-item.active`);
      if (activeItem && lastMsg) {
        const preview = activeItem.querySelector('.conversation-preview');
        if (preview) preview.textContent = lastMsg.content?.startsWith('__TRADE_CARD__') ? 'Propuesta de permuta' : (lastMsg.content || '');
        const timeEl = activeItem.querySelector('.conversation-time');
        if (timeEl) timeEl.textContent = 'Ahora';
      }

      chatNoMessageStreak = 0;
    } else {
      chatNoMessageStreak++;
    }

  } catch {}

  // Update online status every ~15 seconds (every 5 polls)
  pollCount++;
  if (pollCount % 5 === 0) {
    try {
      const conv = await request(`/conversations/${convId}`);
      const otherUser = conv.buyer_id === currentUser?.id ? conv.seller : conv.buyer;
      updateOnlineStatus(otherUser);
    } catch {}
  }
  isLoadingMessages = false;
}

function appendMessageToDOM(message, readAt) {
  const container = document.getElementById('chatMessagesContainer');
  if (!container) return;
  // Skip if already rendered
  if (container.querySelector(`[data-message-id="${message.id}"]`)) return;

  const isSent = message.sender_id === currentUser?.id;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;
  bubble.dataset.messageId = message.id;

  let html = '';
  if (!isSent) html += `<div class="sender">${escapeHtml(message.username)}</div>`;

  // Detectar mensaje de permuta
  if (message.content?.startsWith('__TRADE_CARD__')) {
    const raw = message.content.slice('__TRADE_CARD__'.length);
    const firstNewline = raw.indexOf('\n');
    const jsonPart = firstNewline === -1 ? raw : raw.slice(0, firstNewline);
    const extraText = firstNewline === -1 ? '' : raw.slice(firstNewline + 1).trim();
    try {
      const v = JSON.parse(jsonPart);
      const toPositiveInt = (value) => {
        const rawValue = String(value ?? '').trim();
        if (!/^\d+$/.test(rawValue)) return null;
        const parsed = Number(rawValue);
        return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
      };
      const currentUserId = toPositiveInt(currentUser?.id);
      const ownerId = toPositiveInt(v.owner_id);
      const vehicleId = toPositiveInt(v.id);
      const offerId = toPositiveInt(v.offer_id);
      const isOwner = ownerId !== null && currentUserId !== null && ownerId === currentUserId;
      const safePrice = Number(v.price);
      const priceLabel = Number.isFinite(safePrice) ? formatNumber(Math.round(safePrice)) : '0';
      const provinceLabel = String(v.province || '').replace(/\s*\(.*?\)/g, '').trim();
      const viewAction = vehicleId ? `viewVehicle(${vehicleId})` : 'void 0';
      html += `
        <div class="trade-card" data-offer-id="${offerId || ''}" onclick="event.target.closest('button') || ${viewAction}">
          <div class="trade-card-badge">🔄 Propuesta de permuta</div>
          <div class="trade-card-img">
            <img src="${escapeHtml(v.image) || PLACEHOLDER_IMG}" onerror="this.src=PLACEHOLDER_IMG" alt="${escapeHtml(v.title)}" loading="lazy">
          </div>
          <div class="trade-card-body">
            <div class="trade-card-title">${escapeHtml(v.title)}</div>
            <div class="trade-card-sub">${escapeHtml(v.brand)} ${escapeHtml(v.model)} · ${escapeHtml(String(v.year))}</div>
            <div class="trade-card-price">$${priceLabel}</div>
            ${v.city ? `<div class="trade-card-location"> ${escapeHtml(v.city)}${provinceLabel ? ', ' + escapeHtml(provinceLabel) : ''}</div>` : ''}
            ${isOwner && offerId ? `
            <div class="trade-card-actions" id="trade-actions-${offerId}">
              <button class="btn btn-primary btn-sm" style="margin-right:0.4rem;" onclick="respondToTradeInChat(${offerId}, 'accepted')">✅ Aceptar</button>
              <button class="btn btn-danger btn-sm" onclick="respondToTradeInChat(${offerId}, 'rejected')">❌ Rechazar</button>
            </div>` : ''}
          </div>
        </div>`;
      if (extraText) html += `<div class="content" style="margin-top:0.5rem;">${escapeHtml(extraText)}</div>`;
    } catch {
      html += `<div class="content" style="color:var(--text-3);">[Propuesta de permuta no disponible]</div>`;
    }
  } else {
    html += `<div class="content">${escapeHtml(message.content)}</div>`;
  }

  html += `<div class="time">${formatTime(message.created_at)}`;
  if (isSent && readAt) {
    html += ` <span class="read-receipt">Visto ${formatHourMinute(readAt)}</span>`;
  }
  html += `</div>`;

  bubble.innerHTML = html;
  container.appendChild(bubble);
}

function updateReadReceipts(receipts) {
  receipts.forEach(r => {
    if (!r.read_at) return;
    const bubble = document.querySelector(`[data-message-id="${r.id}"] .time`);
    if (bubble && !bubble.querySelector('.read-receipt')) {
      const span = document.createElement('span');
      span.className = 'read-receipt';
      span.textContent = `Visto ${formatHourMinute(r.read_at)}`;
      bubble.appendChild(span);
    }
  });
}

function updateOnlineStatus(otherUser) {
  const el = document.getElementById('chatOnlineStatus');
  if (!el) return;
  if (otherUser?.is_online) {
    el.textContent = 'En línea';
    el.style.color = 'var(--success)';
  } else if (otherUser?.last_seen) {
    el.textContent = 'Últ. vez: ' + formatRelTime(otherUser.last_seen);
    el.style.color = 'var(--text-secondary)';
  } else {
    el.textContent = 'Desconectado';
    el.style.color = 'var(--text-secondary)';
  }
}

function formatHourMinute(d) {
  return new Date(d).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

async function sendMessage() {
  const input = document.getElementById('chatMessageInput');
  const sendBtn = input?.parentElement?.querySelector('button');
  const content = input?.value.trim();
  if (!content || !currentConversationId) return;
  input.value = '';
  if (sendBtn) sendBtn.disabled = true;

  // Show message immediately (optimistic)
  const optimisticId = 'opt-' + Date.now();
  appendMessageToDOM({ id: optimisticId, content, sender_id: currentUser.id, username: currentUser.username, created_at: new Date().toISOString() }, null);
  scrollChat();

  try {
    const message = await request(`/conversations/${currentConversationId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
    // Replace optimistic bubble with real message
    document.querySelector(`[data-message-id="${optimisticId}"]`)?.remove();
    appendMessageToDOM(message, null);
    lastMessageId = message.id;
    scrollChat();
    // Update conversation preview in list
    const activeItem = document.querySelector(`.conversation-item.active`);
    if (activeItem) {
      const preview = activeItem.querySelector('.conversation-preview');
      if (preview) preview.textContent = 'Tú: ' + content;
      const timeEl = activeItem.querySelector('.conversation-time');
      if (timeEl) timeEl.textContent = 'Ahora';
      // Move to top of list
      const list = activeItem.parentElement;
      if (list && list.firstChild !== activeItem) list.prepend(activeItem);
    }
  } catch (err) {
    document.querySelector(`[data-message-id="${optimisticId}"]`)?.remove();
    showToast(err.message, 'error');
    if (input) input.value = content;
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function openMobileChat() {
  document.querySelector('.messages-container')?.classList.add('chat-open');
}
function closeMobileChat() {
  document.querySelector('.messages-container')?.classList.remove('chat-open');
  currentConversationId = null;
  stopPolling();
}

function renderEmptyChat() {
  document.getElementById('chatView').innerHTML = '<div class="chat-empty"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg><p>Selecciona una conversación</p></div>';
}

function scrollChat() { setTimeout(() => { const c = document.getElementById('chatMessagesContainer'); if (c) c.scrollTop = c.scrollHeight; }, 100); }
let chatPollTimeout = null;
let chatNoMessageStreak = 0;

// ─── WebSocket ───────────────────────────────────────────────────────────────

function wsSend(msg) {
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

function initWebSocket() {
  if (!currentUser) return;
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) return;
  const token = getAuthToken();
  if (!token) return;

  clearTimeout(wsReconnectTimeout);
  clearTimeout(wsFallbackTimeout);
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;

  wsConnection = new WebSocket(url);

  wsConnection.onopen = function () {
    wsConnected = true;
    wsReconnectAttempts = 0;
    wsReconnectDelay = 1000;
    stopPolling();
    if (currentConversationId) {
      wsSend({ type: 'join_conversation', payload: { conversationId: currentConversationId } });
    }
  };

  wsConnection.onmessage = function (event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handleWsEvent(msg);
  };

  wsConnection.onclose = function () {
    wsConnected = false;
    wsConnection = null;
    if (!currentUser) return;
    wsReconnectAttempts++;
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
    const jitter = Math.random() * 1000;
    wsReconnectTimeout = setTimeout(initWebSocket, wsReconnectDelay + jitter);
    // Fallback: si llevamos 2+ intentos fallidos y hay chat abierto, activar polling
    if (wsReconnectAttempts >= 2 && currentConversationId) {
      startFallbackPolling();
    }
  };

  wsConnection.onerror = function () { /* onclose se dispara solo */ };

  // BUG-14: use wsFallbackTimeout so it doesn't overwrite wsReconnectTimeout
  wsFallbackTimeout = setTimeout(function () {
    if (!wsConnected && currentConversationId) {
      startFallbackPolling();
    }
  }, 5000);
}

function destroyWebSocket() {
  clearTimeout(wsReconnectTimeout);
  wsReconnectTimeout = null;
  clearTimeout(wsFallbackTimeout);
  wsFallbackTimeout = null;
  wsReconnectAttempts = 0;
  wsReconnectDelay = 1000;
  if (wsConnection) {
    wsConnection.onclose = null;
    wsConnection.close();
    wsConnection = null;
  }
  wsConnected = false;
}

function handleWsEvent(msg) {
  const { type, payload } = msg;

  if (type === 'pong') return;

  if (type === 'new_message') {
    const { conversationId, message } = payload;
    if (String(conversationId) !== String(currentConversationId)) {
      // Mensaje en otra conversación — actualizar lista si está visible
      refreshConversationBadge(conversationId);
      return;
    }
    // Deduplicar
    if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
    if (message.id <= lastMessageId) return;
    const container = document.getElementById('chatMessagesContainer');
    const isAtBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight < 80) : true;
    appendMessageToDOM(message, message.read_at);
    lastMessageId = message.id;
    if (isAtBottom) scrollChat();
    // Si es mensaje entrante, marcar como leído con debounce
    if (String(message.sender_id) !== String(currentUser?.id)) {
      scheduleReadReceipt(conversationId);
      refreshConversationItem(conversationId, message);
    }
    return;
  }

  if (type === 'read_receipt') {
    const { conversationId, readAt, readByUserId } = payload;
    if (String(conversationId) !== String(currentConversationId)) return;
    if (String(readByUserId) === String(currentUser?.id)) return;
    // Actualizar todos los bubbles enviados sin receipt
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;
    container.querySelectorAll('.chat-bubble.sent').forEach(bubble => {
      const timeEl = bubble.querySelector('.time');
      if (timeEl && !timeEl.dataset.receipted) {
        timeEl.dataset.receipted = '1';
        const span = document.createElement('span');
        span.className = 'read-receipt';
        span.textContent = ` · Visto ${formatTime(readAt)}`;
        span.style.cssText = 'opacity:0.7;font-size:0.75em;';
        timeEl.appendChild(span);
      }
    });
    return;
  }

  if (type === 'user_typing') {
    const { conversationId, username } = payload;
    if (String(conversationId) !== String(currentConversationId)) return;
    showTypingIndicator(username);
    return;
  }

  if (type === 'user_stopped_typing') {
    const { conversationId } = payload;
    if (String(conversationId) !== String(currentConversationId)) return;
    hideTypingIndicator();
    return;
  }

  if (type === 'online_status') {
    const { userId, isOnline } = payload;
    if (!currentChatOtherUserId || String(userId) !== String(currentChatOtherUserId)) return;
    const statusEl = document.getElementById('chatOnlineStatus');
    if (!statusEl) return;
    statusEl.textContent = isOnline ? 'En línea' : 'Desconectado';
    statusEl.style.color = isOnline ? 'var(--success, #22c55e)' : 'var(--text-muted)';
    return;
  }

  if (type === 'unread_count_update') {
    // Re-fetch el count real en lugar de usar delta (más preciso)
    loadUnreadMessageCount && loadUnreadMessageCount();
    return;
  }

  if (type === 'notification') {
    // Incrementar badge en tiempo real
    const badge = document.getElementById('notificationsBadge');
    if (badge) {
      const current = parseInt(badge.textContent) || 0;
      badge.textContent = current + 1;
      badge.style.display = 'inline';
    }
    // Si la sección está abierta, recargar la lista
    const notifSection = document.getElementById('notifications');
    if (notifSection && notifSection.style.display === 'block') {
      loadNotifications();
    }
    return;
  }
}

function scheduleReadReceipt(conversationId) {
  clearTimeout(wsReadReceiptDebounce);
  wsReadReceiptDebounce = setTimeout(() => {
    request(`/conversations/${conversationId}/read`, { method: 'PUT' }).catch(() => {});
  }, 2000);
}

function refreshConversationBadge(_conversationId) {
  // Actualizar badge de unread en la lista de conversaciones
  loadUnreadMessageCount && loadUnreadMessageCount();
}

function refreshConversationItem(conversationId, message) {
  // Actualizar el preview del último mensaje en la lista de conversaciones
  const item = document.querySelector(`.conversation-item[data-conv-id="${conversationId}"]`);
  if (!item) return;
  const preview = item.querySelector('.conv-preview, .last-message, .message-preview');
  if (preview) preview.textContent = message.content || '';
}

function startFallbackPolling() {
  if (wsConnected) return;
  stopPolling();
  if (currentConversationId) schedulePoll();
}

// Typing indicator UI
function showTypingIndicator(username) {
  const el = document.getElementById('typingIndicator');
  if (!el) return;
  el.textContent = `${escapeHtml(username)} está escribiendo...`;
  el.style.display = 'block';
  clearTimeout(el._hideTimeout);
  el._hideTimeout = setTimeout(hideTypingIndicator, 5000);
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.style.display = 'none';
}

function onChatInputTyping() {
  if (!wsConnected || !currentConversationId) return;
  if (!isTyping) {
    isTyping = true;
    wsSend({ type: 'typing_start', payload: { conversationId: currentConversationId } });
  }
  clearTimeout(wsTypingTimeout);
  wsTypingTimeout = setTimeout(() => {
    isTyping = false;
    wsSend({ type: 'typing_stop', payload: { conversationId: currentConversationId } });
  }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────

function schedulePoll() {
  clearTimeout(chatPollTimeout);
  if (!currentConversationId) return;
  const delay = chatNoMessageStreak >= 5
    ? Math.min(6000 * Math.pow(1.3, chatNoMessageStreak - 5), 15000)
    : 6000;
  chatPollTimeout = setTimeout(async () => {
    if (currentConversationId) {
      await pollNewMessages(currentConversationId);
    }
    schedulePoll();
  }, delay);
}

function startPolling() {
  stopPolling();
  chatNoMessageStreak = 0;
  schedulePoll();
}
function stopPolling() {
  if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  clearTimeout(chatPollTimeout);
  chatPollTimeout = null;
  // BUG-15: reset other-user reference when chat is no longer active
  currentChatOtherUserId = null;
}

function hasUserScrolledToBottom() {
  const c = document.getElementById('chatMessagesContainer');
  if(!c) return true;
  // If user is within 50px of the bottom, consider them at the bottom
  return c.scrollHeight - c.scrollTop - c.clientHeight < 50;
}

// Pause polling when tab is not visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    stopPolling();
  } else if (document.visibilityState === 'visible' && currentConversationId) {
    // Resume polling and do an immediate poll
    pollNewMessages(currentConversationId);
    startPolling();
  }
});

// HEARTBEAT
let heartbeatInterval = setInterval(() => {
  if (currentUser && document.visibilityState === 'visible') {
    request('/ping', { method: 'PUT' }).catch(() => {});
  }
}, 60000);

// NOTIFICATIONS
const NOTIF_ICONS = {
  message:       `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
  trade_offer:   `<svg viewBox="0 0 24 24"><path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/></svg>`,
  trade_accepted:`<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
  trade_rejected:`<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  follow:        `<svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  new_vehicle:   `<svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>`,
  rating:        `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
  favorite_sold: `<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  admin_contact_request: `<svg viewBox="0 0 24 24"><path d="M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4zm-1 11l6-6-1.41-1.41L11 9.17 8.41 6.59 7 8l4 4z"/></svg>`,
};
function notifIcon(type) {
  const svg = NOTIF_ICONS[type] || `<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
  const colors = { message:'#60a5fa', trade_offer:'#f59e0b', trade_accepted:'#22c55e', trade_rejected:'#ef4444', follow:'#a78bfa', new_vehicle:'#f59e0b', rating:'#facc15', favorite_sold:'#ef4444', admin_contact_request:'#38bdf8' };
  const bg = colors[type] || 'var(--text-3)';
  return `<div class="notification-icon" style="background:${bg}22;color:${bg};">${svg}</div>`;
}

let notificationsOffset = 0;
let notificationsTotal = 0;

async function loadNotifications(offset = 0) {
  try {
    if (offset === 0) {
      notificationsOffset = 0;
    }
    const { notifications, total } = await request(`/notifications?offset=${offset}`);
    notificationsTotal = total;
    const container = document.getElementById('notificationsList');
    if (offset === 0) {
      if (!notifications?.length) { container.innerHTML = '<div class="empty-state"><p>Sin notificaciones</p></div>'; return; }
      container.innerHTML = '';
    } else {
      container.querySelector('.load-more-notif-btn')?.remove();
    }
    notifications.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = `notification-item ${n.read ? '' : 'unread'} cascade-item`;
      el.style.animationDelay = `${i * 60}ms`;
      el.dataset.link = n.link || '';
      el.dataset.notifId = n.id;
      el.onclick = () => handleNotificationClick(el.dataset.link, el.dataset.notifId);
      el.innerHTML = `${notifIcon(n.type)}<div class="notification-content"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.message)}</p><div class="notification-time">${formatRelTime(n.created_at)}</div></div>`;
      container.appendChild(el);
    });
    notificationsOffset = offset + notifications.length;
    if (notificationsOffset < notificationsTotal) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm load-more-notif-btn';
      btn.style.cssText = 'width:100%;margin-top:0.5rem;';
      btn.textContent = `Cargar más (${notificationsTotal - notificationsOffset} restantes)`;
      btn.onclick = () => loadNotifications(notificationsOffset);
      container.appendChild(btn);
    }
  } catch (err) {
    const container = document.getElementById('notificationsList');
    if (container && offset === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:1.5rem;text-align:center;">
          <h3 style="margin-bottom:0.5rem;font-size:1rem;">No pudimos cargar notificaciones</h3>
          <p style="color:var(--text-2);font-size:0.9rem;margin-bottom:0.9rem;">Verifica tu conexión e intenta de nuevo.</p>
          <button class="btn btn-secondary btn-sm" onclick="loadNotifications(0)">Reintentar</button>
        </div>
      `;
    }
    showToast(err.message || 'No se pudieron cargar las notificaciones', 'error');
  }
}

async function loadNotificationCount() {
  try {
    const ignoreQuery = currentConversationId ? `?ignoreChat=${currentConversationId}` : '';
    const { count } = await request(`/notifications/count${ignoreQuery}`);
    const badge = document.getElementById('notificationsBadge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
  } catch {}
}

async function handleNotificationClick(link, id) {
  request(`/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
  loadNotificationCount();
  if (link.includes('messages/')) {
    const convId = parseInt(link.split('/').pop(), 10);
    currentConversationId = convId;
    lastMessageId = 0;
    pollCount = 0;
    // currentConversationId set BEFORE showSection so that loadConversations
    // (triggered by showSection) picks it up and opens the correct chat
    showSection('messages');
    startPolling();
  } else if (link.includes('vehicle/')) {
    viewVehicle(link.split('/').pop());
  } else if (link.includes('profile/')) {
    viewProfile(link.split('/').pop());
  } else if (link === 'trade-offers') {
    showSection('my-vehicles');
  } else if (link === 'admin/contact-requests') {
    if (currentUser?.profile?.is_admin) {
      adminPreferredTab = 'contact-requests';
      showSection('admin');
    }
  }
}

async function markAllRead() {
  try { await request('/notifications/read-all', { method: 'PUT' }); loadNotifications(); loadNotificationCount(); showToast('Notificaciones marcadas como leídas', 'success'); } catch (err) { showToast(err.message, 'error'); }
}

// PROFILE
async function viewProfile(id) {
  currentProfileId = id;
  const isOwn = currentUser && String(currentUser.id) === String(id);
  const profileForm = document.getElementById('profileForm');
  if (profileForm) profileForm.innerHTML = ''; // Limpiar form de edición
  try {
    const profile = await request(`/profile/${id}`);
    const ratings = await request(`/ratings/${id}`);
    let completenessHtml = '';
    if (isOwn) {
      const fields = [
        { name: 'Nombre', done: !!profile.username },
        { name: 'Foto', done: !!profile.avatar_url },
        { name: 'Teléfono', done: !!profile.phone },
        { name: 'Ciudad', done: !!profile.city },
        { name: 'Bio', done: !!profile.bio }
      ];
      const completed = fields.filter(f => f.done).length;
      const pct = Math.round((completed / fields.length) * 100);
      if (pct < 100) {
        completenessHtml = `
        <div class="profile-completeness">
          <div class="profile-completeness-header">
            <h4>Completá tu perfil</h4>
            <span class="pct-badge">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="checklist">
            ${fields.map(f => `
              <div class="checklist-item ${f.done ? 'done' : 'pending'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  ${f.done ? '<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>' : '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>'}
                </svg>
                ${f.name}
              </div>
            `).join('')}
          </div>
        </div>`;
      } else if (!profile.profile_complete_seen) {
        request('/profile/complete-seen', { method: 'PUT' }).catch(() => {});
        completenessHtml = `
        <div class="profile-completeness" style="border-color:rgba(34,197,94,0.3);background:rgba(34,197,94,0.06);">
          <div style="display:flex;align-items:center;gap:0.75rem;">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#4ade80"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
            <div>
              <div style="font-weight:700;color:#4ade80;">¡Perfil completo!</div>
              <div style="font-size:0.82rem;color:var(--text-2);">Tu perfil tiene toda la información.</div>
            </div>
            <span class="pct-badge" style="margin-left:auto;">100%</span>
          </div>
        </div>`;
      }
    }
    const canFollow = !isOwn && !!getAuthToken();
    const canEditProfile = isOwn || !!currentUser?.profile?.is_admin;
    const cityMeta = AR_CITIES.find(c => c.city === profile.city);
    const profileProvince = cityMeta ? String(cityMeta.prov || '').replace(/\s*\(.*?\)/g, '').trim() : '';
    const profileCity = cityMeta ? String(profile.city || '').trim() : '';
    const profileStreet = String(
      profile.dealership_address || (!cityMeta ? (profile.city || '') : '')
    ).trim();
    const profileLocationText = [profileStreet, profileCity, profileProvince].filter(Boolean).join(', ');
    const profileLocationDisplay = profileLocationText || String(profile.city || '').trim();
    const profileMapsQuery = profileLocationText || [profileCity, profileProvince].filter(Boolean).join(', ');
    const profileMapsUrl = profile.is_verified && profileMapsQuery ? googleMapsSearchUrl(profileMapsQuery) : '';
    const fullName = [profile.first_name, profile.last_name]
      .map(v => String(v || '').trim())
      .filter(Boolean)
      .join(' ');
    const showDealershipName = !!(profile.is_verified && profile.dealership_name);
    const profileTitle = showDealershipName ? profile.dealership_name : (fullName || profile.username);
    
    // Header content
    let headerHtml = `
      ${completenessHtml}
      <div class="profile-header">
        <div class="profile-avatar-wrapper">
          <div class="profile-avatar">
            ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url || '')}" alt="" loading="lazy">` : (profile.first_name || profile.username)?.charAt(0).toUpperCase()}
          </div>
        </div>

        <h2>${escapeHtml(profileTitle)}</h2>
        ${showDealershipName && fullName ? `<p class="profile-owner-name">${escapeHtml(fullName)}</p>` : ''}
        ${profile.is_verified ? verifiedImageBadge('verified-image-badge-profile') : ''}
        
        ${profile.rating ? `
          <div class="rating">
            ${'★'.repeat(Math.round(profile.rating))}${'☆'.repeat(5-Math.round(profile.rating))} 
            <span>(${profile.ratings_count} reseñas)</span>
          </div>
        ` : '<p style="color:var(--text-3); margin-top:0.5rem;">Sin reseñas aún</p>'}
        
        ${profileLocationDisplay ? `
          <div class="profile-location">
            <span class="profile-location-text">${escapeHtml(profileLocationDisplay)}</span>
          </div>
        ` : ''}
        
        ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
        
        <div class="profile-actions-grid">
          ${profileMapsUrl ? `
            <a href="${escapeHtml(profileMapsUrl)}" target="_blank" rel="noopener" class="profile-action-btn location">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              Ver ubicación
            </a>
          ` : ''}
          ${profile.instagram ? `
            <a href="${escapeHtml(instagramUrl(profile.instagram))}" target="_blank" rel="noopener" class="profile-action-btn instagram">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> 
              Instagram
            </a>
          ` : ''}
          ${profile.phone && profile.show_phone !== false ? `
            <a href="https://wa.me/${escapeHtml(profile.phone.replace(/[\\s\\-\\(\\)]/g,'').replace(/^\\+/,''))}" target="_blank" rel="noopener" class="profile-action-btn whatsapp">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> 
              WhatsApp
            </a>
          ` : ''}
          ${canEditProfile ? `
            <button class="profile-action-btn" onclick="showSection('profile'); editProfile(${id})">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              Editar perfil
            </button>
          ` : ''}
          ${canFollow ? `
            <button id="followBtn" class="profile-action-btn ${profile.is_following ? 'btn-secondary' : 'btn-primary'}" onclick="toggleFollow(${id})">
              ${profile.is_following ? 'Dejar de seguir' : '+ Seguir'}
            </button>
          ` : ''}
        </div>
        
        <div class="profile-stats-grid">
          <div class="profile-stat-item">
            <span class="profile-stat-value">${profile.vehicles_count || 0}</span>
            <span class="profile-stat-label">Vehículos</span>
          </div>
          <div class="profile-stat-item">
            <span class="profile-stat-value" id="followersCount">${profile.followers_count || 0}</span>
            <span class="profile-stat-label">Seguidores</span>
          </div>
          <div class="profile-stat-item">
            <span class="profile-stat-value">${profile.following_count || 0}</span>
            <span class="profile-stat-label">Siguiendo</span>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('profileHeader').innerHTML = headerHtml;
    const isViewerAdmin = !!currentUser?.profile?.is_admin;
    const profileVehiclesList = document.getElementById('profileVehiclesList');
    const profileVehiclesMoreWrap = document.getElementById('profileVehiclesMoreWrap');
    const profileVehiclesMoreBtn = document.getElementById('profileVehiclesMoreBtn');
    profileVehiclesPage = 1;
    profileVehiclesHasMore = false;
    profileVehiclesUserId = String(id);

    const renderProfileVehicles = (list, append = false) => {
      const html = list.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <div class="vehicle-img-overlay"></div>
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${buildVehicleStatusBadges(v, { compact: true })}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)" aria-label="Agregar a favoritos"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          ${buildVehicleMetaHtml(v)}
          ${isViewerAdmin && !isOwn ? `<button class="btn btn-sm btn-danger" style="margin-top:0.5rem;width:100%;" data-vid="${v.id}" data-title="${escapeHtml(v.title)}" onclick="event.stopPropagation(); adminDeleteVehicle(+this.dataset.vid, this.dataset.title)">Eliminar</button>` : ''}
        </div>
      </div>
    `).join('');

      if (!append) profileVehiclesList.innerHTML = html;
      else profileVehiclesList.insertAdjacentHTML('beforeend', html);
      applyCardCascade(profileVehiclesList);
    };

    const loadProfileVehiclesPage = async (page = 1) => {
      const resp = await request(`/vehicles?user_id=${id}&page=${page}&limit=12`).catch(() => ({ vehicles: [], total: 0 }));
      if (profileVehiclesUserId !== String(id)) return;

      const list = resp?.vehicles || [];
      const total = Number(resp?.total || 0);
      profileVehiclesPage = page;
      profileVehiclesHasMore = (page * 12) < total;

      if (page === 1 && !list.length) {
        profileVehiclesList.innerHTML = '<p style="color:var(--text-secondary)">Sin vehículos publicados</p>';
      } else if (list.length) {
        renderProfileVehicles(list, page > 1);
      }

      if (profileVehiclesMoreWrap && profileVehiclesMoreBtn) {
        profileVehiclesMoreWrap.style.display = profileVehiclesHasMore ? 'block' : 'none';
        profileVehiclesMoreBtn.disabled = false;
        profileVehiclesMoreBtn.textContent = 'Cargar más publicaciones';
      }
    };

    await loadProfileVehiclesPage(1);
    if (profileVehiclesMoreBtn) {
      profileVehiclesMoreBtn.onclick = async () => {
        if (!profileVehiclesHasMore || profileVehiclesUserId !== String(id)) return;
        profileVehiclesMoreBtn.disabled = true;
        profileVehiclesMoreBtn.textContent = 'Cargando...';
        await loadProfileVehiclesPage(profileVehiclesPage + 1);
      };
    }
    document.getElementById('profileReviewsList').innerHTML = ratings?.length ? ratings.map(r => `
      <div class="review-item"><div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div><div class="author">${escapeHtml(r.from_user?.username)} - ${formatRelTime(r.created_at)}</div>${r.review ? `<div class="text">${escapeHtml(r.review)}</div>` : ''}</div>
    `).join('') : '<p style="color:var(--text-secondary)">Sin reseñas</p>';
    showSection('profile');
  } catch (err) { showToast(err.message, 'error'); }
}

async function editProfile(targetUserId = null) {
  if (!currentUser) return;
  pendingAvatarFile = null;

  const normalizedTarget = targetUserId ? parseInt(targetUserId, 10) : currentUser.id;
  const isAdminEditingOther = !!currentUser?.profile?.is_admin && normalizedTarget && String(normalizedTarget) !== String(currentUser.id);

  let sourceUser = { ...currentUser };
  let sourceProfile = { ...(currentUser.profile || {}) };

  if (isAdminEditingOther) {
    const data = await request(`/admin/users/${normalizedTarget}/profile`);
    sourceUser = {
      id: data.id,
      username: data.username,
      email: data.email
    };
    sourceProfile = { ...(data.profile || {}) };
  }

  editProfileTarget = {
    userId: sourceUser.id,
    isAdminEditingOther
  };

  const titleEl = document.querySelector('#editProfileModal .modal-header h3');
  if (titleEl) {
    titleEl.textContent = isAdminEditingOther
      ? `Editar perfil de @${sourceUser.username || sourceUser.id}`
      : 'Editar perfil';
  }

  document.getElementById('editProfileModalBody').innerHTML = `
    <form onsubmit="saveProfile(event)" style="padding:0.25rem 0;">
      <div class="form-group" style="margin-bottom:1rem;">
        <label>Foto de perfil</label>
        <div style="display:flex;align-items:center;gap:1rem;">
          <div class="profile-avatar" style="width:60px;height:60px;margin:0;" id="editAvatarPreview">${sourceProfile?.avatar_url ? `<img src="${sourceProfile.avatar_url}" loading="lazy">` : (sourceUser.username || '').charAt(0).toUpperCase()}</div>
          <input type="file" id="editAvatarFile" accept="image/*" onchange="previewProfileImage(event)" style="flex:1;">
        </div>
        <input type="hidden" id="editAvatarBase64" value="${sourceProfile?.avatar_url || ''}">
      </div>
      <div class="form-group"><label for="editUsername">Nombre de usuario</label><input type="text" id="editUsername" value="${escapeHtml(sourceUser.username || '')}" placeholder="tunombre" minlength="3"></div>
      <div class="form-group">
        <label for="editPhone">Teléfono / WhatsApp</label>
        <input type="tel" id="editPhone" value="${escapeHtml(sourceProfile?.phone || '')}" placeholder="+54...">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
          <input type="checkbox" id="editShowPhone" ${sourceProfile?.show_phone !== false ? 'checked' : ''} style="width:auto;margin:0;">
          <label for="editShowPhone" style="margin:0;font-size:0.88rem;color:var(--text-secondary);cursor:pointer;">Mostrar botón de WhatsApp en perfil y publicaciones</label>
        </div>
      </div>
      <div class="form-group"><label for="editProfileProvince">Provincia</label><select id="editProfileProvince" onchange="onEditProfileProvinceChange()"><option value="">Seleccioná una provincia</option>${AR_PROVINCES.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}</select></div>
      <div class="form-group"><label for="editProfileCity">Ciudad</label><select id="editProfileCity"><option value="">Seleccioná una ciudad</option></select></div>
      <div class="form-group"><label for="editBio">Bio</label><textarea id="editBio" rows="3" placeholder="Cuéntanos sobre ti...">${escapeHtml(sourceProfile?.bio || '')}</textarea></div>
      ${sourceProfile?.is_verified ? `
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
          <h4 style="font-size:0.95rem;margin-bottom:0.75rem;color:var(--primary);">Datos de concesionaria (verificado)</h4>
          <div class="form-group"><label>Nombre de la concesionaria</label><input type="text" id="editDealershipName" value="${escapeHtml(sourceProfile?.dealership_name || '')}" placeholder="Ej: Autos Premium SRL"></div>
          <div class="form-group"><label>Dirección de la concesionaria</label><input type="text" id="editDealershipAddress" value="${escapeHtml(sourceProfile?.dealership_address || '')}" placeholder="Ej: Av. Libertador 1234, CABA"></div>
          <div class="form-group"><label>Instagram</label><input type="text" id="editInstagram" value="${escapeHtml(sourceProfile?.instagram || '')}" placeholder="https://instagram.com/tuconcesionaria"><small style="color:var(--text-secondary);font-size:0.78rem;">Pegá el enlace completo de Instagram</small></div>
        </div>
      ` : ''}
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem;">
        <button type="button" class="btn btn-ghost" style="flex:1;" onclick="closeEditProfileModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" style="flex:2;">Guardar</button>
      </div>
    </form>
  `;
  openAccessibleModal('editProfileModal', { initialFocusSelector: '#editUsername' });
  setTimeout(() => initEditProfileCity(sourceProfile?.city || ''), 0);
}

function closeEditProfileModal() {
  closeAccessibleModal('editProfileModal');
  const titleEl = document.querySelector('#editProfileModal .modal-header h3');
  if (titleEl) titleEl.textContent = 'Editar perfil';
  editProfileTarget = null;
}

function onEditProfileProvinceChange() {
  const prov = document.getElementById('editProfileProvince')?.value;
  const cityEl = document.getElementById('editProfileCity');
  if (!cityEl) return;
  const cities = AR_CITIES.filter(c => c.prov === prov);
  cityEl.innerHTML = '<option value="">Seleccioná una ciudad</option>' +
    cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join('');
}

function initEditProfileCity(savedCity = '') {
  if (!savedCity) return;
  const match = AR_CITIES.find(c => c.city === savedCity);
  if (!match) return;
  const provEl = document.getElementById('editProfileProvince');
  const cityEl = document.getElementById('editProfileCity');
  if (!provEl || !cityEl) return;
  provEl.value = match.prov;
  onEditProfileProvinceChange();
  cityEl.value = savedCity;
}

let pendingAvatarFile = null;

function previewProfileImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('editAvatarPreview').innerHTML = `<img src="${evt.target.result}">`;
  };
  reader.readAsDataURL(file);
  pendingAvatarFile = file;
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const targetId = editProfileTarget?.userId || currentUser?.id;
    const adminEditingOther = !!editProfileTarget?.isAdminEditingOther && String(targetId) !== String(currentUser?.id);
    const endpoint = adminEditingOther ? `/admin/users/${targetId}/profile` : '/profile';
    const fallbackUsername = adminEditingOther
      ? (document.getElementById('editUsername')?.defaultValue || currentUser?.username || '')
      : currentUser?.username;

    let avatarUrl = document.getElementById('editAvatarBase64').value; // valor previo (si existe)

    if (pendingAvatarFile) {
      showToast('Optimizando foto de perfil...', 'info');
      const compressed = await compressImage(pendingAvatarFile, 800, 800, 0.85);
      const formData = new FormData();
      formData.append('image', compressed.file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        body: formData
      });
      if (!res.ok) throw new Error(await getUploadErrorMessage(res, 'Error al subir la imagen de perfil'));
      const data = await res.json();
      avatarUrl = data.url;
      pendingAvatarFile = null;
    }

    await request(endpoint, { method: 'PUT', body: JSON.stringify({
      username: document.getElementById('editUsername')?.value?.trim() || fallbackUsername,
      phone: document.getElementById('editPhone').value,
      show_phone: document.getElementById('editShowPhone')?.checked ?? true,
      city: document.getElementById('editProfileCity')?.value || '',
      bio: document.getElementById('editBio').value,
      avatar_url: avatarUrl,
      dealership_name: document.getElementById('editDealershipName')?.value ?? '',
      dealership_address: document.getElementById('editDealershipAddress')?.value ?? '',
      instagram: document.getElementById('editInstagram')?.value ?? '',
    }) });

    showToast(adminEditingOther ? 'Perfil actualizado (admin)' : 'Perfil actualizado', 'success');
    closeEditProfileModal();
    if (adminEditingOther) {
      if (currentProfileId && String(currentProfileId) === String(targetId)) {
        viewProfile(currentProfileId);
      }
      const adminSection = document.getElementById('admin');
      if (adminSection && adminSection.style.display !== 'none') {
        loadAdminUsers();
      }
    } else {
      currentUser = await request('/user');
      updateNav();
      if (currentProfileId) viewProfile(currentProfileId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ADMIN
let adminPreferredTab = null;

function renderAdminStats(stats = {}) {
  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat"><div class="number">${stats.users || 0}</div><div class="label">Usuarios</div></div>
    <div class="admin-stat"><div class="number">${stats.vehicles || 0}</div><div class="label">Vehículos</div></div>
    <div class="admin-stat"><div class="number">${stats.active_vehicles || 0}</div><div class="label">Activos</div></div>
    <div class="admin-stat"><div class="number">${stats.pending_reports || 0}</div><div class="label">Reportes pendientes</div></div>
    <div class="admin-stat"><div class="number">${stats.pending_admin_contact_requests || 0}</div><div class="label">Consultas pendientes</div></div>
  `;
}

async function refreshAdminStats() {
  const stats = await request('/admin/stats');
  renderAdminStats(stats || {});
}

async function loadAdmin() {
  try {
    await refreshAdminStats();
    const nextTab = adminPreferredTab || 'reports';
    adminPreferredTab = null;
    showAdminTab(nextTab);
  } catch (err) { showToast(err.message, 'error'); }
}

function showAdminTab(tab, el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  (el || document.querySelector(`.admin-tab[onclick*="'${tab}'"]`))?.classList.add('active');
  if (tab === 'reports') loadAdminReports();
  else if (tab === 'contact-requests') loadAdminContactRequests();
  else if (tab === 'users') loadAdminUsers();
  else if (tab === 'vehicles') loadAdminVehicles(1);
}

async function loadAdminReports() {
  try {
    const reports = await request('/admin/reports');
    document.getElementById('adminContent').innerHTML = reports?.length ? `
      <div class="table-responsive">
        <table class="admin-table"><thead><tr><th>Fecha</th><th>Vehículo</th><th>Reportado por</th><th>Razón</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
          ${reports.map(r => `
            <tr>
              <td>${formatRelTime(r.created_at)}</td>
              <td><a href="#" onclick="viewVehicle(${r.vehicle?.id})">${escapeHtml(r.vehicle?.title || 'N/A')}</a></td>
              <td>${escapeHtml(r.reporter?.username || 'N/A')}</td>
              <td>${escapeHtml(r.reason)}</td>
              <td><span style="color:${r.status === 'pending' ? 'var(--warning)' : 'var(--success)'}">${r.status}</span></td>
              <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                ${r.status === 'pending' ? `
                  <button class="btn btn-sm btn-secondary" onclick="resolveReport(${r.id}, 'resolved')">Resolver</button>
                  <button class="btn btn-sm btn-ghost" onclick="resolveReport(${r.id}, 'dismissed')">Descartar</button>
                ` : ''}
                ${r.vehicle?.id ? `
                  <button class="btn btn-sm btn-secondary" onclick="openEditModal(${r.vehicle.id}, event)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>Editar pub.</button>
                  <button class="btn btn-sm btn-danger" data-vid="${r.vehicle.id}" data-title="${escapeHtml(r.vehicle.title || '')}" onclick="adminDeleteVehicle(+this.dataset.vid, this.dataset.title)">🗑 Eliminar pub.</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody></table>
      </div>
    ` : '<p>Sin reportes</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadAdminContactRequests() {
  try {
    const requests = await request('/admin/contact-requests');
    document.getElementById('adminContent').innerHTML = requests?.length ? `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Motivo</th>
              <th>Contacto</th>
              <th>Usuario</th>
              <th>Detalle</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map((item) => `
              <tr>
                <td>${formatRelTime(item.created_at)}</td>
                <td>${escapeHtml(item.reason || '-')}</td>
                <td style="max-width:220px;word-break:break-word;">${escapeHtml(item.contact || '-')}</td>
                <td>${escapeHtml(item.requester?.username || item.requester?.email || 'Anónimo')}</td>
                <td style="max-width:280px;word-break:break-word;">${escapeHtml(item.message || '-')}</td>
                <td>
                  <span style="font-size:0.75rem;padding:2px 7px;border-radius:5px;font-weight:600;
                    background:${item.status === 'pending' ? 'rgba(245,158,11,0.12)' : item.status === 'resolved' ? 'rgba(34,197,94,0.12)' : item.status === 'dismissed' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)'};
                    color:${item.status === 'pending' ? '#f59e0b' : item.status === 'resolved' ? '#22c55e' : item.status === 'dismissed' ? '#ef4444' : '#60a5fa'};"
                  >${escapeHtml(item.status || 'pending')}</span>
                </td>
                <td style="display:flex;gap:0.35rem;flex-wrap:wrap;">
                  ${item.status !== 'resolved' ? `<button class="btn btn-sm btn-secondary" onclick="updateAdminContactRequestStatus(${item.id}, 'resolved')">Resolver</button>` : ''}
                  ${item.status !== 'reviewed' ? `<button class="btn btn-sm btn-ghost" onclick="updateAdminContactRequestStatus(${item.id}, 'reviewed')">Revisar</button>` : ''}
                  ${item.status !== 'dismissed' ? `<button class="btn btn-sm btn-danger" onclick="updateAdminContactRequestStatus(${item.id}, 'dismissed')">Descartar</button>` : ''}
                  ${item.status !== 'pending' ? `<button class="btn btn-sm btn-ghost" onclick="updateAdminContactRequestStatus(${item.id}, 'pending')">Reabrir</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<p>Sin consultas al administrador</p>';
  } catch (err) {
    showToast(err.message || 'No se pudieron cargar las consultas', 'error');
  }
}

async function updateAdminContactRequestStatus(id, status) {
  try {
    await request(`/admin/contact-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast('Consulta actualizada', 'success');
    loadAdminContactRequests();
    refreshAdminStats().catch(() => {});
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar la consulta', 'error');
  }
}

async function adminDeleteVehicle(id, title) {
  showConfirmModal(
    '¿Eliminar publicación?',
    `Se eliminará permanentemente "${title}" y todas sus imágenes y conversaciones. Esta acción no se puede deshacer.`,
    'Eliminar',
    async () => {
      try {
        const result = await request(`/vehicles/${id}`, { method: 'DELETE' });
        showToast('Publicación eliminada', 'success');
        if (result?.instagram_cleanup?.failed > 0) {
          showToast('La publicación web se eliminó, pero no se pudo borrar en Instagram (revisar permisos/token).', 'warning');
        }
        // Recargar la vista actual
        const profileSection = document.getElementById('profile');
        if (profileSection && profileSection.style.display !== 'none' && currentProfileId) {
          viewProfile(currentProfileId);
        } else {
          // Estamos en admin
          const activeTab = document.querySelector('.admin-tab.active');
          if (activeTab?.textContent?.includes('Vehículos')) loadAdminVehicles(adminVehiclesPage);
          else loadAdminReports();
        }
      } catch (err) { showToast(err.message, 'error'); }
    }
  );
}

let adminVehiclesPage = 1;
async function loadAdminVehicles(page = 1) {
  adminVehiclesPage = page;
  const searchVal = document.getElementById('adminVehicleSearch')?.value || '';
  try {
    const { vehicles, total } = await request(`/admin/vehicles?page=${page}&search=${encodeURIComponent(searchVal)}`);
    const pages = Math.ceil(total / 20);
    document.getElementById('adminContent').innerHTML = `
      <div style="display:flex;gap:0.75rem;margin-bottom:1rem;align-items:center;flex-wrap:wrap;">
        <input type="text" id="adminVehicleSearch" placeholder="Buscar por título o marca..."
          value="${escapeHtml(searchVal)}"
          style="flex:1;min-width:200px;padding:0.45rem 0.8rem;background:var(--dark-3);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text);font-size:0.85rem;"
          oninput="debounceAdmin(() => loadAdminVehicles(1))"
          onkeydown="if(event.key==='Enter') loadAdminVehicles(1)">
        <button class="btn btn-sm btn-secondary" onclick="loadAdminVehicles(1)">🔍 Buscar</button>
        <span style="color:var(--text-3);font-size:0.8rem;">${total} publicaciones totales</span>
      </div>
      ${vehicles?.length ? `
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Título</th><th>Vendedor</th><th>Precio</th><th>Estado</th><th>Vistas</th><th>Fecha</th><th>Acción</th></tr></thead>
            <tbody>
              ${vehicles.map(v => `
                <tr>
                  <td><a href="#" onclick="viewVehicle(${v.id})" style="color:var(--primary-light);">${escapeHtml(v.title)}</a></td>
                  <td style="font-size:0.82rem;">
                    ${escapeHtml(v.seller_username)}
                    ${v.seller_banned ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:1px 5px;border-radius:4px;font-size:0.72rem;margin-left:4px;">BAN</span>' : ''}
                  </td>
                  <td style="font-size:0.82rem;">$${formatNumber(v.price)}</td>
                  <td>
                    <span style="font-size:0.75rem;padding:2px 7px;border-radius:5px;font-weight:600;
                      background:${v.status==='active'?'rgba(34,197,94,0.12)':v.status==='sold'?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)'};
                      color:${v.status==='active'?'#22c55e':v.status==='sold'?'#ef4444':'#f59e0b'};"
                    >${v.status}</span>
                  </td>
                  <td style="text-align:center;font-size:0.82rem;">${v.view_count || 0}</td>
                  <td style="font-size:0.78rem;color:var(--text-3);">${formatRelTime(v.created_at)}</td>
                  <td style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="openEditModal(${v.id}, event)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>Editar</button>
                    <button class="btn btn-sm btn-danger" data-vid="${v.id}" data-title="${escapeHtml(v.title)}"
                      onclick="adminDeleteVehicle(+this.dataset.vid, this.dataset.title)">Eliminar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${pages > 1 ? `<div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;flex-wrap:wrap;">
          ${Array.from({length: pages}, (_, i) => `
            <button class="btn btn-sm ${i+1===page?'btn-primary':'btn-ghost'}" onclick="loadAdminVehicles(${i+1})">${i+1}</button>
          `).join('')}
        </div>` : ''}
      ` : '<p style="padding:2rem;color:var(--text-3);">Sin publicaciones</p>'}
    `;
  } catch (err) { showToast(err.message, 'error'); }
}

async function resolveReport(id, status) {
  try { await request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); showToast('Reporte resuelto', 'success'); loadAdminReports(); } catch (err) { showToast(err.message, 'error'); }
}

async function loadAdminUsers() {
  try {
    const res = await request('/admin/users');
    const users = res?.users ?? res;
    document.getElementById('adminContent').innerHTML = users?.length ? `
      <div class="table-responsive">
        <table class="admin-table">
          <thead><tr><th>Usuario</th><th>Email</th><th>Registro</th><th>Vehículos</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${users.map(u => {
              const isBanned = u.profiles?.[0]?.is_banned;
              const isAdm = u.profiles?.[0]?.is_admin;
              const isVerified = u.profiles?.[0]?.is_verified;
              return `
                <tr id="user-row-${u.id}">
                  <td style="font-weight:600;">${escapeHtml(u.username)}${isAdm ? ' <span style="font-size:0.7rem;background:rgba(245,158,11,0.15);color:var(--primary);padding:1px 6px;border-radius:4px;font-weight:700;">ADMIN</span>' : ''}${isVerified ? ' ✓' : ''}</td>
                  <td style="color:var(--text-2);font-size:0.85rem;">${escapeHtml(u.email)}</td>
                  <td style="color:var(--text-3);font-size:0.82rem;">${formatRelTime(u.created_at)}</td>
                  <td style="text-align:center;">${u.vehicle_count || 0}</td>
                  <td>
                    ${isBanned
                      ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:6px;font-size:0.78rem;font-weight:600;">Suspendido</span>'
                      : '<span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:2px 8px;border-radius:6px;font-size:0.78rem;font-weight:600;">Activo</span>'
                    }
                  </td>
                  <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-secondary" onclick="editProfile('${u.id}')">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
                      Editar perfil
                    </button>
                    <button class="btn btn-sm ${isBanned ? 'btn-secondary' : 'btn-danger'}" onclick="toggleBan('${u.id}')">
                      ${isBanned ? 'Reactivar' : 'Suspender'}
                    </button>
                    ${!isAdm ? `<button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', true)">Hacer admin</button>` : `<button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', false)">Quitar admin</button>`}
                    <button class="btn btn-sm" style="${isVerified ? 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);' : 'background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.25);'}" onclick="toggleVerify('${u.id}')">
                      ${isVerified ? '✓ Verificado' : 'Verificar'}
                    </button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '<p style="padding:2rem;color:var(--text-3);">Sin usuarios</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleFollow(id) {
  const btn = document.getElementById('followBtn');
  if (btn) btn.disabled = true;
  try {
    const res = await request(`/users/${id}/follow`, { method: 'POST' });
    const countEl = document.getElementById('followersCount');
    if (countEl) countEl.textContent = res.followers_count;
    if (btn) {
      btn.disabled = false;
      btn.textContent = res.following ? 'Dejar de seguir' : '+ Seguir';
      btn.className = `profile-action-btn ${res.following ? 'btn-secondary' : 'btn-primary'}`;
      btn.style.removeProperty('min-width');
    }
    showToast(res.following ? 'Ahora seguís a este vendedor' : 'Dejaste de seguir', 'success');
  } catch (err) {
    if (btn) btn.disabled = false;
    showToast(err.message, 'error');
  }
}

// TRADE OFFERS
let tradeTargetVehicleId = null;

async function openTradeModal(vehicleId) {
  if (!currentUser) return showSection('login');
  tradeTargetVehicleId = vehicleId;
  const select = document.getElementById('tradeOfferedVehicle');
  select.innerHTML = '<option value="">Cargando tus vehículos...</option>';
  document.getElementById('tradeMessage').value = '';
  openAccessibleModal('tradeModal', { initialFocusSelector: '#tradeOfferedVehicle' });
  try {
    const vehicles = await request('/my-vehicles');
    const active = (vehicles || []).filter(v => v.status === 'active');
    if (!active.length) {
      select.innerHTML = '<option value="">No tenés vehículos activos para ofrecer</option>';
    } else {
      select.innerHTML = '<option value="">Seleccioná un vehículo</option>' +
        active.map(v => `<option value="${v.id}">${escapeHtml(v.brand)} ${escapeHtml(v.model)} ${v.year} — $${formatNumber(v.price)}</option>`).join('');
    }
  } catch { select.innerHTML = '<option value="">Error al cargar vehículos</option>'; }
}

function closeTradeModal() {
  closeAccessibleModal('tradeModal');
  tradeTargetVehicleId = null;
}

async function submitTradeOffer() {
  const offered = document.getElementById('tradeOfferedVehicle').value;
  const message = document.getElementById('tradeMessage').value;
  if (!offered) return showToast('Seleccioná un vehículo para ofrecer', 'error');
  // BUG-13: disable button immediately to prevent double submit
  const submitBtn = document.querySelector('#tradeModal button[onclick*="submitTradeOffer"], #tradeModal .btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }
  try {
    await request(`/vehicles/${tradeTargetVehicleId}/trade-offer`, { method: 'POST', body: JSON.stringify({ offered_vehicle_id: offered, message }) });
    showToast('¡Propuesta enviada! Mirá el chat con el vendedor.', 'success');
    closeTradeModal();
    // Ir al chat para que el comprador vea la card enviada
    const conversations = await request('/conversations');
    const conv = (conversations.conversations || []).find(c =>
      c.vehicle?.id === tradeTargetVehicleId || c.vehicle_id === tradeTargetVehicleId
    );
    if (conv) {
      setTimeout(() => openConversation(conv.id, null), 400);
    } else {
      showSection('messages');
    }
  } catch (err) { showToast(err.message, 'error'); }
  finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Enviar propuesta'; }
  }
}

async function loadTradeOffers() {
  const section = document.getElementById('tradeOffersSection');
  try {
    const { received, sent } = await request('/trade-offers');
    if (!received?.length && !sent?.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';

    const countEl = document.getElementById('tradeOffersCount');
    const pending = received.filter(o => o.status === 'pending').length;
    countEl.textContent = pending > 0 ? pending + ' pendiente' + (pending > 1 ? 's' : '') : '';

    const statusLabel = s => ({ pending: '⏳ Pendiente', accepted: '✅ Aceptada', rejected: '❌ Rechazada' }[s] || s);
    const statusColor = s => ({ pending: 'var(--primary)', accepted: '#22c55e', rejected: '#ef4444' }[s]);

    const renderOffer = (o, isReceived) => `
      <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:var(--radius);padding:0.55rem 0.85rem;margin-bottom:0.4rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(o.offered_vehicle?.brand || '')} ${escapeHtml(o.offered_vehicle?.model || '')} ${o.offered_vehicle?.year || ''}
            <span style="color:var(--text-2);font-weight:400;"> → ${escapeHtml(o.target_vehicle?.brand || '')} ${escapeHtml(o.target_vehicle?.model || '')} ${o.target_vehicle?.year || ''}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-3);">${isReceived ? 'De: ' + escapeHtml(o.proposer?.username || '') : 'Para: ' + escapeHtml(o.owner?.username || '')} · ${formatRelTime(o.created_at)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
          <span style="font-size:0.75rem;font-weight:700;color:${statusColor(o.status)};">${statusLabel(o.status)}</span>
          ${isReceived && o.status === 'pending' ? `
            <button class="btn btn-sm btn-primary" style="padding:0.2rem 0.6rem;font-size:0.78rem;" onclick="respondToTrade(${o.id}, 'accepted')">Aceptar</button>
            <button class="btn btn-sm btn-danger" style="padding:0.2rem 0.6rem;font-size:0.78rem;" onclick="respondToTrade(${o.id}, 'rejected')">Rechazar</button>` : ''}
        </div>
      </div>`;

    // Renderizar: pendientes primero, historial colapsado
    function renderWithHistory(containerId, offers, isReceived, emptyMsg) {
      const container = document.getElementById(containerId);
      if (!offers?.length) { container.innerHTML = `<p style="color:var(--text-3);font-size:0.9rem;">${emptyMsg}</p>`; return; }
      const pending = offers.filter(o => o.status === 'pending');
      const history = offers.filter(o => o.status !== 'pending');
      const histId = containerId + '_hist';
      let html = '';
      if (pending.length) {
        html += pending.map(o => renderOffer(o, isReceived)).join('');
      } else {
        html += `<p style="color:var(--text-3);font-size:0.85rem;margin-bottom:0.5rem;">Sin pendientes</p>`;
      }
      if (history.length) {
        html += `
          <div id="${histId}" style="display:none;">${history.map(o => renderOffer(o, isReceived)).join('')}</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:0.25rem;font-size:0.78rem;" onclick="
            const h=document.getElementById('${histId}');
            const open=h.style.display!=='none';
            h.style.display=open?'none':'block';
            this.textContent=open?'Ver historial (${history.length}) ▾':'Ocultar historial ▴';
          ">Ver historial (${history.length}) ▾</button>`;
      }
      container.innerHTML = html;
    }

    renderWithHistory('tradeOffersList', received, true,  'Sin permutas recibidas');
    renderWithHistory('tradeSentList',   sent,     false, 'Sin permutas enviadas');
  } catch { section.style.display = 'none'; }
}

async function respondToTrade(id, status) {
  try {
    const res = await request(`/trade-offers/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    showToast(status === 'accepted' ? '¡Permuta aceptada! Se abrió el chat.' : 'Permuta rechazada', status === 'accepted' ? 'success' : 'error');
    if (status === 'accepted' && res.conversation_id) {
      currentConversationId = res.conversation_id;
      showSection('messages');
    } else {
      loadTradeOffers();
    }
  } catch (err) { showToast(err.message, 'error'); }
}

async function respondToTradeInChat(offerId, status) {
  try {
    const actionsEl = document.getElementById(`trade-actions-${offerId}`);
    if (actionsEl) actionsEl.innerHTML = '<span style="color:var(--text-3);font-size:0.85rem;">Procesando...</span>';
    await request(`/trade-offers/${offerId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    if (actionsEl) {
      actionsEl.innerHTML = status === 'accepted'
        ? '<span style="color:#22c55e;font-weight:600;">✅ Permuta aceptada</span>'
        : '<span style="color:#ef4444;font-weight:600;">❌ Permuta rechazada</span>';
    }
    showToast(status === 'accepted' ? 'Permuta aceptada' : 'Permuta rechazada', status === 'accepted' ? 'success' : 'info');
  } catch (err) {
    showToast(err.message, 'error');
    const actionsEl = document.getElementById(`trade-actions-${offerId}`);
    if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-primary btn-sm" style="margin-right:0.4rem;" onclick="respondToTradeInChat(${offerId}, 'accepted')">✅ Aceptar</button><button class="btn btn-danger btn-sm" onclick="respondToTradeInChat(${offerId}, 'rejected')">❌ Rechazar</button>`;
  }
}

async function updateTradeCardStatuses() {
  const cards = document.querySelectorAll('.trade-card');
  if (!cards.length) return;
  try {
    const { received } = await request('/trade-offers');
    if (!received?.length) return;

    // Map by offer id AND by offered_vehicle_id for old cards without offer_id
    const byOfferId = Object.fromEntries(received.map(o => [String(o.id), o]));
    const byVehicleId = Object.fromEntries(received.map(o => [String(o.offered_vehicle_id), o]));

    cards.forEach(card => {
      const offerId = card.dataset.offerId;
      const offer = offerId ? byOfferId[offerId] : null;

      // For old cards without offer_id, try to match by the vehicle id in the card JSON
      const matchedOffer = offer || (() => {
        // Extract vehicle id from the card's onclick attribute
        const onclick = card.getAttribute('onclick') || '';
        const match = onclick.match(/viewVehicle\((\d+)\)/);
        return match ? byVehicleId[match[1]] : null;
      })();

      if (!matchedOffer) return;

      const realOfferId = matchedOffer.id;
      let actionsEl = document.getElementById(`trade-actions-${realOfferId}`);

      // If no actions element exists (old card), inject one
      if (!actionsEl) {
        const body = card.querySelector('.trade-card-body');
        if (!body) return;
        actionsEl = document.createElement('div');
        actionsEl.className = 'trade-card-actions';
        actionsEl.id = `trade-actions-${realOfferId}`;
        body.appendChild(actionsEl);
      }

      if (matchedOffer.status === 'accepted') {
        actionsEl.innerHTML = '<span style="color:#22c55e;font-weight:600;">✅ Permuta aceptada</span>';
      } else if (matchedOffer.status === 'rejected') {
        actionsEl.innerHTML = '<span style="color:#ef4444;font-weight:600;">❌ Permuta rechazada</span>';
      } else if (matchedOffer.status === 'pending') {
        actionsEl.innerHTML = `<button class="btn btn-primary btn-sm" style="margin-right:0.4rem;" onclick="respondToTradeInChat(${realOfferId}, 'accepted')">✅ Aceptar</button><button class="btn btn-danger btn-sm" onclick="respondToTradeInChat(${realOfferId}, 'rejected')">❌ Rechazar</button>`;
      }
    });
  } catch {}
}

const PRESTITO_FALLBACK_CONFIG = Object.freeze({
  interesAutoR1: 1.015,
  interesAutoR2: 0.87,
  interesAutoR3: 0.72,
  cuotasAutoR1: 24,
  cuotasAutoR2: 36,
  cuotasAutoR3: 48,
  intervaloAuto: 2
});

function normalizePrestitoAmount(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function handlePrestitoAmountInput(event) {
  const target = event?.target || document.getElementById('prestitoAmount');
  if (!target) return;
  const clean = normalizePrestitoAmount(target.value);
  target.value = clean ? formatNumber(Number(clean)) : '';
}

function parsePrestitoAmountInput() {
  const amountEl = document.getElementById('prestitoAmount');
  const clean = normalizePrestitoAmount(amountEl?.value || '');
  return Number(clean || 0);
}

function prestitoPMT(ir, np, pv, fv = 0, type = 0) {
  if (!ir) return -(pv + fv) / np;
  const pvif = Math.pow(1 + ir, np);
  let pmt = -ir * (pv * pvif + fv) / (pvif - 1);
  if (type === 1) pmt /= (1 + ir);
  return pmt;
}

function getPrestitoRangeConfig(config, modelYear) {
  const year = Number(modelYear);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (!Number.isFinite(age) || age < 0 || age > 15) {
    return { eligible: false, age };
  }
  if (age >= 11) {
    return { eligible: true, age, interest: Number(config.interesAutoR1), cuotas: Number(config.cuotasAutoR1), intervalo: Number(config.intervaloAuto) };
  }
  if (age >= 8) {
    return { eligible: true, age, interest: Number(config.interesAutoR2), cuotas: Number(config.cuotasAutoR2), intervalo: Number(config.intervaloAuto) };
  }
  return { eligible: true, age, interest: Number(config.interesAutoR3), cuotas: Number(config.cuotasAutoR3), intervalo: Number(config.intervaloAuto) };
}

async function getPrestitoQuoteConfig(force = false) {
  if (prestitoConfigCache && !force) return prestitoConfigCache;
  try {
    const data = await request('/partners/prestito/config');
    const cfg = data?.config || {};
    prestitoConfigCache = {
      interesAutoR1: Number(cfg.interesAutoR1) || PRESTITO_FALLBACK_CONFIG.interesAutoR1,
      interesAutoR2: Number(cfg.interesAutoR2) || PRESTITO_FALLBACK_CONFIG.interesAutoR2,
      interesAutoR3: Number(cfg.interesAutoR3) || PRESTITO_FALLBACK_CONFIG.interesAutoR3,
      cuotasAutoR1: Number(cfg.cuotasAutoR1) || PRESTITO_FALLBACK_CONFIG.cuotasAutoR1,
      cuotasAutoR2: Number(cfg.cuotasAutoR2) || PRESTITO_FALLBACK_CONFIG.cuotasAutoR2,
      cuotasAutoR3: Number(cfg.cuotasAutoR3) || PRESTITO_FALLBACK_CONFIG.cuotasAutoR3,
      intervaloAuto: Number(cfg.intervaloAuto) || PRESTITO_FALLBACK_CONFIG.intervaloAuto
    };
  } catch {
    prestitoConfigCache = { ...PRESTITO_FALLBACK_CONFIG };
  }
  return prestitoConfigCache;
}

async function calculatePrestitoQuote() {
  const yearEl = document.getElementById('prestitoModelYear');
  const infoEl = document.getElementById('prestitoQuoteInfo');
  const rowsEl = document.getElementById('prestitoQuoteRows');
  const tableWrap = document.getElementById('prestitoTableWrap');
  if (!yearEl || !infoEl || !rowsEl || !tableWrap) return;

  const modelYear = parseInt(yearEl.value, 10);
  const amount = parsePrestitoAmountInput();
  if (!Number.isFinite(modelYear) || modelYear < 2000) {
    showToast('Ingresá un año de modelo válido', 'error');
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('Ingresá un importe válido', 'error');
    return;
  }

  const maxFinancingAmount = Number(prestitoVehicleContext?.maxFinancingAmount || 0);
  if (maxFinancingAmount > 0 && amount > maxFinancingAmount) {
    showToast(`El importe no puede superar el 50% del vehículo ($${formatNumber(maxFinancingAmount)})`, 'warning');
    return;
  }

  const config = await getPrestitoQuoteConfig();
  const range = getPrestitoRangeConfig(config, modelYear);
  if (!range.eligible) {
    tableWrap.style.display = 'none';
    rowsEl.innerHTML = '';
    infoEl.textContent = 'Préstito financia autos con antigüedad de hasta 15 años.';
    return;
  }

  const cuotas = Math.max(2, Number(range.cuotas || 24));
  const intervalo = Math.max(1, Number(range.intervalo || 2));
  const startAt = Math.max(2, intervalo + 2);
  const monthlyRate = Number(range.interest || 0) / 12;

  const rows = [];
  for (let n = startAt; n <= cuotas; n += intervalo) {
    const cuotaEstimada = Math.round(prestitoPMT(monthlyRate, n, amount * -1));
    rows.push({ cuotas: n, cuota: cuotaEstimada });
  }
  if (!rows.length) {
    const cuotaEstimada = Math.round(prestitoPMT(monthlyRate, cuotas, amount * -1));
    rows.push({ cuotas, cuota: cuotaEstimada });
  }

  rowsEl.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.cuotas}</td>
      <td>$ ${formatNumber(row.cuota)}</td>
    </tr>
  `).join('');

  const tasaAnual = Math.round(Number(range.interest || 0) * 1000) / 10;
  infoEl.textContent = `Modelo ${modelYear} (${range.age} años) · Hasta ${cuotas} cuotas · Tasa de referencia ${tasaAnual}% anual`;
  tableWrap.style.display = 'block';
}

function openPrestitoQuoteModal(vehicleId, vehicleYear, vehiclePriceUsd, vehiclePriceArs, vehicleTitle = '') {
  const yearEl = document.getElementById('prestitoModelYear');
  const amountEl = document.getElementById('prestitoAmount');
  const emailEl = document.getElementById('prestitoEmail');
  const rowsEl = document.getElementById('prestitoQuoteRows');
  const tableWrap = document.getElementById('prestitoTableWrap');
  const infoEl = document.getElementById('prestitoQuoteInfo');
  const titleEl = document.getElementById('prestitoVehicleTitle');

  const numericYear = Number(vehicleYear || 0);
  const numericPriceUsd = Number(vehiclePriceUsd || 0);
  const numericPriceArs = Number(vehiclePriceArs || 0);
  const maxFinancingAmount = numericPriceArs > 0 ? Math.round(numericPriceArs * 0.5) : 0;

  prestitoVehicleContext = {
    vehicleId: Number(vehicleId || 0),
    year: Number.isFinite(numericYear) && numericYear > 0 ? numericYear : new Date().getFullYear(),
    priceUsd: Number.isFinite(numericPriceUsd) ? numericPriceUsd : 0,
    priceArs: Number.isFinite(numericPriceArs) ? numericPriceArs : 0,
    maxFinancingAmount
  };

  if (titleEl) {
    const safeTitle = String(vehicleTitle || '').trim();
    titleEl.textContent = safeTitle
      ? `Simulá cuotas para ${safeTitle}`
      : 'Simulá tus cuotas en pesos para este vehículo.';
  }
  if (yearEl) yearEl.value = String(prestitoVehicleContext.year);
  if (amountEl) amountEl.value = maxFinancingAmount > 0 ? formatNumber(maxFinancingAmount) : '';
  if (emailEl) emailEl.value = String(currentUser?.email || '').trim();
  if (rowsEl) rowsEl.innerHTML = '';
  if (tableWrap) tableWrap.style.display = 'none';
  if (infoEl) {
    infoEl.textContent = maxFinancingAmount > 0
      ? `Monto máximo estimado (50%): $${formatNumber(maxFinancingAmount)}`
      : 'Ingresá monto y año para calcular cuotas estimadas.';
  }

  openAccessibleModal('prestitoModal', { initialFocusSelector: '#prestitoAmount' });
  calculatePrestitoQuote().catch(() => {});
}

function closePrestitoQuoteModal() {
  closeAccessibleModal('prestitoModal');
  prestitoVehicleContext = null;
}

async function submitPrestitoLead() {
  const btn = document.getElementById('prestitoLeadBtn');
  const email = String(document.getElementById('prestitoEmail')?.value || '').trim();
  const modelYear = parseInt(document.getElementById('prestitoModelYear')?.value || '', 10);
  const amount = parsePrestitoAmountInput();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Ingresá un email válido para enviar la solicitud', 'error');
    return;
  }
  if (!Number.isFinite(modelYear) || modelYear < 2000) {
    showToast('Ingresá un año válido', 'error');
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('Ingresá un importe válido', 'error');
    return;
  }

  const maxFinancingAmount = Number(prestitoVehicleContext?.maxFinancingAmount || 0);
  if (maxFinancingAmount > 0 && amount > maxFinancingAmount) {
    showToast(`El importe no puede superar el 50% del vehículo ($${formatNumber(maxFinancingAmount)})`, 'warning');
    return;
  }

  const defaultLabel = btn?.textContent || 'Enviar a Préstito';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }
  try {
    await request('/partners/prestito/lead', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'Auto',
        modelo: modelYear,
        importe: amount,
        correo: email,
        vehicle_id: prestitoVehicleContext?.vehicleId || null
      })
    });
    showToast('Solicitud enviada a Préstito. Te van a contactar por email.', 'success');
  } catch (err) {
    showToast(err.message || 'No se pudo enviar a Préstito', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = defaultLabel;
    }
  }
}

async function toggleVerify(id) {
  try {
    const res = await request(`/admin/users/${id}/verify`, { method: 'PUT' });
    showToast(res.is_verified ? 'Vendedor verificado ✓' : 'Verificación removida', res.is_verified ? 'success' : 'error');
    loadAdminUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleAdmin(id, makeAdmin) {
  try {
    await request(`/admin/users/${id}/admin`, { method: 'PUT', body: JSON.stringify({ is_admin: makeAdmin }) });
    showToast(makeAdmin ? 'Usuario promovido a admin' : 'Admin removido', 'success');
    loadAdminUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleBan(id) {
  try {
    const res = await request(`/admin/users/${id}/ban`, { method: 'PUT' });
    showToast(res.is_banned ? 'Cuenta suspendida' : 'Cuenta reactivada', res.is_banned ? 'error' : 'success');
    loadAdminUsers();
  } catch (err) { showToast(err.message, 'error'); }
}

// MODALS
function openReportModal(vehicleId) {
  reportVehicleId = vehicleId;
  openAccessibleModal('reportModal', { initialFocusSelector: '#reportReason' });
}

function closeReportModal() {
  closeAccessibleModal('reportModal');
  reportVehicleId = null;
}

async function submitReport() {
  const reason = document.getElementById('reportReason').value;
  const description = document.getElementById('reportDescription').value;
  if (!reason) { showToast('Selecciona un motivo', 'error'); return; }
  try {
    await request('/reports', { method: 'POST', body: JSON.stringify({ vehicle_id: reportVehicleId, reason, description }) });
    showToast('Reporte enviado', 'success');
    closeReportModal();
  } catch (err) { showToast(err.message, 'error'); }
}

function openRateModal(convId, recipientId, vehicleId) {
  rateConversationId = convId;
  rateRecipientId = recipientId;
  rateVehicleId = vehicleId || null;
  setStarRating(0);
  document.getElementById('rateReview').value = '';
  openAccessibleModal('rateModal', { initialFocusSelector: '#starRating .star' });
}

function closeRateModal() {
  closeAccessibleModal('rateModal');
  rateConversationId = null;
  rateRecipientId = null;
  rateVehicleId = null;
}

document.addEventListener('click', e => {
  const star = e.target.closest('#starRating .star');
  if (star) {
    const value = parseInt(star.dataset.value || '0', 10);
    if (value > 0) setStarRating(value);
  }
});

async function submitRating() {
  const stars = parseInt(document.getElementById('starRating')?.dataset.value || '0', 10);
  const review = document.getElementById('rateReview').value;
  if (!stars) { showToast('Selecciona estrellas', 'error'); return; }
  try {
    await request('/ratings', { method: 'POST', body: JSON.stringify({ to_user_id: rateRecipientId, vehicle_id: rateVehicleId ?? currentVehicleId, stars, review }) });
    showToast('Calificación enviada', 'success');
    closeRateModal();
  } catch (err) { showToast(err.message, 'error'); }
}
function closeAllModals() {
  if (isVisibleElement(document.getElementById('editVehicleModal'))) closeEditModal();
  if (isVisibleElement(document.getElementById('tradeModal'))) closeTradeModal();
  if (isVisibleElement(document.getElementById('reportModal'))) closeReportModal();
  if (isVisibleElement(document.getElementById('rateModal'))) closeRateModal();
  if (isVisibleElement(document.getElementById('prestitoModal'))) closePrestitoQuoteModal();
  if (isVisibleElement(document.getElementById('confirmModal'))) closeConfirmModal();
  if (isVisibleElement(document.getElementById('editProfileModal'))) closeEditProfileModal();
  if (isVisibleElement(document.getElementById('publishPreviewModal'))) closePublishPreviewModal();
  modalStack = [];
  syncModalOverlay();
  closeLightbox();
  document.body.classList.remove('publish-preview-open');
  confirmCallback = null;
}

// Lightbox
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxTouchStartX = 0;
let lightboxTouchStartY = 0;
let lightboxTouchActive = false;

function lightboxOnTouchStart(e) {
  if (!e.touches || !e.touches.length) return;
  const t = e.touches[0];
  lightboxTouchStartX = t.clientX;
  lightboxTouchStartY = t.clientY;
  lightboxTouchActive = true;
}

function lightboxOnTouchEnd(e) {
  if (!lightboxTouchActive || lightboxImages.length <= 1) return;
  const t = e.changedTouches && e.changedTouches[0];
  if (!t) return;
  const dx = t.clientX - lightboxTouchStartX;
  const dy = t.clientY - lightboxTouchStartY;
  lightboxTouchActive = false;
  if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  if (dx < 0) lightboxNav(1);
  else lightboxNav(-1);
}

function initLightboxSwipe() {
  const img = document.getElementById('lightboxImage');
  if (!img || img.dataset.swipeBound === '1') return;
  img.addEventListener('touchstart', lightboxOnTouchStart, { passive: true });
  img.addEventListener('touchend', lightboxOnTouchEnd, { passive: true });
  img.dataset.swipeBound = '1';
}

function openLightbox(images, startIndex) {
  if (!images?.length) return;
  lightboxImages = images;
  lightboxIndex = typeof startIndex === 'number' ? startIndex : 0;
  initLightboxSwipe();
  // Render thumbnail strip
  const thumbsEl = document.getElementById('lightboxThumbs');
  if (thumbsEl) {
    if (images.length > 1) {
      thumbsEl.innerHTML = images.map((url, i) =>
        `<img src="${url}" class="lightbox-thumb${i === lightboxIndex ? ' active' : ''}" data-index="${i}" loading="lazy" onclick="lightboxSetIndex(${i})" alt="">`
      ).join('');
      thumbsEl.style.display = 'flex';
    } else {
      thumbsEl.innerHTML = '';
      thumbsEl.style.display = 'none';
    }
  }
  document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex];
  const counterEl = document.getElementById('lightboxCounter');
  if (images.length > 1) {
    counterEl.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    counterEl.style.display = '';
  } else {
    counterEl.style.display = 'none';
  }
  openAccessibleModal('lightboxModal', { display: 'flex', initialFocusSelector: '.lightbox-close' });
}
function closeLightbox(e) {
  if (e && e.target && e.target.tagName === 'IMG') return;
  closeAccessibleModal('lightboxModal');
}
function lightboxSetIndex(i) {
  lightboxIndex = i;
  document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex];
  document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  const thumbsEl = document.getElementById('lightboxThumbs');
  if (thumbsEl) {
    thumbsEl.querySelectorAll('.lightbox-thumb').forEach((t, idx) => t.classList.toggle('active', idx === i));
    // Scroll active thumb into view within the strip
    const activeThumb = thumbsEl.querySelector('.lightbox-thumb.active');
    if (activeThumb) activeThumb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
}
function lightboxNav(dir) {
  lightboxSetIndex((lightboxIndex + dir + lightboxImages.length) % lightboxImages.length);
}
document.addEventListener('keydown', e => {
  const lightboxVisible = isVisibleElement(document.getElementById('lightboxModal'));
  if (lightboxVisible) {
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); lightboxNav(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); lightboxNav(1); }
    return;
  }

  const mobileMenuVisible = isVisibleElement(document.getElementById('mobileAccountMenu'));
  if (e.key === 'Escape') {
    if (closeTopAccessibleModal()) {
      e.preventDefault();
      return;
    }
    if (mobileMenuVisible) {
      closeMobileMenu();
      e.preventDefault();
      return;
    }
  }

  const activeModal = modalStack.length ? document.getElementById(modalStack[modalStack.length - 1].id) : null;
  if (!activeModal && mobileMenuVisible && e.key === 'Tab') {
    const menu = document.getElementById('mobileAccountMenu');
    const focusable = getFocusableElements(menu);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
    return;
  }
  if (activeModal && e.key === 'Tab') {
    const focusable = getFocusableElements(activeModal);
    if (!focusable.length) {
      e.preventDefault();
      activeModal.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

document.addEventListener('keydown', e => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.kbClick === '1' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    target.click();
  }
});

document.addEventListener('keydown', e => {
  const star = e.target instanceof HTMLElement ? e.target.closest('#starRating .star') : null;
  if (!star) return;
  const rating = document.getElementById('starRating');
  if (!rating) return;
  const stars = Array.from(rating.querySelectorAll('.star'));
  const idx = stars.indexOf(star);
  if (idx === -1) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    const next = Math.min(stars.length - 1, idx + 1);
    setStarRating(next + 1);
    stars[next]?.focus();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    const prev = Math.max(0, idx - 1);
    setStarRating(prev + 1);
    stars[prev]?.focus();
  } else if (e.key === 'Home') {
    e.preventDefault();
    setStarRating(1);
    stars[0]?.focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    setStarRating(stars.length);
    stars[stars.length - 1]?.focus();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const value = parseInt(star.dataset.value || '0', 10);
    if (value > 0) setStarRating(value);
  }
});

// Confirm Modal
let confirmCallback = null;
function showConfirmModal(title, message, buttonText, callback) {
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalMessage').textContent = message;
  const btn = document.getElementById('confirmModalAction');
  btn.textContent = buttonText;
  confirmCallback = callback;
  btn.onclick = () => { const cb = confirmCallback; closeConfirmModal(); if (cb) cb(); };
  openAccessibleModal('confirmModal', { initialFocusSelector: '#confirmModalAction' });
}
function closeConfirmModal() {
  closeAccessibleModal('confirmModal');
  confirmCallback = null;
}

// UTILS
function thumbUrl(url) {
  if (!url) return PLACEHOLDER_IMG;
  const m = String(url).match(/^(https:\/\/[^/]+)\/storage\/v1\/object\/public\/(.+)$/);
  if (m) {
    const base = m[1];
    const objectPath = m[2];
    return `${base}/storage/v1/render/image/public/${objectPath}?width=520&height=325&resize=cover&quality=52`;
  }
  return url;
}
function formatNumber(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatTime(d) { return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function formatRelTime(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}
function escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// Builds a proper Instagram URL from a handle (@foo, foo) or a full URL
function instagramUrl(val) {
  if (!val) return '';
  const v = val.trim();
  // BUG-01: block dangerous protocols before any other check
  if (v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('vbscript:')) return '#';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return 'https://instagram.com/' + v.replace(/^@/, '');
}

// Readable Instagram label (last path segment or @handle)
function instagramLabel(val) {
  if (!val) return '';
  const v = val.trim();
  if (v.startsWith('http://') || v.startsWith('https://')) {
    try { return '@' + new URL(v).pathname.replace(/\//g, '').replace(/^@/, ''); } catch { return v; }
  }
  return '@' + v.replace(/^@/, '');
}

function googleMapsSearchUrl(address) {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(address).trim())}`;
}

async function configureInstagramFromAdmin(event) {
  if (event) event.stopPropagation();
  if (!currentUser?.profile?.is_admin) {
    showToast('Solo administradores pueden configurar Instagram', 'error');
    return;
  }

  try {
    const current = await request('/admin/instagram-config');
    const businessId = prompt(
      'Instagram Business Account ID:',
      String(current?.business_account_id || '').trim()
    );
    if (businessId === null) return;

    const tokenInput = prompt(
      'Access Token de Instagram (deja vacio para mantener el actual):',
      ''
    );
    if (tokenInput === null) return;

    const apiVersion = prompt(
      'Version Graph API (ej: v25.0):',
      String(current?.graph_api_version || 'v25.0').trim()
    );
    if (apiVersion === null) return;

    const hashtags = prompt(
      'Hashtags por defecto:',
      String(current?.default_hashtags || '').trim()
    );
    if (hashtags === null) return;

    const payload = {
      business_account_id: String(businessId || '').trim(),
      graph_api_version: String(apiVersion || '').trim(),
      default_hashtags: String(hashtags || '').trim()
    };
    if (String(tokenInput || '').trim()) {
      payload.access_token = String(tokenInput).trim();
    }

    const saved = await request('/admin/instagram-config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (saved?.configured) showToast('Instagram configurado y guardado en base', 'success');
    else showToast(`Configuracion parcial. Falta: ${(saved?.missing || []).join(', ')}`, 'warning');
  } catch (err) {
    showToast(err.message || 'No se pudo guardar configuracion de Instagram', 'error');
  }
}

async function publishVehicleToInstagram(vehicleId, event) {
  if (event) event.stopPropagation();
  if (!currentUser?.profile?.is_admin) {
    showToast('Solo administradores pueden publicar en Instagram', 'error');
    return;
  }

  const btn = document.getElementById('igPublishBtn');
  const defaultHtml = btn?.innerHTML || 'Publicar en Instagram';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Publicando...';
  }

  try {
    const result = await request(`/admin/vehicles/${vehicleId}/publish-instagram`, { method: 'POST' });
    showToast('Publicado en Instagram', 'success');
    if (result?.permalink) {
      window.open(result.permalink, '_blank', 'noopener');
    }
  } catch (err) {
    const msg = err.message || 'No se pudo publicar en Instagram';
    showToast(msg, 'error');
    if (currentUser?.profile?.is_admin && /Instagram no est[aá] configurado/i.test(msg)) {
      const wantsConfigure = confirm('Falta configuración de Instagram. ¿Querés cargarla ahora?');
      if (wantsConfigure) await configureInstagramFromAdmin();
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = defaultHtml;
    }
  }
}

function shareHomepage() {
  const url = `${window.location.origin}/`;
  const title = 'Autoventa - Compra, venta y permuta de vehiculos';
  const text = 'Te comparto Autoventa: publica tu vehiculo gratis, recibe consultas directas por WhatsApp y encontra autos con vendedores verificados. ' + url;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
    return;
  }

  navigator.clipboard.writeText(url)
    .then(() => showToast('Link de Autoventa copiado', 'success'))
    .catch(() => showToast('No se pudo copiar el link', 'error'));
}
window.shareHomepage = shareHomepage;

function shareVehicle(id, title, priceUsd, priceArs = 0) {
  const url = `${window.location.origin}${window.location.pathname}?vehicle=${id}`;
  const fixedArs = Number(priceArs || 0);
  const convertedArs = dolarRate?.venta ? Number(priceUsd || 0) * Number(dolarRate.venta) : 0;
  const resolvedArs = fixedArs > 0 ? fixedArs : (convertedArs > 0 ? convertedArs : Number(priceUsd || 0));
  const text = `${title}\nARS ${Math.round(resolvedArs).toLocaleString('es-AR')}\n${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const existing = document.getElementById('shareDropdown');
  if (existing) { existing.remove(); return; }

  const dropdown = document.createElement('div');
  dropdown.id = 'shareDropdown';
  dropdown.className = 'share-dropdown';
  dropdown.innerHTML = `
    <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener" class="share-option">
      <span class="share-option-icon share-icon-wa"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.52 3.48A11.82 11.82 0 0 0 12.13 0C5.57 0 .23 5.35.23 11.93c0 2.1.55 4.14 1.59 5.93L0 24l6.3-1.65a11.86 11.86 0 0 0 5.81 1.49h.01c6.56 0 11.9-5.35 11.9-11.93a11.8 11.8 0 0 0-3.5-8.43zM12.12 21.8h-.01a9.78 9.78 0 0 1-4.98-1.36l-.36-.21-3.74.98 1-3.63-.24-.37a9.8 9.8 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.82-9.8a9.76 9.76 0 0 1 6.95 2.89 9.76 9.76 0 0 1 2.88 6.95c0 5.41-4.4 9.8-9.82 9.8zm5.38-7.35c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.66-.5-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.47s1.06 2.87 1.21 3.07c.15.2 2.09 3.2 5.07 4.49.7.3 1.26.48 1.69.61.71.23 1.35.2 1.86.12.57-.09 1.75-.72 2-1.42.25-.7.25-1.3.18-1.42-.08-.13-.28-.2-.57-.35z"/></svg></span> Compartir por WhatsApp
    </a>
    <a href="${escapeHtml(fbUrl)}" target="_blank" rel="noopener" class="share-option">
      <span class="share-option-icon share-icon-fb"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.88 3.8-3.88 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg></span> Compartir en Facebook
    </a>
    <button class="share-option" id="instagramStoryBtn">
      <span class="share-option-icon share-icon-ig"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg></span> Historia de Instagram
    </button>
    ${(navigator.share ? `
    <button class="share-option" id="nativeShareBtn">
      <span class="share-option-icon share-icon-app"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4"></path></svg></span> Compartir con apps
    </button>
    ` : '')}
    <button class="share-option" id="copyLinkBtn">
      <span class="share-option-icon share-icon-link"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1.5 1.5"></path><path d="M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7L6.5 11.5"></path></svg></span> Copiar link
    </button>
  `;

  const shareBtn = document.querySelector('[onclick*="shareVehicle"]');
  if (shareBtn) {
    shareBtn.parentNode.style.position = 'relative';
    shareBtn.parentNode.appendChild(dropdown);
  }

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copiado', 'success'))
      .catch(() => showToast('No se pudo copiar el link', 'error'));
    document.getElementById('shareDropdown')?.remove();
  });

  const igBtn = document.getElementById('instagramStoryBtn');
  if (igBtn) {
    igBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Link copiado. Pegalo en historia (sticker enlace), bio o DM.', 'success'))
        .catch(() => showToast('No se pudo copiar. Copia el link manualmente.', 'warning'));
      window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener');
      document.getElementById('shareDropdown')?.remove();
    });
  }

  const nativeBtn = document.getElementById('nativeShareBtn');
  if (nativeBtn) {
    nativeBtn.addEventListener('click', async () => {
      try {
        await navigator.share({ title, text, url });
      } catch (_) {
        // user cancelled
      } finally {
        document.getElementById('shareDropdown')?.remove();
      }
    });
  }

  setTimeout(() => document.addEventListener('click', function handler(e) {
    if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', handler); }
  }), 0);
}
// VEHICLE MAP
const CITY_COORDS = {
  'Buenos Aires': [-34.6037, -58.3816],
  'Córdoba': [-31.4201, -64.1888],
  'Rosario': [-32.9442, -60.6505],
  'Mendoza': [-32.8908, -68.8272],
  'La Plata': [-34.9215, -57.9545],
  'Mar del Plata': [-38.0023, -57.5575],
  'Tucumán': [-26.8241, -65.2226],
  'Salta': [-24.7859, -65.4117],
  'Santa Fe': [-31.6333, -60.7],
  'Bahía Blanca': [-38.7196, -62.2724],
  'Chivilcoy': [-34.8984, -60.0197],
  'Chacabuco': [-34.6418, -60.4715],
  'Quilmes': [-34.7206, -58.2539],
  'Lanús': [-34.7006, -58.3953],
  'Lomas de Zamora': [-34.7605, -58.4],
  'San Isidro': [-34.4725, -58.5231],
  'Morón': [-34.6534, -58.6198],
  'Tigre': [-34.4261, -58.5796],
  'Pilar': [-34.4588, -58.9142],
  'Paraná': [-31.7333, -60.5333],
  'Resistencia': [-27.4515, -58.9867],
  'Corrientes': [-27.4806, -58.8341],
  'Posadas': [-27.3671, -55.8961],
  'Neuquén': [-38.9516, -68.0591],
  'San Carlos de Bariloche': [-41.1335, -71.3103],
  'Comodoro Rivadavia': [-45.8645, -67.4674],
  'Río Gallegos': [-51.6230, -69.2168],
  'Ushuaia': [-54.8019, -68.3030],
  'San Juan': [-31.5375, -68.5364],
  'San Luis': [-33.2960, -66.3356],
  'Catamarca': [-28.4696, -65.7795],
  'La Rioja': [-29.4131, -66.8558],
  'Jujuy': [-24.1858, -65.2995],
  'Santiago del Estero': [-27.7951, -64.2615],
  'Formosa': [-26.1775, -58.1781],
  'Viedma': [-40.8135, -62.9967],
  'Santa Rosa': [-36.6167, -64.2833],
  'Rawson': [-43.3002, -65.1023],
};

let vehiclesMapInstance = null;

async function loadVehicleMap() {
  if (!window.L) return;
  const el = document.getElementById('vehiclesMap');
  if (!el) return;

  // Destroy previous map instance if any
  if (vehiclesMapInstance) {
    vehiclesMapInstance.remove();
    vehiclesMapInstance = null;
  }

  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-2);">Cargando vehículos...</div>';

  let vehicles = [];
  try {
    // BUG-12: backend caps results at 12; request matches real limit
    // TODO: implement server-side pagination for the map to show more markers
    const res = await request('/vehicles?limit=12&status=active');
    vehicles = res.vehicles || res || [];
  } catch {
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-2);">Error al cargar los vehículos.</div>';
    return;
  }

  el.innerHTML = '';
  vehiclesMapInstance = L.map('vehiclesMap', { zoomControl: true, scrollWheelZoom: false }).setView([-38, -63], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(vehiclesMapInstance);

  // Group vehicles by city
  const byCity = {};
  vehicles.forEach(v => {
    const cityKey = v.city;
    if (!cityKey) return;
    if (!byCity[cityKey]) byCity[cityKey] = [];
    byCity[cityKey].push(v);
  });

  const markerIcon = (count) => L.divIcon({
    className: '',
    html: `<div style="background:#f59e0b;color:#000;border-radius:50%;width:${count > 1 ? 36 : 28}px;height:${count > 1 ? 36 : 28}px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${count > 1 ? 13 : 11}px;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${count > 1 ? count : '🚗'}</div>`,
    iconSize: [count > 1 ? 36 : 28, count > 1 ? 36 : 28],
    iconAnchor: [count > 1 ? 18 : 14, count > 1 ? 18 : 14]
  });

  Object.entries(byCity).forEach(([city, cityVehicles]) => {
    const coords = CITY_COORDS[city];
    if (!coords) return;
    const count = cityVehicles.length;
    let popupHtml = '';
    if (count === 1) {
      const v = cityVehicles[0];
      popupHtml = `<strong>${escapeHtml(v.title)}</strong><br>$${formatNumber(v.price)}<br><a href="#" onclick="viewVehicle(${v.id});return false;" style="color:#f59e0b">Ver anuncio</a>`;
    } else {
      const list = cityVehicles.slice(0, 3).map(v =>
        `<div style="margin-top:4px"><a href="#" onclick="viewVehicle(${v.id});return false;" style="color:#f59e0b">${escapeHtml(v.title)}</a> — $${formatNumber(v.price)}</div>`
      ).join('');
      popupHtml = `<strong>${count} vehículos en ${escapeHtml(city)}</strong>${list}${count > 3 ? `<div style="margin-top:4px;color:#888;">y ${count - 3} más...</div>` : ''}`;
    }
    L.marker(coords, { icon: markerIcon(count) })
      .addTo(vehiclesMapInstance)
      .bindPopup(popupHtml);
  });
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type} toast-enter`;
  toast.textContent = msg;
  const isAssertive = type === 'error' || type === 'warning';
  toast.setAttribute('role', isAssertive ? 'alert' : 'status');
  toast.setAttribute('aria-live', isAssertive ? 'assertive' : 'polite');
  toast.onclick = () => removeToast(toast);
  container.appendChild(toast);
  setTimeout(() => removeToast(toast), 3500);
}
function removeToast(toast) {
  if (!toast.parentElement) return;
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove());
}

function updateNav() {
  const isLogged = !!currentUser;
  const isAdmin = isLogged && !!currentUser.profile?.is_admin;
  
  [...document.querySelectorAll('.nav-links a')].forEach(el => el.style.display = 'none');
  
  document.getElementById('navHome').style.display = 'flex';
  document.getElementById('navVehicles').style.display = 'flex';
  document.getElementById('navSupport').style.display = 'flex';
  
  if (isLogged) {
    loadLucideIcons();
    document.getElementById('navMessages').style.display = 'flex';
    document.getElementById('navNotifications').style.display = 'flex';
    document.getElementById('navFavorites').style.display = 'flex';
    document.getElementById('navFollowing').style.display = 'flex';
    document.getElementById('navMyVehicles').style.display = 'flex';
    document.getElementById('navPublish').style.display = 'flex';
    document.getElementById('navProfile').style.display = 'flex';
    if (isAdmin) document.getElementById('navAdmin').style.display = 'flex';
    document.getElementById('navLogout').style.display = 'flex';
    
    // Auto-update publish description if fields change
    setTimeout(() => {
      ['publishBrand', 'publishModel', 'publishYear', 'publishMileage', 'publishFuel', 'publishTransmission'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
           el.removeEventListener('change', autoGenDescription);
           el.addEventListener('change', autoGenDescription);
        }
      });
      const descObj = document.getElementById('publishDescription');
      if(descObj) {
         descObj.removeEventListener('input', markDescriptionEdited);
         descObj.addEventListener('input', markDescriptionEdited);
      }
    }, 500);
    
  } else {
    document.getElementById('navLogin').style.display = 'flex';
    document.getElementById('navRegister').style.display = 'flex';
  }
}

function markDescriptionEdited() {
  const descField = document.getElementById('publishDescription');
  if (descField) descField.dataset.userEdited = 'true';
}

function markEditDescriptionEdited() {
  const f = document.getElementById('editDescription');
  if (f) f.dataset.userEdited = 'true';
}

function updateEditBrands() {
  const type = document.getElementById('editVehicleTypeTop')?.value || 'auto';
  const sel = document.getElementById('editBrand');
  if (!sel) return;
  const brandsObj = getBrandsForType(type);
  const prev = sel.value;
  sel.innerHTML = '<option value="">Seleccionar marca</option>';
  sortedBrandKeys(brandsObj, type).forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand; opt.textContent = brand;
    sel.appendChild(opt);
  });
  if (prev && brandsObj[prev]) sel.value = prev;
  initBrandPicker('editBrand');
  updateEditModels();
  toggleEngineCCField('edit'); toggleBodyTypeField('edit'); toggleDrivetrainField('edit');
}

function updateEditModels() {
  const brand = document.getElementById('editBrand')?.value || '';
  const type = document.getElementById('editVehicleTypeTop')?.value || 'auto';
  const brandsObj = getBrandsForType(type);
  const modelSel = document.getElementById('editModel');
  if (!modelSel) return;
  const prev = modelSel.value;
  const models = (brand && brandsObj[brand]) ? brandsObj[brand] : [];
  populateSelect(modelSel, models, 'Seleccionar modelo');
  if (prev && models.includes(prev)) modelSel.value = prev;
  updateEditVersions();
  const bte = document.getElementById('editBodyType'); if (bte) bte.value = '';
  toggleBodyTypeField('edit'); toggleDrivetrainField('edit');
}

function updateEditVersions() {
  const brand = document.getElementById('editBrand')?.value || '';
  const model = document.getElementById('editModel')?.value || '';
  const sel   = document.getElementById('editVersion');
  if (!sel) return;
  const prev = sel.value;
  const versions = versionsData[brand]?.[model] || [];
  populateSelect(sel, versions, 'Seleccionar versión');
  sel.disabled = !brand || !model;
  if (prev && versions.includes(prev)) sel.value = prev;
}

function updateEditTitle() {
  const brand   = document.getElementById('editBrand')?.value || '';
  const model   = document.getElementById('editModel')?.value || '';
  const version = getVersionValue('edit');
  const year    = document.getElementById('editYear')?.value || '';
  const title   = `${brand} ${model} ${version} ${year}`.replace(/\s+/g, ' ').trim();
  const el = document.getElementById('editTitle');
  if (el) el.value = title;
}

function autoGenEditDescription() {
  const descField = document.getElementById('editDescription');
  if (!descField || descField.dataset.userEdited === 'true') return;
  const brand = document.getElementById('editBrand')?.value || '';
  const model = document.getElementById('editModel')?.value || '';
  const year  = document.getElementById('editYear')?.value || '';
  const mileage = document.getElementById('editMileage')?.value || '';
  const fuel  = document.getElementById('editFuel')?.value || '';
  const trans = document.getElementById('editTransmission')?.value || '';
  if (!brand && !model) return;
  let desc = `Excelente ${brand} ${model}${year ? ' del año ' + year : ''}.`;
  if (mileage) desc += ` Cuenta con ${mileage} km.`;
  if (fuel || trans) desc += ` Motor ${fuel} y transmisión ${trans}.`;
  desc += `\n\nEl vehículo se encuentra en óptimas condiciones, listo para transferir. Respondo consultas por el chat.`;
  descField.value = desc.trim().replace(/\s+/g, ' ').replace(/\. \n/g, '.\n');
}

// Programmatically set a brand picker value without firing change event
function setBrandPickerValue(selectId, value) {
  const select = document.getElementById(selectId);
  const picker = select?.parentElement?.querySelector('.brand-picker');
  if (!select || !picker) return;
  select.value = value;
  const trigger = picker.querySelector('.brand-picker-trigger');
  const logoEl = trigger?.querySelector('.brand-picker-logo');
  const labelEl = trigger?.querySelector('.brand-picker-label');
  const label = select.options[select.selectedIndex]?.text || value || select.options[0]?.text;
  const logo = value ? brandLogoUrl(value) : null;
  if (logoEl) { if (logo) { logoEl.src = logo; logoEl.style.display = 'block'; } else logoEl.style.display = 'none'; }
  if (labelEl) labelEl.textContent = label;
  picker.querySelectorAll('.brand-picker-option').forEach(b => b.classList.toggle('selected', b.dataset.value === value));
}

function autoGenDescription() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const year = document.getElementById('publishYear')?.value || '';
  const mileage = document.getElementById('publishMileage')?.value || '';
  const fuel = document.getElementById('publishFuel')?.value || '';
  const trans = document.getElementById('publishTransmission')?.value || '';
  const descField = document.getElementById('publishDescription');
  
  if(!descField || descField.dataset.userEdited === "true") return;
  
  if (brand || model) {
    let desc = `Excelente ${brand} ${model}${year ? ' del año ' + year : ''}.`;
    if (mileage) desc += ` Cuenta con ${mileage} km.`;
    if (fuel || trans) desc += ` Motor ${fuel} y transmisión ${trans}.`;
    desc += `\n\nEl vehículo se encuentra en óptimas condiciones, listo para transferir. Respondo consultas por el chat.`;
    descField.value = desc.trim().replace(/\s+/g, ' ').replace(/\. \n/g, '.\n');
  }
}

async function loadUserFavoriteIds() {
  if (!getAuthToken()) return;
  try {
    const vehicles = await request('/favorites');
    userFavoriteIds = new Set((vehicles || []).map(v => v.id));
  } catch { /* silencioso */ }
}

async function checkAuth() {
  const tokenAtStart = getAuthToken();
  if (tokenAtStart) {
    try {
      currentUser = await request('/user');
      if (currentUser.profile?.is_admin) document.getElementById('navAdmin').style.display = 'inline';
      updateNav();
      loadCounts();
      request('/ping', { method: 'PUT' }).catch(() => {});
      loadUserFavoriteIds();
    } catch (err) {
      const stillSameToken = getAuthToken() === tokenAtStart;
      const unauthorized = err?.status === 401 || err?.status === 403;
      if (stillSameToken && unauthorized) {
        clearAuthToken();
      }
      currentUser = null;
    }
  }
  updateNav();
}

checkAuth().then(async () => {
  // Los links de email tienen prioridad de routing en el arranque.
  // Si fueron procesados, no sobrescribir la sección con home/section/vehicle.
  const emailLinkHandled = await handleEmailLinks();
  if (emailLinkHandled) return;

  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get('vehicle');
  const section = params.get('section');
  const profileId = params.get('profile');
  if (vehicleId) {
    window.history.replaceState({}, '', window.location.pathname);
    viewVehicle(parseInt(vehicleId));
  } else if (profileId) {
    window.history.replaceState({}, '', window.location.pathname);
    viewProfile(profileId);
  } else if (section === 'profile') {
    window.history.replaceState({}, '', window.location.pathname);
    if (currentUser?.id) viewProfile(currentUser.id);
    else showSection('home');
  } else if (section) {
    window.history.replaceState({}, '', window.location.pathname);
    showSection(section);
  } else {
    // Home is already visible by CSS; keep it stable to prevent layout shift.
    initHomeWithoutShift();
  }
});

async function loadCounts() {
  if (!currentUser) return;
  try {
    const data = await request(`/counts?ignoreChat=${currentConversationId || ''}`);
    if (!data) return;
    const notifBadge = document.getElementById('notificationsBadge');
    if (notifBadge) {
      notifBadge.textContent = data.notifications > 0 ? data.notifications : '';
      notifBadge.style.display = data.notifications > 0 ? 'inline' : 'none';
    }
    const msgBadge = document.getElementById('messagesBadge');
    if (msgBadge) {
      msgBadge.textContent = data.messages > 0 ? data.messages : '';
      msgBadge.style.display = data.messages > 0 ? 'inline' : 'none';
    }
  } catch {}
}

// Poll notification + unread messages count every 30 seconds
let notifInterval = setInterval(() => {
  if (currentUser) {
    loadCounts();
  }
}, 30000);

async function loadUnreadMessageCount() {
  try {
    const ignoreQuery = currentConversationId ? `?ignoreChat=${currentConversationId}` : '';
    const { count } = await request(`/messages/unread-count${ignoreQuery}`);
    const badge = document.getElementById('messagesBadge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
  } catch {}
}

function tryPublish() {
  if (currentUser) {
    showSection('publish');
  } else {
    showToast('Debes iniciar sesión para publicar', 'warning');
    showSection('login');
  }
}

function prefillSupportContact() {
  const contactEl = document.getElementById('supportContact');
  if (!contactEl) return;
  if (String(contactEl.value || '').trim()) return;

  const profilePhone = String(currentUser?.profile?.phone || '').trim();
  const userEmail = String(currentUser?.email || '').trim();
  const userUsername = String(currentUser?.username || '').trim();
  if (profilePhone) {
    contactEl.value = profilePhone;
    return;
  }
  if (userEmail) {
    contactEl.value = userEmail;
    return;
  }
  if (userUsername) {
    contactEl.value = `@${userUsername}`;
  }
}

async function submitAdminContactRequest(event) {
  event.preventDefault();
  const reason = String(document.getElementById('supportReason')?.value || '').trim();
  const contact = String(document.getElementById('supportContact')?.value || '').trim();
  const message = String(document.getElementById('supportMessage')?.value || '').trim();
  const captchaToken = getHCaptchaToken('supportCaptcha');

  if (!reason) {
    showToast('Seleccioná un motivo', 'error');
    return;
  }
  if (contact.length < 5) {
    showToast('Ingresá un contacto válido', 'error');
    return;
  }
  if (!captchaToken) {
    showToast('Completá el captcha para enviar el reclamo', 'error');
    ensureHCaptchaForSection('support');
    return;
  }

  const submitBtn = document.getElementById('supportSubmitBtn');
  const defaultText = submitBtn?.textContent || 'Enviar a administración';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
  }

  try {
    await request('/admin/contact-requests', {
      method: 'POST',
      body: JSON.stringify({ reason, contact, message, captchaToken })
    });
    showToast('Consulta enviada. Te va a contactar el administrador.', 'success');
    const messageEl = document.getElementById('supportMessage');
    const reasonEl = document.getElementById('supportReason');
    if (reasonEl) reasonEl.value = '';
    if (messageEl) messageEl.value = '';
    resetHCaptchaWidget('supportCaptcha');
  } catch (err) {
    showToast(err.message || 'No se pudo enviar la consulta', 'error');
    resetHCaptchaWidget('supportCaptcha');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultText;
    }
  }
}

initBrandFilters();
updateVehicleTypeOptions('publish');
updateVehicleTypeOptions('filter');
toggleBodyTypeField('publish');
toggleBodyTypeField('edit');
toggleDrivetrainField('publish');
toggleDrivetrainField('edit');

function autoFillTitle() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const version = getVersionValue('publish');
  const year = document.getElementById('publishYear')?.value || '';
  const title = `${brand} ${model} ${version} ${year}`.replace(/\s+/g, ' ').trim();
  const titleInput = document.getElementById('publishTitle');
  const preview = document.getElementById('publishTitlePreview');
  if (titleInput) titleInput.value = title;
  if (preview) {
    preview.textContent = title || 'Completá marca, modelo y año para ver el título';
    preview.style.color = title ? 'var(--text)' : 'var(--text-3)';
  }
}

document.getElementById('publishBrand')?.addEventListener('change', autoFillTitle);
document.getElementById('publishModel')?.addEventListener('change', autoFillTitle);
document.getElementById('publishVersion')?.addEventListener('input', autoFillTitle);
document.getElementById('publishYear')?.addEventListener('change', autoFillTitle);

// ─── PUBLISH YEAR SELECT ─────────────────────────────────────────────────────
function initYearSelect(selId, selectedYear) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const currentYear = new Date().getFullYear();
  sel.innerHTML = '<option value="">Seleccionar año</option>';
  for (let y = currentYear; y >= 1990; y--) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    sel.appendChild(opt);
  }
  if (selectedYear) sel.value = String(selectedYear);
}

function initPublishYearSelect() { initYearSelect('publishYear'); }

// ─── FORCE AUTO-GENERATE DESCRIPTION ────────────────────────────────────────
function forceAutoGenPublishDescription() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const version = getVersionValue('publish');
  const year = document.getElementById('publishYear')?.value || '';
  const fuel = document.getElementById('publishFuel')?.value || '';
  const transmission = document.getElementById('publishTransmission')?.value || '';
  const mileage = document.getElementById('publishMileage')?.value || '';
  const vehicleType = document.getElementById('publishVehicleType')?.value || 'auto';
  const bodyType = document.getElementById('publishBodyType')?.value || '';
  const province = document.getElementById('publishProvince')?.value || '';
  const city = document.getElementById('publishCity')?.value || '';
  const acceptsTrade = document.getElementById('publishAcceptsTrade')?.checked || false;
  const acceptsFinancing = document.getElementById('publishAcceptsFinancing')?.checked || false;

  const parts = [];

  const vehicleName = [brand, model, version].filter(Boolean).join(' ');
  if (vehicleName) {
    const yearStr = year ? ` ${year}` : '';
    const typeLabels = { auto: 'Auto', utilitario: 'Utilitario', moto: 'Moto', cuatri: 'Cuatriciclo', camion: 'Camión' };
    const typeLabel = typeLabels[vehicleType] || 'Vehículo';
    const bodyLabel = bodyType ? ` ${bodyType}` : '';
    parts.push(`${typeLabel}${bodyLabel} ${vehicleName}${yearStr} en excelente estado de conservación.`);
  }

  const techParts = [];
  if (fuel) techParts.push(`motor a ${fuel}`);
  if (transmission) techParts.push(`caja ${transmission.toLowerCase()}`);
  if (techParts.length) parts.push(`Cuenta con ${techParts.join(' y ')}.`);

  if (mileage) {
    const km = parseInt(mileage, 10);
    if (!isNaN(km)) {
      if (km === 0) parts.push('Sin kilómetros, 0 km.');
      else parts.push(`Kilometraje: ${km.toLocaleString('es-AR')} km.`);
    }
  }

  const locationParts = [city, province].filter(Boolean);
  if (locationParts.length) parts.push(`Ubicado en ${locationParts.join(', ')}.`);

  const extras = [];
  if (acceptsTrade) extras.push('se aceptan permutas');
  if (acceptsFinancing) extras.push('se ofrece financiación');
  if (extras.length) parts.push(`Consultas bienvenidas — ${extras.join(', ')}.`);

  if (!parts.length) {
    showToast('Completá al menos marca, modelo o año para generar la descripción', 'info');
    return;
  }

  const textarea = document.getElementById('publishDescription');
  if (textarea) {
    textarea.value = parts.join(' ');
    textarea.dispatchEvent(new Event('input'));
    showToast('Descripción generada', 'success');
  }
}

// ─── PUBLISH PREVIEW MODAL ───────────────────────────────────────────────────
function setPublishPreviewOpenState(isOpen) {
  document.body.classList.toggle('publish-preview-open', !!isOpen);
}

function openPublishPreviewModal() {
  setPublishPreviewOpenState(true);
  openAccessibleModal('publishPreviewModal');
  const contentEl = document.getElementById('publishPreviewContent');
  if (contentEl) contentEl.innerHTML = '<div class="publish-preview-loading">Preparando vista previa...</div>';
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const version = getVersionValue('publish');
  const year = document.getElementById('publishYear')?.value || '';
  const title = document.getElementById('publishTitle')?.value || [brand, model, version, year].filter(Boolean).join(' ');
  const rawPrice = parseFloat(document.getElementById('publishPrice')?.value) || 0;
  const currency = document.getElementById('publishCurrency')?.value || 'ARS';
  const fuel = document.getElementById('publishFuel')?.value || '';
  const transmission = document.getElementById('publishTransmission')?.value || '';
  const mileage = document.getElementById('publishMileage')?.value || '';
  const province = document.getElementById('publishProvince')?.value || '';
  const city = document.getElementById('publishCity')?.value || '';
  const description = document.getElementById('publishDescription')?.value || '';
  const vehicleType = document.getElementById('publishVehicleType')?.value || '';
  const bodyType = document.getElementById('publishBodyType')?.value || '';

  const priceDisplay = rawPrice > 0
    ? `${currency} ${rawPrice.toLocaleString('es-AR')}`
    : '—';

  const locationDisplay = [city, province].filter(Boolean).join(', ') || '—';

  const firstImage = uploadedImages.length > 0 ? uploadedImages[0] : null;
  const imgHtml = firstImage
    ? `<img src="${firstImage.preview || ''}" alt="Preview" decoding="async" loading="eager" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:1rem;">`
    : `<div style="width:100%;height:120px;background:var(--dark-3);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--text-3);margin-bottom:1rem;font-size:0.9rem;">Sin fotos añadidas</div>`;

  const badges = [];
  if (vehicleType) badges.push(vehicleType);
  if (bodyType) badges.push(bodyType);
  if (fuel) badges.push(fuel);
  if (transmission) badges.push(transmission);

  const badgesHtml = badges.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.85rem;">${badges.map(b => `<span style="background:var(--dark-3);border:1px solid var(--border);border-radius:99px;padding:0.2rem 0.65rem;font-size:0.78rem;color:var(--text-2);">${escapeHtml(b)}</span>`).join('')}</div>`
    : '';

  const detailRows = [
    year ? ['Año', escapeHtml(year)] : null,
    brand ? ['Marca', escapeHtml(brand)] : null,
    model ? ['Modelo', escapeHtml(model)] : null,
    mileage ? ['Kilometraje', `${parseInt(mileage).toLocaleString('es-AR')} km`] : null,
    locationDisplay !== '—' ? ['Ubicación', escapeHtml(locationDisplay)] : null,
  ].filter(Boolean);

  const rowsHtml = detailRows.map(([k, v]) =>
    `<div style="display:flex;justify-content:space-between;padding:0.45rem 0;border-bottom:1px solid var(--border);font-size:0.88rem;">
      <span style="color:var(--text-2);">${k}</span>
      <span style="font-weight:500;">${v}</span>
    </div>`
  ).join('');

  const descHtml = description
    ? `<div style="margin-top:1rem;"><p style="font-size:0.85rem;color:var(--text-2);margin-bottom:0.4rem;">Descripción</p><p style="font-size:0.9rem;line-height:1.55;white-space:pre-wrap;">${escapeHtml(description)}</p></div>`
    : '';

  const photosCount = uploadedImages.length;
  const photosNote = photosCount > 1
    ? `<p style="font-size:0.78rem;color:var(--text-3);margin-top:0.5rem;">+ ${photosCount - 1} foto${photosCount - 1 > 1 ? 's' : ''} más</p>`
    : '';

  const content = `
    ${imgHtml}
    ${photosNote}
    <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.4rem;">${escapeHtml(title || 'Sin título')}</h3>
    <p style="font-size:1.35rem;font-weight:800;color:var(--primary);margin-bottom:0.75rem;">${priceDisplay}</p>
    ${badgesHtml}
    ${rowsHtml}
    ${descHtml}
  `;

  if (contentEl) contentEl.innerHTML = content;
}

function closePublishPreviewModal() {
  setPublishPreviewOpenState(false);
  closeAccessibleModal('publishPreviewModal');
}

async function confirmPublishFromPreview() {
  closePublishPreviewModal();
  await _doPublish();
}

// ─── PUBLISH STEPPER ─────────────────────────────────────────────────────────
function scrollToPublishSection(anchorId) {
  const el = document.getElementById(anchorId);
  if (!el) return;
  const navbar = document.querySelector('.navbar');
  const offset = navbar ? navbar.getBoundingClientRect().height + 16 : 88;
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

function initPublishStepperObserver() {
  const anchors = [
    { id: 'publishStepVehicle', step: 1 },
    { id: 'publishStepPrice', step: 2 },
    { id: 'publishStepPhotos', step: 3 },
    { id: 'publishStepDescription', step: 4 },
  ];

  const setActiveStep = (stepNum) => {
    document.querySelectorAll('#publishStepper .publish-step').forEach(el => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle('active', s === stepNum);
      el.classList.toggle('completed', s < stepNum);
    });
    document.querySelectorAll('#publishStepper .step-connector').forEach((el, i) => {
      el.classList.toggle('completed', i + 1 < stepNum);
    });
  };

  const observers = [];
  let currentVisibleStep = 1;

  anchors.forEach(({ id, step }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          currentVisibleStep = step;
          setActiveStep(step);
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
    obs.observe(el);
    observers.push(obs);
  });

  return observers;
}

// MOBILE ACCOUNT MENU
function toggleMobileMenu() {
  const menu = document.getElementById('mobileAccountMenu');
  if (!menu) return;
  if (menu.style.display === 'none' || menu.style.display === '' || !menu.classList.contains('is-open')) {
    mobileMenuTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const userNameEl = document.getElementById('mobileMenuUsername');
    if (userNameEl) userNameEl.textContent = currentUser?.username || '';
    const adminItem = document.getElementById('mobileMenuAdmin');
    if (adminItem) adminItem.style.display = currentUser?.profile?.is_admin ? 'flex' : 'none';
    menu.style.display = 'flex';
    menu.removeAttribute('inert');
    menu.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => menu.classList.add('is-open'));
    setBodyScrollLocked(true);
    requestAnimationFrame(() => {
      const first = menu.querySelector('.mobile-menu-item, .mobile-menu-header button');
      (first || menu).focus?.();
    });
    loadLucideIcons();
  } else {
    closeMobileMenu();
  }
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileAccountMenu');
  if (!menu) return;
  const returnTarget = (mobileMenuTrigger && document.contains(mobileMenuTrigger)) ? mobileMenuTrigger : null;
  const fallbackTarget = document.querySelector('.bottom-nav .bottom-nav-item:last-child, .navbar .nav-brand');
  const focusTarget = returnTarget || (fallbackTarget instanceof HTMLElement ? fallbackTarget : null);
  const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (activeEl && menu.contains(activeEl)) {
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    else activeEl.blur();
  }
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  menu.setAttribute('inert', '');
  setTimeout(() => {
    if (!menu.classList.contains('is-open')) menu.style.display = 'none';
  }, 240);
  setBodyScrollLocked(modalStack.length > 0);
  if (focusTarget && document.contains(focusTarget)) {
    requestAnimationFrame(() => {
      if (document.contains(focusTarget)) focusTarget.focus({ preventScroll: true });
    });
  }
  mobileMenuTrigger = null;
}

let followingFeedPage = 1;
let followingFeedLoading = false;

async function loadFollowingFeed(page = 1, reset = false) {
  if (followingFeedLoading) return;
  followingFeedLoading = true;
  const container = document.getElementById('followingFeedList');
  const loadingEl = document.getElementById('followingFeedLoading');
  if (reset) {
    container.innerHTML = '';
    followingFeedPage = 1;
  }
  if (loadingEl) loadingEl.style.display = 'block';
  try {
    const { vehicles = [], total = 0 } = await request(`/following-feed?page=${page}`);
    if (loadingEl) loadingEl.style.display = 'none';
    if (!vehicles.length && page === 1) {
      container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg><h3>Tu feed está vacío</h3><p>Todavía no seguís a ningún vendedor. Explorá los perfiles y seguí a quienes te interesen para ver sus publicaciones acá.</p></div>';
      followingFeedLoading = false;
      return;
    }
    const html = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)" aria-label="Agregar a favoritos"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location">📍 ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="flex-shrink:0;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <div class="vehicle-seller-info">
                <div class="vehicle-seller-name-row">
                <span>${escapeHtml(v.seller_verified && v.seller_dealership ? v.seller_dealership : (v.seller_first_name && v.seller_last_name ? `${v.seller_first_name} ${v.seller_last_name}` : (v.seller_name || 'Anónimo')))}</span>
                ${v.seller_verified ? verifiedCheckIcon() : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    container.insertAdjacentHTML('beforeend', html);
    applyCardCascade(container);
    followingFeedPage = page;
    // Infinite scroll: if more pages, set up observer
    if (vehicles.length === 12 && total > page * 12) {
      setupFollowingFeedScroll();
    }
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    showToast(err.message, 'error');
  }
  followingFeedLoading = false;
}

function setupFollowingFeedScroll() {
  const loadingEl = document.getElementById('followingFeedLoading');
  if (!loadingEl) return;
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !followingFeedLoading) {
      observer.disconnect();
      loadFollowingFeed(followingFeedPage + 1);
    }
  }, { threshold: 0.1 });
  observer.observe(loadingEl);
}

async function loadHomeRecent() {
  const container = document.getElementById('homeRecentVehicles');
  if (!container) return;
  if (homeRecentLoadedAt && (Date.now() - homeRecentLoadedAt) < 120000 && container.children.length > 0) return;
  // Show skeletons
  container.innerHTML = Array(3).fill().map(() => `
    <div class="vehicle-card" style="padding:1rem;">
      <div class="skeleton skeleton-img"></div>
      <div style="padding:1rem 0;">
        <div class="skeleton skeleton-text" style="width:70%;margin-bottom:0.5rem;"></div>
        <div class="skeleton skeleton-text" style="width:40%;"></div>
      </div>
    </div>
  `).join('');
  try {
    const data = await request('/vehicles?limit=6&sort=newest');
    const vehicles = data.vehicles || data;
    if (!vehicles?.length) {
      container.innerHTML = `
        <div class="home-recent-empty">
          <h4>Por ahora no hay destacados recientes</h4>
          <p>Explora el catalogo completo o publica tu vehiculo para empezar a recibir consultas.</p>
          <div class="home-recent-empty-actions">
            <button class="btn btn-secondary" onclick="showSection('vehicles')">Ver vehiculos</button>
            <button class="btn btn-ghost" onclick="tryPublish()">Publicar gratis</button>
          </div>
        </div>
      `;
      return;
    }
    container.innerHTML = vehicles.slice(0, 3).map((v, idx) => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${thumbUrl(v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url)}" class="vehicle-image" alt="${escapeHtml(v.title)}" width="520" height="325" decoding="async" ${idx === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} onerror="this.src=PLACEHOLDER_IMG">
          <div class="vehicle-img-overlay"></div>
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${buildVehicleStatusBadges(v)}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)" aria-label="Agregar a favoritos"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            ${formatPesos(v.price, v) ? `<p class="vehicle-price">${formatPesos(v.price, v)}</p><p class="vehicle-price-ars">USD ${formatNumber(v.price)}</p>` : `<p class="vehicle-price">USD ${formatNumber(v.price)}</p>`}
          </div>
          ${buildVehicleMetaHtml(v)}
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <div class="avatar-tiny">${(v.seller_verified ? v.seller_dealership : (v.seller_first_name || v.seller_name))?.charAt(0)?.toUpperCase()}</div>
              <div class="vehicle-seller-info">
                <div class="vehicle-seller-name-row">
                <span>${escapeHtml(v.seller_verified && v.seller_dealership ? v.seller_dealership : (v.seller_first_name && v.seller_last_name ? `${v.seller_first_name} ${v.seller_last_name}` : (v.seller_name || 'Anónimo')))}</span>
                ${v.seller_verified ? verifiedCheckIcon() : ''}
                </div>
              </div>
            </div>
            <div class="vehicle-views">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ${v.view_count || 0}
            </div>
          </div>
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
    homeRecentLoadedAt = Date.now();
  } catch (err) {
    container.innerHTML = `
      <div class="home-recent-empty">
        <h4>No pudimos cargar los destacados</h4>
        <p>Probá nuevamente en unos segundos.</p>
        <div class="home-recent-empty-actions">
          <button class="btn btn-secondary btn-sm" onclick="loadHomeRecent()">Reintentar</button>
        </div>
      </div>
    `;
    showToast(err?.message || 'No se pudieron cargar los destacados', 'error');
  }
}

function applyCardCascade(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 768px)').matches) return;
  container.querySelectorAll('.vehicle-card[onclick]').forEach((card, i) => {
    card.style.animationDelay = `${i * 65}ms`;
  });
}

async function loadPublicStats() {
  if (publicStatsLoadedAt && (Date.now() - publicStatsLoadedAt) < 300000) return;
  try {
    const data = await request('/stats/public');
    const ve = document.getElementById('statVehicles');
    const us = document.getElementById('statUsers');
    if (ve) ve.textContent = data.active_vehicles?.toLocaleString('es-AR') || '—';
    if (us) us.textContent = data.total_users?.toLocaleString('es-AR') || '—';
    publicStatsLoadedAt = Date.now();
  } catch { /* silencioso */ }
}
// Defer non-critical fetches until the browser is idle to free up the main thread
const _scheduleIdle = window.requestIdleCallback
  ? (fn) => requestIdleCallback(fn, { timeout: 3000 })
  : (fn) => setTimeout(fn, 500);
_scheduleIdle(() => {
  loadPublicStats();
  loadDolarRate();
  dolarRateInterval = setInterval(loadDolarRate, 10 * 60 * 1000);
});

async function loadSimilarVehicles(vehicleId) {
  const grid = document.getElementById('similarVehiclesGrid');
  if (!grid) return;
  try {
    const data = await request(`/vehicles/${vehicleId}/similar`);
    const vehicles = data?.vehicles || [];
    if (!vehicles.length) {
      document.getElementById('similarVehiclesSection')?.remove();
      return;
    }
    grid.innerHTML = vehicles.map(v => `
      <div class="similar-card" onclick="viewVehicle(${v.id})">
        <div class="similar-card-img">
          ${v.image
            ? `<img src="${escapeHtml(v.image)}" alt="${escapeHtml(v.title)}" loading="lazy">`
            : `<div class="similar-no-img"><svg width="32" height="32" viewBox="0 0 24 24" fill="var(--text-3)"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>`
          }
        </div>
        <div class="similar-card-body">
          <p class="similar-card-title">${escapeHtml(v.title)}</p>
          <p class="similar-card-price">USD ${formatNumber(v.price)}</p>
          ${formatPesos(v.price, v) ? `<p class="similar-card-ars">${formatPesos(v.price, v)}</p>` : ''}
          <p class="similar-card-meta">${v.year} · ${formatNumber(v.mileage)} km · ${escapeHtml(v.city || '')}</p>
        </div>
      </div>
    `).join('');
  } catch {
    document.getElementById('similarVehiclesSection')?.remove();
  }
}
