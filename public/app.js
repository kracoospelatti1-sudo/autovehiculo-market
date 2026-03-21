let currentUser = null;
let currentVehicleId = null;
let vehicleMapInstance = null;
let currentConversationId = null;
let currentProfileId = null;
let pollingInterval = null;
let searchTimeout = null;
let uploadedImages = [];
let reportVehicleId = null;
let rateConversationId = null;
let rateRecipientId = null;
let rateVehicleId = null;
let lastMessageId = 0;
let isLoadingMessages = false;
let onlineStatusInterval = null;
let pollCount = 0;

const API_URL = '/api';

const carBrands = {
  'Acura': ['ILX', 'MDX', 'RDX', 'RLX', 'TLX', 'TSX', 'ZDX'],
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Giulietta', 'Giulia Quadrifoglio', 'Tonale', '4C'],
  'Aston Martin': ['DB11', 'DB12', 'DBX', 'DBS', 'Vantage', 'Vanquish', 'Valkyrie'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT', 'R8'],
  'BMW': ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 4', 'Serie 5', 'Serie 7', 'X1', 'X3', 'X5', 'X7', 'Z4', 'i3', 'i4', 'iX'],
  'Chevrolet': ['Aveo', 'Camaro', 'Colorado', 'Corvette', 'Cruze', 'Equinox', 'Malibu', 'Onix', 'Silverado', 'Sonic', 'Spark', 'Suburban', 'Tahoe', 'Traverse', 'Trax'],
  'Citroën': ['C3', 'C4', 'C4 Cactus', 'C5 Aircross', 'Berlingo'],
  'Ford': ['Bronco', 'Bronco Sport', 'EcoSport', 'Edge', 'Escape', 'Everest', 'Explorer', 'F-150', 'Fiesta', 'Focus', 'Fusion', 'Mustang', 'Ranger', 'Territory'],
  'Honda': ['Accord', 'Civic', 'City', 'CR-V', 'HR-V', 'Odyssey', 'Pilot', 'WR-V'],
  'Hyundai': ['Accent', 'Creta', 'Elantra', 'Ioniq 5', 'Kona', 'Palisade', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
  'Jeep': ['Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  'Kia': ['Carnival', 'Cerato', 'EV6', 'Forte', 'K5', 'Niro', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Sportage', 'Stinger', 'Telluride'],
  'Land Rover': ['Defender', 'Discovery', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar'],
  'Lexus': ['CT', 'ES', 'GS', 'IS', 'LS', 'NX', 'RX', 'RZ', 'UX'],
  'Mazda': ['2', '3', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-9', 'MX-30', 'MX-5'],
  'Mercedes-Benz': ['Clase A', 'Clase C', 'Clase E', 'Clase G', 'GLA', 'GLC', 'GLE', 'GLS', 'EQS'],
  'Mini': ['Cooper', 'Cooper Clubman', 'Cooper Countryman', 'Electric'],
  'Mitsubishi': ['ASX', 'Eclipse Cross', 'L200', 'Lancer', 'Outlander', 'Xpander'],
  'Nissan': ['Altima', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Qashqai', 'Rogue', 'Sentra', 'Versa', 'X-Trail'],
  'Peugeot': ['208', '2008', '3008', '5008', '308', '508', 'Rifter'],
  'Porsche': ['911', '718 Boxster', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
  'Renault': ['Arkana', 'Captur', 'Clio', 'Duster', 'Kwid', 'Logan', 'Megane', 'Oroch', 'Sandero', 'Stepway'],
  'Seat': ['Arona', 'Ateca', 'Ibiza', 'Leon', 'Tarraco'],
  'Skoda': ['Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Scala', 'Superb'],
  'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'],
  'Suzuki': ['Baleno', 'Ignis', 'Jimny', 'S-Presso', 'Swift', 'Vitara', 'XL7'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
  'Toyota': ['4Runner', 'Camry', 'Corolla', 'Corolla Cross', 'C-HR', 'Highlander', 'Hilux', 'Land Cruiser', 'Prius', 'RAV4', 'Sequoia', 'Tacoma', 'Tundra', 'Yaris'],
  'Volkswagen': ['Amarok', 'Arteon', 'Gol', 'Golf', 'Jetta', 'Nivus', 'Passat', 'Polo', 'T-Cross', 'Taos', 'Tiguan', 'Virtus', 'ID.4'],
  'Volvo': ['C40', 'EX30', 'XC40', 'XC60', 'XC90', 'S60', 'S90']
};

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

// Init province/city selects when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupProvinceCity('publishProvince', 'publishCity');
  setupProvinceCity('editProvince', 'editCity');
});


async function initVehicleMap(city, province) {
  if (!window.L) return;
  if (vehicleMapInstance) { vehicleMapInstance.remove(); vehicleMapInstance = null; }
  const el = document.getElementById('vehicleMap');
  if (!el) return;
  try {
    // Limpiar nombre de provincia: quitar paréntesis y su contenido (ej: "Buenos Aires (Prov.)" → "Buenos Aires")
    const cleanProvince = province ? province.replace(/\s*\(.*?\)/g, '').trim() : '';
    const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'ar', addressdetails: '1' });
    if (cleanProvince) {
      params.set('city', city);
      params.set('state', cleanProvince);
      params.set('country', 'Argentina');
    } else {
      params.set('q', `${city}, Argentina`);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    const data = await res.json();
    if (!data?.length) { el.parentElement.style.display = 'none'; return; }
    const { lat, lon, display_name } = data[0];
    vehicleMapInstance = L.map('vehicleMap', { zoomControl: true, scrollWheelZoom: false }).setView([parseFloat(lat), parseFloat(lon)], 12);
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

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.error || 'Error');
  return data;
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
    section.classList.add('fade-in');
  }
  if (sectionId === 'vehicles') loadVehicles(1);
  else if (sectionId === 'my-vehicles') loadMyVehicles();
  else if (sectionId === 'messages') { document.querySelector('.messages-container')?.classList.remove('chat-open'); loadConversations(); }
  else if (sectionId === 'favorites') loadFavorites();
  else if (sectionId === 'notifications') loadNotifications();
  else if (sectionId === 'admin') loadAdmin();
  else if (sectionId === 'publish') { uploadedImages = []; renderImagePreviews(); }
  if (sectionId !== 'messages') stopPolling();
  if (sectionId !== 'messages') currentConversationId = null;
  if (sectionId !== 'vehicle-detail') currentVehicleId = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Registrando...';
  
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  try {
    const data = await request('/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    updateNav();
    showToast('Registro exitoso. ¡Bienvenido!', 'success');
    showSection('home');
  } catch (err) { showToast(err.message, 'error'); }
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
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    updateNav();
    showToast('¡Bienvenido!', 'success');
    showSection('home');
  } catch (err) { showToast(err.message, 'error'); }
  finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  uploadedImages = [];
  clearInterval(heartbeatInterval);
  clearInterval(notifInterval);
  stopPolling();
  updateNav();
  showToast('Sesión cerrada', 'success');
  showSection('home');
}

// VEHICLES
async function loadVehicles(page = 1) {
  const container = document.getElementById('vehiclesList');
  if (page === 1 && container) {
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
    const search = document.getElementById('searchInput')?.value;
    if (search) params.append('search', search);
    ['brand', 'model', 'minPrice', 'maxPrice', 'minYear', 'maxYear', 'minMileage', 'maxMileage', 'fuel', 'transmission', 'city', 'province', 'sort'].forEach(key => {
      const el = document.getElementById('filter' + key.charAt(0).toUpperCase() + key.slice(1));
      if (el?.value) params.append(key, el.value);
    });
    params.append('page', page);
    const { vehicles, total } = await request(`/vehicles?${params}`);
    document.getElementById('vehiclesCount').textContent = `${total} vehículo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
    if (!vehicles?.length) {
      container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg><h3>No hay vehículos</h3><p>Sé el primero en publicar</p></div>';
      return;
    }
    container.innerHTML = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'">
          <span class="vehicle-badge">${v.year}</span>
          ${localStorage.getItem('token') ? `<button class="favorite-btn ${v.is_favorite ? 'active' : ''}" onclick="toggleFavorite(${v.id}, event)"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}${v.city ? ` · 📍 ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}` : ''}</p>
          <p class="vehicle-price">$${formatNumber(v.price)}</p>
          <div class="vehicle-meta">
            <span>${formatNumber(v.mileage || 0)} km</span>
            <span>${v.fuel || 'N/A'}</span>
            ${v.transmission ? `<span>${escapeHtml(v.transmission)}</span>` : ''}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;">
            <div class="vehicle-views" style="margin-top:0;"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> ${v.view_count || 0} vistas</div>
            <div style="font-size:0.8rem;color:var(--text-2);display:flex;align-items:center;gap:0.25rem;flex-wrap:wrap;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              ${escapeHtml(v.seller_name || 'Anónimo')}
              ${v.seller_verified ? verifiedBadge() : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('');
    renderPagination(total, page);
  } catch (err) { showToast(err.message, 'error'); }
}

function renderPagination(total, current) {
  const perPage = 12;
  const pages = Math.ceil(total / perPage);
  const container = document.getElementById('vehiclesPagination');
  if (pages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) html += `<button class="${i === current ? 'active' : ''}" onclick="loadVehicles(${i})">${i}</button>`;
  container.innerHTML = html;
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadVehicles(1), 500);
}

function toggleFilters() {
  const panel = document.getElementById('filtersPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function applyFilters() { loadVehicles(1); }

function clearFilters() {
  ['filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxYear', 'filterBrand', 'filterModel', 'filterFuel', 'filterTransmission', 'filterCity', 'filterMaxMileage', 'filterProvince', 'filterSort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const filterModelEl = document.getElementById('filterModel');
  if (filterModelEl) filterModelEl.innerHTML = '<option value="">Todos</option>';
  loadVehicles(1);
}

function initBrandFilters() {
  const select = document.getElementById('filterBrand');
  if (!select || select.options.length > 1) return;
  const provinceSelect = document.getElementById('filterProvince');
  if (provinceSelect && provinceSelect.options.length <= 1) {
    AR_PROVINCES.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      provinceSelect.appendChild(opt);
    });
  }
  Object.keys(carBrands).sort().forEach(brand => {
    const opt = document.createElement('option');
    opt.value = brand;
    opt.textContent = brand;
    select.appendChild(opt);
  });
  const publishBrand = document.getElementById('publishBrand');
  if (publishBrand && publishBrand.options.length <= 1) {
    Object.keys(carBrands).sort().forEach(brand => {
      const opt = document.createElement('option');
      opt.value = brand;
      opt.textContent = brand;
      publishBrand.appendChild(opt);
    });
  }
}

function updateFilterModels() {
  const brand = document.getElementById('filterBrand').value;
  const modelSelect = document.getElementById('filterModel');
  modelSelect.innerHTML = '<option value="">Todos</option>';
  if (brand && carBrands[brand]) carBrands[brand].forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
}

function updatePublishModels() {
  const brand = document.getElementById('publishBrand').value;
  const modelSelect = document.getElementById('publishModel');
  modelSelect.innerHTML = '<option value="">Seleccionar modelo</option>';
  if (brand && carBrands[brand]) carBrands[brand].forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
}

// VEHICLE DETAIL
async function viewVehicle(id) {
  currentVehicleId = id;
  try {
    const vehicle = await request(`/vehicles/${id}`);
    const isOwner = currentUser?.id === vehicle.seller_id || currentUser?.profile?.is_admin;
    const isLoggedIn = !!localStorage.getItem('token');
    let isFavorite = false;
    if (isLoggedIn) {
      try { const r = await request(`/favorites/${id}/check`); isFavorite = r.favorited; } catch {}
    }

    const images = vehicle.vehicle_images?.length ? vehicle.vehicle_images : [{ url: vehicle.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=600&fit=crop' }];
    const mainImgUrl = images[0].url;

    const content = document.getElementById('vehicleDetailContent');
    content.innerHTML = `
      <div class="detail-container">
        <div class="detail-gallery desktop-only">
          <div class="main-image">
            <img src="${mainImgUrl}" id="detailMainImage" alt="Vehículo" style="cursor:pointer;" onclick="openLightbox(window._detailImages, window._detailImages.indexOf(this.src) >= 0 ? window._detailImages.indexOf(this.src) : 0)">
          </div>
          <div class="thumbnail-list" id="imageThumbnails">
            ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" class="${i === 0 ? 'active' : ''}" data-url="${escapeHtml(img.url || '')}" data-index="${i}" onclick="document.getElementById('detailMainImage').src=this.dataset.url;this.parentElement.querySelectorAll('img').forEach(x=>x.classList.remove('active'));this.classList.add('active')">`).join('')}
          </div>
        </div>
        <div class="mobile-only" style="overflow-x: auto; scroll-snap-type: x mandatory; gap: 0.5rem; padding-bottom: 0.5rem; margin-bottom: 1.5rem; display:flex;">
          ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" style="flex: 0 0 92%; scroll-snap-align: center; height: 350px; object-fit: cover; border-radius: var(--radius-lg); cursor:pointer;" onclick="openLightbox(window._detailImages, ${i})">`).join('')}
        </div>
        <div class="detail-info" id="vehicleDetail">
          ${vehicle.status === 'sold' ? '<div class="sold-banner">VENDIDO</div>' : vehicle.status === 'paused' ? '<div class="sold-banner" style="border-color:rgba(245,158,11,0.3);color:var(--primary);background:rgba(245,158,11,0.08);">PAUSADO</div>' : ''}
          <h1>${escapeHtml(vehicle.title)}</h1>
          <p class="detail-subtitle">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</p>
          <p class="detail-price">$${formatNumber(vehicle.price)}</p>
          <div class="detail-specs">
            <div class="spec-card"><div class="label">Año</div><div class="value">${vehicle.year}</div></div>
            <div class="spec-card"><div class="label">Kilometraje</div><div class="value">${formatNumber(vehicle.mileage || 0)} km</div></div>
            <div class="spec-card"><div class="label">Combustible</div><div class="value">${vehicle.fuel || 'N/A'}</div></div>
            <div class="spec-card"><div class="label">Transmisión</div><div class="value">${vehicle.transmission || 'N/A'}</div></div>
            <div class="spec-card"><div class="label">Ciudad</div><div class="value">${vehicle.city || 'No especificada'}</div></div>
            ${vehicle.province ? `<div class="spec-card"><div class="label">Provincia</div><div class="value">${escapeHtml(vehicle.province.replace(/\s*\(.*?\)/g,'').trim())}</div></div>` : ''}
          </div>
          ${vehicle.description ? `<div class="detail-description"><h4>Descripción</h4><p>${escapeHtml(vehicle.description)}</p></div>` : ''}
          ${vehicle.city ? `
            <div class="detail-map-section">
              <h4 style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--text-2);display:flex;align-items:center;gap:0.4rem;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                Ubicación: ${escapeHtml(vehicle.city)}
              </h4>
              <div id="vehicleMap" class="vehicle-map"></div>
            </div>
          ` : ''}
          <div class="seller-card">
            <div class="seller-avatar">${vehicle.seller_profile?.avatar_url ? `<img src="${escapeHtml(vehicle.seller_profile.avatar_url || '')}" alt="">` : (vehicle.seller_name?.charAt(0)?.toUpperCase() || '?')}</div>
            <div class="seller-info">
              <div class="seller-name-row">
                <h4 onclick="viewProfile(${vehicle.seller_id})" style="cursor:pointer;color:var(--primary-light);">${escapeHtml(vehicle.seller_name)}</h4>
                ${vehicle.seller_verified ? verifiedBadge() : ''}
              </div>
              ${vehicle.seller_rating ? `<div class="rating">${'★'.repeat(Math.round(vehicle.seller_rating))}${'☆'.repeat(5-Math.round(vehicle.seller_rating))} <span>(${vehicle.seller_ratings_count} reseñas)</span></div>` : '<div class="rating"><span style="color:var(--text-secondary)">Sin reseñas</span></div>'}
              <div class="seller-stats">
                <span>${vehicle.seller_vehicles_count} vehículos</span>
                <span style="margin-left:0.75rem;">${vehicle.seller_followers_count || 0} seguidores</span>
              </div>
            </div>
          </div>
          
          ${vehicle.accepts_trade && isLoggedIn && !isOwner && vehicle.status === 'active' ? `
            <div style="margin-top:1.5rem;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-md);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div>
                <div style="font-weight:600;font-size:0.95rem;">🔄 Este vendedor acepta permutas</div>
                <div style="font-size:0.82rem;color:var(--text-2);margin-top:2px;">Podés proponer tu vehículo a cambio</div>
              </div>
              <button class="btn btn-primary" style="white-space:nowrap;" onclick="openTradeModal(${vehicle.id})">Proponer permuta</button>
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
                </div>
                <div class="chat-input-row" style="display:flex;gap:0.5rem;">
                  <input type="text" id="quickMsgInput" placeholder="Envía un mensaje..." style="flex:1;">
                  <button class="btn btn-primary" onclick="handleQuickMessage(${vehicle.id})">Enviar</button>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="detail-actions" style="margin-top:1.5rem;display:flex;gap:1rem;flex-direction:column;">
            <button class="btn btn-secondary" onclick="shareVehicle(${vehicle.id}, ${JSON.stringify(escapeHtml(vehicle.title))})"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right:0.5rem;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>Compartir</button>
            ${isLoggedIn ? `<button class="btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}" onclick="toggleFavorite(${vehicle.id}, event)"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" style="margin-right:0.5rem;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${isFavorite ? 'En favoritos' : 'Guardar en favoritos'}</button>` : ''}
            ${isLoggedIn && !isOwner ? `<button class="btn btn-ghost" onclick="openReportModal(${vehicle.id})" style="color:var(--text-3);">Reportar esta publicación</button>` : ''}
            ${!isLoggedIn ? `<button class="btn btn-primary" style="width:100%" onclick="showSection('login')">Inicia sesión para contactar</button>` : ''}
          </div>
        </div>
      </div>
    `;
    window._detailImages = images.map(img => img.url);
    if (currentVehicleId !== id) return;
    showSection('vehicle-detail');
    if (vehicle.city) initVehicleMap(vehicle.city, vehicle.province);

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
  const files = Array.from(e.target.files).slice(0, 5 - uploadedImages.length);
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

async function uploadImages() {
  const urls = [];
  for (let i = 0; i < uploadedImages.length; i++) {
    const img = uploadedImages[i];
    if (img.url) { urls.push(img.url); continue; }
    const formData = new FormData();
    formData.append('image', img.file);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
    if (!res.ok) throw new Error(`Error al subir la imagen ${i + 1}`);
    const data = await res.json();
    urls.push(data.url);
  }
  return urls;
}

function renderImagePreviews() {
  const container = document.getElementById('imagePreview');
  container.innerHTML = uploadedImages.map((img, i) => `
    <div class="preview-item ${i === 0 ? 'primary' : ''}">
      <img src="${escapeHtml(img.preview || img.url || '')}" alt="">
      <button class="preview-remove" onclick="removeImage(${i})">&times;</button>
    </div>
  `).join('');
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

async function handlePublish(e) {
  e.preventDefault();
  const btn = document.getElementById('publishBtn');
  btn.disabled = true;
  btn.textContent = 'Publicando...';
  try {
    const province = document.getElementById('publishProvince').value;
    const city = document.getElementById('publishCity').value;
    if (!province || !city) {
      showToast('Seleccioná la provincia y la ciudad', 'error');
      btn.disabled = false;
      btn.textContent = 'Publicar Vehículo';
      return;
    }
    if (!uploadedImages.length) {
      showToast('Agregá al menos una imagen del vehículo', 'error');
      btn.disabled = false;
      btn.textContent = 'Publicar Vehículo';
      return;
    }
    const urls = await uploadImages();
    const data = {
      title: document.getElementById('publishTitle').value,
      brand: document.getElementById('publishBrand').value,
      model: document.getElementById('publishModel').value,
      year: document.getElementById('publishYear').value,
      price: document.getElementById('publishPrice').value,
      transmission: document.getElementById('publishTransmission').value,
      mileage: document.getElementById('publishMileage').value || 0,
      fuel: document.getElementById('publishFuel').value,
      city: city,
      province: province,
      description: document.getElementById('publishDescription').value,
      accepts_trade: document.getElementById('publishAcceptsTrade').checked,
      images: urls
    };
    await request('/vehicles', { method: 'POST', body: JSON.stringify(data) });
    showToast('¡Vehículo publicado!', 'success');
    uploadedImages = [];
    e.target.reset();
    document.getElementById('publishProvince').value = '';
    document.getElementById('publishCity').innerHTML = '<option value="">Primero seleccioná una provincia</option>';
    document.getElementById('publishCity').disabled = true;
    showSection('my-vehicles');
  } catch (err) { showToast(err.message, 'error'); }
  btn.disabled = false;
  btn.textContent = 'Publicar Vehículo';
}

// MY VEHICLES
async function loadMyVehicles() {
  try {
    const vehicles = await request('/my-vehicles');
    const stats = await request('/stats').catch(() => null);
    const dashboard = document.getElementById('statsDashboard');
    dashboard.innerHTML = stats ? `
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg></div><div class="number">${stats.vehicles_count}</div><div class="label">Vehículos</div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/></svg></div><div class="number">${stats.total_views}</div><div class="label">Vistas totales</div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></div><div class="number">${stats.conversations_count}</div><div class="label">Conversaciones</div></div>
      <div class="stat-card"><div class="icon"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div><div class="number">${stats.favorites_count}</div><div class="label">Favoritos</div></div>
    ` : '';
    const container = document.getElementById('myVehiclesList');
    if (!vehicles?.length) { container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><h3>Sin publicaciones</h3><p>Publica tu primer vehículo</p></div>'; return; }
    container.innerHTML = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'">
          <span class="vehicle-badge ${v.status === 'sold' ? 'badge-sold' : ''}">${v.status === 'active' ? 'Activo' : v.status === 'sold' ? 'VENDIDO' : v.status === 'paused' ? 'Pausado' : v.status}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <p class="vehicle-price">$${formatNumber(v.price)}</p>
          <div class="vehicle-views"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/></svg> ${v.view_count || 0} vistas</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
            <button class="btn btn-secondary" style="flex:1;" onclick="openEditModal(${v.id}, event)">✏️ Editar</button>
            <button class="btn btn-danger" style="flex:1;" onclick="deleteVehicle(${v.id}, event)">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
    loadTradeOffers();
  } catch (err) { showToast(err.message, 'error'); }
}

function deleteVehicle(id, e) {
  e.stopPropagation();
  showConfirmModal('Eliminar vehículo', 'Esta acción no se puede deshacer. Se eliminarán todas las imágenes, conversaciones y favoritos asociados.', 'Eliminar', async () => {
    try { await request(`/vehicles/${id}`, { method: 'DELETE' }); showToast('Eliminado', 'success'); loadMyVehicles(); } catch (err) { showToast(err.message, 'error'); }
  });
}

async function openEditModal(id, e) {
  e.stopPropagation();
  try {
    const v = await request(`/vehicles/${id}`);
    document.getElementById('editVehicleId').value = v.id;
    document.getElementById('editTitle').value = v.title || '';
    document.getElementById('editPrice').value = v.price || '';
    document.getElementById('editMileage').value = v.mileage || '';
    document.getElementById('editFuel').value = v.fuel || '';
    document.getElementById('editTransmission').value = v.transmission || '';
    const editProvSelect = document.getElementById('editProvince');
    const editCitySelect = document.getElementById('editCity');
    editProvSelect.value = v.province || '';
    editProvSelect.dispatchEvent(new Event('change'));
    editCitySelect.value = v.city || '';
    document.getElementById('editStatus').value = v.status || 'active';
    document.getElementById('editDescription').value = v.description || '';
    document.getElementById('editAcceptsTrade').checked = !!v.accepts_trade;
    document.getElementById('editVehicleModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
  } catch (err) { showToast(err.message, 'error'); }
}

function closeEditModal() {
  document.getElementById('editVehicleModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
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
    await request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: document.getElementById('editTitle').value,
        price: document.getElementById('editPrice').value,
        mileage: document.getElementById('editMileage').value,
        fuel: document.getElementById('editFuel').value,
        transmission: document.getElementById('editTransmission').value,
        city: city,
        province: province,
        status: document.getElementById('editStatus').value,
        description: document.getElementById('editDescription').value,
        accepts_trade: document.getElementById('editAcceptsTrade').checked
      })
    });
    showToast('¡Publicación actualizada!', 'success');
    closeEditModal();
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
          <img src="${v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'">
          <span class="vehicle-badge">${v.year}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <p class="vehicle-price">$${formatNumber(v.price)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleFavorite(id, e) {
  if (e) e.stopPropagation();
  if (!localStorage.getItem('token')) { showToast('Inicia sesión para agregar favoritos', 'error'); return; }
  try {
    const res = await request(`/favorites/${id}`, { method: 'POST' });
    showToast(res.favorited ? 'Agregado a favoritos' : 'Eliminado de favoritos', 'success');
    if (document.getElementById('vehicle-detail')?.style.display !== 'none') {
      // Update only the favorite button in the detail view without reloading the whole page
      const detailFavBtn = document.querySelector('#vehicleDetail .detail-actions .btn');
      if (detailFavBtn && (detailFavBtn.textContent.includes('favoritos') || detailFavBtn.textContent.includes('Guardar'))) {
        detailFavBtn.className = `btn ${res.favorited ? 'btn-primary' : 'btn-secondary'}`;
        const svgPath = detailFavBtn.querySelector('svg path');
        if (svgPath) svgPath.setAttribute('fill', res.favorited ? 'currentColor' : 'none');
        const svgEl = detailFavBtn.querySelector('svg');
        if (svgEl) svgEl.setAttribute('stroke', 'currentColor');
        detailFavBtn.lastChild.textContent = res.favorited ? 'En favoritos' : 'Guardar en favoritos';
      }
    } else {
      loadVehicles();
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// CONTACT / CONVERSATIONS
async function handleQuickMessage(vehicleId) {
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
  try {
    const res = await request(`/conversations?page=${page}`);
    const conversations = res.conversations || res;
    const total = res.total || conversations.length;
    const container = document.getElementById('conversationsListContent');
    if (page === 1 && !conversations?.length) { container.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>Sin conversaciones</p></div>'; renderEmptyChat(); return; }
    const html = conversations.map(c => `
      <div class="conversation-item ${String(currentConversationId) === String(c.id) ? 'active' : ''}" onclick="openConversation(${c.id}, this)">
        <div class="conversation-avatar">${c.other_user?.avatar_url ? `<img src="${escapeHtml(c.other_user.avatar_url || '')}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (c.other_user?.username ? c.other_user.username.charAt(0).toUpperCase() : '?')}</div>
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.other_user?.username || 'Usuario')}</div>
          <div class="conversation-vehicle">${escapeHtml(c.vehicle?.title || '')}</div>
          <div class="conversation-preview">${escapeHtml(c.last_message || '')}</div>
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
  } catch (err) { console.error(err); }
}

async function openConversation(convId, el) {
  currentConversationId = convId;
  lastMessageId = 0;
  pollCount = 0;
  document.querySelectorAll('.conversation-item').forEach(e => e.classList.remove('active'));
  const target = el || (event && event.currentTarget);
  if (target) target.classList.add('active');
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
    const vehicle = conv.vehicle;
    const chatView = document.getElementById('chatView');

    // Build read_at lookup from receipts
    const readMap = {};
    (read_receipts || []).forEach(r => { readMap[r.id] = r.read_at; });
    // Also use read_at from messages themselves
    (messages || []).forEach(m => { if (m.read_at) readMap[m.id] = m.read_at; });

    const vehicleImg = vehicle?.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=120&h=80&fit=crop';

    chatView.innerHTML = `
      <div class="chat-active-header">
        <button class="chat-back-btn" style="display:none;align-items:center;background:none;border:none;color:var(--text);cursor:pointer;padding:0.25rem;margin-right:0.5rem;font-size:1.3rem;" onclick="closeMobileChat()">&#8249;</button>
        <div class="conversation-avatar">${otherUser?.avatar_url ? `<img src="${escapeHtml(otherUser.avatar_url || '')}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (otherUser?.username ? otherUser.username.charAt(0).toUpperCase() : '?')}</div>
        <div class="chat-header-info">
          <h4>${escapeHtml(otherUser?.username || 'Usuario')}</h4>
          <span id="chatOnlineStatus" style="color:var(--text-secondary);font-size:0.8rem;transition:color 0.3s;font-weight:600;">Calculando...</span>
        </div>

        ${vehicle ? `
        <div class="chat-vehicle-ref-inline" onclick="viewVehicle(${vehicle.id})" title="Ver publicación">
          <img src="${vehicleImg}" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=120&h=80&fit=crop'" alt="">
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
      }
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
      const fallbackImg = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=220&fit=crop';
      html += `
        <div class="trade-card" onclick="viewVehicle(${v.id})">
          <div class="trade-card-badge">🔄 Propuesta de permuta</div>
          <div class="trade-card-img">
            <img src="${escapeHtml(v.image || fallbackImg)}" onerror="this.src='${fallbackImg}'" alt="${escapeHtml(v.title)}">
          </div>
          <div class="trade-card-body">
            <div class="trade-card-title">${escapeHtml(v.title)}</div>
            <div class="trade-card-sub">${escapeHtml(v.brand)} ${escapeHtml(v.model)} · ${v.year}</div>
            <div class="trade-card-price">$${formatNumber(v.price)}</div>
            ${v.city ? `<div class="trade-card-location">📍 ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</div>` : ''}
            <div class="trade-card-cta">Ver vehículo →</div>
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
function startPolling() {
  stopPolling();
  pollingInterval = setInterval(() => {
    if (currentConversationId) pollNewMessages(currentConversationId);
  }, 3000);
}
function stopPolling() { if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } }

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
};
function notifIcon(type) {
  const svg = NOTIF_ICONS[type] || `<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
  const colors = { message:'#60a5fa', trade_offer:'#f59e0b', trade_accepted:'#22c55e', trade_rejected:'#ef4444', follow:'#a78bfa', new_vehicle:'#f59e0b', rating:'#facc15' };
  const bg = colors[type] || 'var(--text-3)';
  return `<div class="notification-icon" style="background:${bg}22;color:${bg};">${svg}</div>`;
}

async function loadNotifications() {
  try {
    const notifications = await request('/notifications');
    const container = document.getElementById('notificationsList');
    if (!notifications?.length) { container.innerHTML = '<div class="empty-state"><p>Sin notificaciones</p></div>'; return; }
    container.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.link || ''}', ${n.id})">
        ${notifIcon(n.type)}
        <div class="notification-content"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.message)}</p><div class="notification-time">${formatRelTime(n.created_at)}</div></div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
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
    const convId = link.split('/').pop();
    currentConversationId = convId;
    lastMessageId = 0;
    pollCount = 0;
    showSection('messages');
    try {
      await loadChatFull(convId);
      startPolling();
    } catch (err) {
      showToast('No se pudo cargar la conversación', 'error');
      currentConversationId = null;
    }
  } else if (link.includes('vehicle/')) {
    viewVehicle(link.split('/').pop());
  } else if (link.includes('profile/')) {
    viewProfile(link.split('/').pop());
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
        completenessHtml = `<div class="profile-completeness">
          <h4>Completá tu perfil (${pct}%)</h4>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="checklist">${fields.map(f => `<span class="${f.done ? 'done' : 'pending'}">${f.done ? '✓' : '○'} ${f.name}</span>`).join('')}</div>
        </div>`;
      }
    }
    const canFollow = !isOwn && !!localStorage.getItem('token');
    document.getElementById('profileHeader').innerHTML = `
      ${completenessHtml}
      <div class="profile-avatar">${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url || '')}" alt="">` : profile.username?.charAt(0).toUpperCase()}</div>
      <div class="seller-name-row" style="justify-content:center;margin-top:0.5rem;">
        <h2 style="margin:0;">${escapeHtml(profile.username)}</h2>
        ${profile.is_verified ? verifiedBadge() : ''}
      </div>
      ${profile.rating ? `<div class="rating">${'★'.repeat(Math.round(profile.rating))}${'☆'.repeat(5-Math.round(profile.rating))} <span>(${profile.ratings_count} reseñas)</span></div>` : '<p style="color:var(--text-secondary)">Sin reseñas</p>'}
      ${profile.city ? `<p style="color:var(--text-secondary)">${escapeHtml(profile.city)}</p>` : ''}
      ${profile.bio ? `<p style="margin-top:0.5rem;font-size:0.9rem">${escapeHtml(profile.bio)}</p>` : ''}
      <div class="stats" style="display:flex;gap:1.5rem;justify-content:center;margin-top:0.75rem;">
        <span><strong>${profile.vehicles_count || 0}</strong> vehículos</span>
        <span><strong id="followersCount">${profile.followers_count || 0}</strong> seguidores</span>
        <span><strong>${profile.following_count || 0}</strong> siguiendo</span>
      </div>
      ${canFollow ? `
        <button id="followBtn" class="btn ${profile.is_following ? 'btn-secondary' : 'btn-primary'}" style="margin-top:1rem;min-width:140px;" onclick="toggleFollow(${id})">
          ${profile.is_following ? 'Dejar de seguir' : '+ Seguir'}
        </button>
      ` : ''}
      ${isOwn ? `<button class="btn btn-secondary" style="margin-top:1rem" onclick="showSection('profile'); editProfile()">Editar perfil</button>` : ''}
    `;
    const isViewerAdmin = !!currentUser?.profile?.is_admin;
    const vehicles = await request(`/vehicles?user_id=${id}`).catch(() => ({ vehicles: [] }));
    document.getElementById('profileVehiclesList').innerHTML = vehicles.vehicles?.length ? vehicles.vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container"><img src="${v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'"></div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-price">$${formatNumber(v.price)}</p>
          ${isViewerAdmin && !isOwn ? `<button class="btn btn-sm btn-danger" style="margin-top:0.5rem;width:100%;" onclick="event.stopPropagation(); adminDeleteVehicle(${v.id}, ${JSON.stringify(escapeHtml(v.title))})">🗑 Eliminar</button>` : ''}
        </div>
      </div>
    `).join('') : '<p style="color:var(--text-secondary)">Sin vehículos publicados</p>';
    document.getElementById('profileReviewsList').innerHTML = ratings?.length ? ratings.map(r => `
      <div class="review-item"><div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div><div class="author">${escapeHtml(r.from_user?.username)} - ${formatRelTime(r.created_at)}</div>${r.review ? `<div class="text">${escapeHtml(r.review)}</div>` : ''}</div>
    `).join('') : '<p style="color:var(--text-secondary)">Sin reseñas</p>';
    showSection('profile');
  } catch (err) { showToast(err.message, 'error'); }
}

function editProfile() {
  if (!currentUser) return;
  pendingAvatarFile = null;
  document.getElementById('profileForm').innerHTML = `
    <h3 style="font-size:1.1rem;margin-bottom:1rem;">Editar perfil</h3>
    <form onsubmit="saveProfile(event)" style="background:var(--dark-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;">
      <div class="form-group" style="margin-bottom:1rem;">
        <label>Foto de perfil</label>
        <div style="display:flex;align-items:center;gap:1rem;">
          <div class="profile-avatar" style="width:60px;height:60px;margin:0;" id="editAvatarPreview">${currentUser.profile?.avatar_url ? `<img src="${currentUser.profile.avatar_url}">` : currentUser.username.charAt(0).toUpperCase()}</div>
          <input type="file" id="editAvatarFile" accept="image/*" onchange="previewProfileImage(event)" style="flex:1;">
        </div>
        <input type="hidden" id="editAvatarBase64" value="${currentUser.profile?.avatar_url || ''}">
      </div>
      <div class="form-group"><label>Nombre</label><input type="text" id="editUsername" value="${escapeHtml(currentUser.username)}" required></div>
      <div class="form-group"><label>Teléfono</label><input type="tel" id="editPhone" value="${escapeHtml(currentUser.profile?.phone || '')}" placeholder="+54..."></div>
      <div class="form-group"><label>Ciudad</label><input type="text" id="editCity" value="${escapeHtml(currentUser.profile?.city || '')}" placeholder="Buenos Aires"></div>
      <div class="form-group"><label>Bio</label><textarea id="editBio" rows="3" placeholder="Cuéntanos sobre ti...">${escapeHtml(currentUser.profile?.bio || '')}</textarea></div>
      <button type="submit" class="btn btn-primary" style="width:100%;">Guardar</button>
    </form>
  `;
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
    let avatarUrl = document.getElementById('editAvatarBase64').value; // valor previo (si existe)

    if (pendingAvatarFile) {
      showToast('Optimizando foto de perfil...', 'info');
      const compressed = await compressImage(pendingAvatarFile, 800, 800, 0.85);
      const formData = new FormData();
      formData.append('image', compressed.file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      if (!res.ok) throw new Error('Error al subir la imagen de perfil a Supabase');
      const data = await res.json();
      avatarUrl = data.url;
      pendingAvatarFile = null;
    }

    await request('/profile', { method: 'PUT', body: JSON.stringify({
      username: document.getElementById('editUsername').value,
      phone: document.getElementById('editPhone').value,
      city: document.getElementById('editCity').value,
      bio: document.getElementById('editBio').value,
      avatar_url: avatarUrl
    }) });
    showToast('Perfil actualizado', 'success');
    currentUser = await request('/user');
    updateNav();
    if (currentProfileId) viewProfile(currentProfileId);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ADMIN
async function loadAdmin() {
  try {
    const stats = await request('/admin/stats');
    document.getElementById('adminStats').innerHTML = `
      <div class="admin-stat"><div class="number">${stats.users || 0}</div><div class="label">Usuarios</div></div>
      <div class="admin-stat"><div class="number">${stats.vehicles || 0}</div><div class="label">Vehículos</div></div>
      <div class="admin-stat"><div class="number">${stats.active_vehicles || 0}</div><div class="label">Activos</div></div>
      <div class="admin-stat"><div class="number">${stats.pending_reports || 0}</div><div class="label">Reportes pendientes</div></div>
    `;
    showAdminTab('reports');
  } catch (err) { showToast(err.message, 'error'); }
}

function showAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  event?.currentTarget?.classList?.add('active') || document.querySelector(`.admin-tab[onclick*="'${tab}'"]`)?.classList.add('active');
  if (tab === 'reports') loadAdminReports();
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
                ${r.vehicle?.id ? `<button class="btn btn-sm btn-danger" onclick="adminDeleteVehicle(${r.vehicle.id}, ${JSON.stringify(escapeHtml(r.vehicle.title || ''))})">🗑 Eliminar pub.</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody></table>
      </div>
    ` : '<p>Sin reportes</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function adminDeleteVehicle(id, title) {
  showConfirmModal(
    '¿Eliminar publicación?',
    `Se eliminará permanentemente "${title}" y todas sus imágenes y conversaciones. Esta acción no se puede deshacer.`,
    'Eliminar',
    async () => {
      try {
        await request(`/vehicles/${id}`, { method: 'DELETE' });
        showToast('Publicación eliminada', 'success');
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
                  <td>
                    <button class="btn btn-sm btn-danger"
                      onclick="adminDeleteVehicle(${v.id}, ${JSON.stringify(escapeHtml(v.title))})">Eliminar</button>
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
    const users = await request('/admin/users');
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
                  <td style="text-align:center;">${u.vehicles?.[0]?.count || 0}</td>
                  <td>
                    ${isBanned
                      ? '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:6px;font-size:0.78rem;font-weight:600;">Suspendido</span>'
                      : '<span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:2px 8px;border-radius:6px;font-size:0.78rem;font-weight:600;">Activo</span>'
                    }
                  </td>
                  <td style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-sm ${isBanned ? 'btn-secondary' : 'btn-danger'}" onclick="toggleBan('${u.id}')">
                      ${isBanned ? 'Reactivar' : 'Suspender'}
                    </button>
                    ${!isAdm ? `<button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', true)">Hacer admin</button>` : `<button class="btn btn-sm btn-ghost" onclick="toggleAdmin('${u.id}', false)">Quitar admin</button>`}
                    <button class="btn btn-sm" style="${isVerified ? 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);' : 'background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.25);'}" onclick="toggleVerify('${u.id}', ${!isVerified})">
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
      btn.className = `btn ${res.following ? 'btn-secondary' : 'btn-primary'}`;
      btn.style.minWidth = '140px';
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
  document.getElementById('tradeModal').style.display = 'block';
  document.getElementById('modalOverlay').style.display = 'block';
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
  document.getElementById('tradeModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
  tradeTargetVehicleId = null;
}

async function submitTradeOffer() {
  const offered = document.getElementById('tradeOfferedVehicle').value;
  const message = document.getElementById('tradeMessage').value;
  if (!offered) return showToast('Seleccioná un vehículo para ofrecer', 'error');
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
      <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:1rem 1.25rem;margin-bottom:0.75rem;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
          <div style="flex:1;">
            <div style="font-size:0.78rem;color:var(--text-2);margin-bottom:0.25rem;">${isReceived ? 'De: <strong>' + escapeHtml(o.proposer?.username) + '</strong>' : 'Para: <strong>' + escapeHtml(o.owner?.username) + '</strong>'}</div>
            <div style="font-weight:600;">${escapeHtml(o.offered_vehicle?.brand || '')} ${escapeHtml(o.offered_vehicle?.model || '')} ${o.offered_vehicle?.year || ''}</div>
            <div style="font-size:0.82rem;color:var(--text-2);">por tu: ${escapeHtml(o.target_vehicle?.brand || '')} ${escapeHtml(o.target_vehicle?.model || '')} ${o.target_vehicle?.year || ''}</div>
            ${o.message ? `<div style="font-size:0.82rem;color:var(--text-2);margin-top:0.4rem;font-style:italic;">"${escapeHtml(o.message)}"</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.78rem;font-weight:700;color:${statusColor(o.status)};margin-bottom:0.5rem;">${statusLabel(o.status)}</div>
            ${isReceived && o.status === 'pending' ? `
              <div style="display:flex;gap:0.5rem;">
                <button class="btn btn-sm btn-primary" onclick="respondToTrade(${o.id}, 'accepted')">Aceptar</button>
                <button class="btn btn-sm btn-danger" onclick="respondToTrade(${o.id}, 'rejected')">Rechazar</button>
              </div>` : ''}
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-3);margin-top:0.5rem;">${formatRelTime(o.created_at)}</div>
      </div>`;

    // Renderizar con colapso si hay más de 3
    function renderCollapsible(containerId, offers, isReceived, emptyMsg) {
      const MAX_VISIBLE = 3;
      const container = document.getElementById(containerId);
      if (!offers?.length) { container.innerHTML = `<p style="color:var(--text-3);font-size:0.9rem;">${emptyMsg}</p>`; return; }
      const visible = offers.slice(0, MAX_VISIBLE);
      const hidden = offers.slice(MAX_VISIBLE);
      const hiddenId = containerId + '_hidden';
      container.innerHTML = visible.map(o => renderOffer(o, isReceived)).join('')
        + (hidden.length ? `
          <div id="${hiddenId}" style="display:none;">${hidden.map(o => renderOffer(o, isReceived)).join('')}</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:0.25rem;" onclick="
            const h = document.getElementById('${hiddenId}');
            const open = h.style.display !== 'none';
            h.style.display = open ? 'none' : 'block';
            this.textContent = open ? 'Ver ${hidden.length} más ▾' : 'Ver menos ▴';
          ">Ver ${hidden.length} más ▾</button>
        ` : '');
    }

    renderCollapsible('tradeOffersList', received, true,  'Sin permutas recibidas');
    renderCollapsible('tradeSentList',   sent,     false, 'Sin permutas enviadas');
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
  document.getElementById('reportModal').style.display = 'block';
  document.getElementById('modalOverlay').style.display = 'block';
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
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
  document.getElementById('starRating').querySelectorAll('.star').forEach(s => s.classList.remove('active'));
  document.getElementById('rateReview').value = '';
  document.getElementById('rateModal').style.display = 'block';
  document.getElementById('modalOverlay').style.display = 'block';
}

function closeRateModal() {
  document.getElementById('rateModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
  rateConversationId = null;
  rateRecipientId = null;
  rateVehicleId = null;
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('star') && e.target.closest('#starRating')) {
    const stars = e.target.closest('#starRating').querySelectorAll('.star');
    const clickedIndex = Array.from(stars).indexOf(e.target);
    stars.forEach((s, i) => {
      if (i <= clickedIndex) s.classList.add('active');
      else s.classList.remove('active');
    });
  }
});

async function submitRating() {
  const stars = document.querySelectorAll('#starRating .star.active').length;
  const review = document.getElementById('rateReview').value;
  if (!stars) { showToast('Selecciona estrellas', 'error'); return; }
  try {
    await request('/ratings', { method: 'POST', body: JSON.stringify({ to_user_id: rateRecipientId, vehicle_id: rateVehicleId ?? currentVehicleId, stars, review }) });
    showToast('Calificación enviada', 'success');
    closeRateModal();
  } catch (err) { showToast(err.message, 'error'); }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  document.getElementById('modalOverlay').style.display = 'none';
  closeLightbox();
  confirmCallback = null;
}

// Lightbox
let lightboxImages = [];
let lightboxIndex = 0;
function openLightbox(images, startIndex) {
  if (!images?.length) return;
  lightboxImages = images;
  lightboxIndex = startIndex || 0;
  const modal = document.getElementById('lightboxModal');
  document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex];
  document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  modal.style.display = 'flex';
}
function closeLightbox(e) {
  if (e && e.target && e.target.tagName === 'IMG') return;
  document.getElementById('lightboxModal').style.display = 'none';
}
function lightboxNav(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  document.getElementById('lightboxImage').src = lightboxImages[lightboxIndex];
  document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
}
document.addEventListener('keydown', e => {
  if (document.getElementById('lightboxModal').style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
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
  document.getElementById('confirmModal').style.display = 'block';
  document.getElementById('modalOverlay').style.display = 'block';
}
function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
  confirmCallback = null;
}

// UTILS
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

async function shareVehicle(id, title) {
  const url = `${window.location.origin}${window.location.pathname}?vehicle=${id}`;
  if (navigator.share) {
    try { await navigator.share({ title, url }); } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Enlace copiado al portapapeles', 'success');
    } catch { showToast('No se pudo copiar el enlace', 'error'); }
  }
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type} toast-enter`;
  toast.textContent = msg;
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
  
  if (isLogged) {
    document.getElementById('navMessages').style.display = 'flex';
    document.getElementById('navNotifications').style.display = 'flex';
    document.getElementById('navFavorites').style.display = 'flex';
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

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      currentUser = await request('/user');
      if (currentUser.profile?.is_admin) document.getElementById('navAdmin').style.display = 'inline';
      updateNav();
      loadNotificationCount();
      loadUnreadMessageCount();
      request('/ping', { method: 'PUT' }).catch(() => {});
    } catch { localStorage.removeItem('token'); currentUser = null; }
  }
  updateNav();
}

checkAuth().then(() => {
  // Deep linking: ?vehicle=ID
  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get('vehicle');
  if (vehicleId) {
    window.history.replaceState({}, '', window.location.pathname);
    viewVehicle(parseInt(vehicleId));
  }
});

// Poll notification + unread messages count every 30 seconds
let notifInterval = setInterval(() => {
  if (currentUser) {
    loadNotificationCount();
    loadUnreadMessageCount();
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

initBrandFilters();

function autoFillTitle() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const year = document.getElementById('publishYear')?.value || '';
  const titleInput = document.getElementById('publishTitle');
  if (titleInput) {
    titleInput.value = `${brand} ${model} ${year}`.trim();
  }
}

document.getElementById('publishBrand')?.addEventListener('change', autoFillTitle);
document.getElementById('publishModel')?.addEventListener('change', autoFillTitle);
document.getElementById('publishYear')?.addEventListener('input', autoFillTitle);

const yearInput = document.getElementById('publishYear');
if (yearInput) yearInput.max = new Date().getFullYear() + 1;
showSection('home');

// MOBILE ACCOUNT MENU
function toggleMobileMenu() {
  const menu = document.getElementById('mobileAccountMenu');
  if (menu.style.display === 'none') {
    document.getElementById('mobileMenuUsername').textContent = currentUser?.username || '';
    const adminItem = document.getElementById('mobileMenuAdmin');
    if (adminItem) adminItem.style.display = currentUser?.profile?.is_admin ? 'block' : 'none';
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
}
function closeMobileMenu() {
  document.getElementById('mobileAccountMenu').style.display = 'none';
}

async function loadPublicStats() {
  try {
    const data = await request('/stats/public');
    const ve = document.getElementById('statVehicles');
    const us = document.getElementById('statUsers');
    if (ve) ve.textContent = data.active_vehicles?.toLocaleString('es-AR') || '—';
    if (us) us.textContent = data.total_users?.toLocaleString('es-AR') || '—';
  } catch { /* silencioso */ }
}
loadPublicStats();
