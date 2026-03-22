const PLACEHOLDER_IMG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1a1a2e"/><text x="200" y="140" text-anchor="middle" fill="#444" font-size="48">&#x1F697;</text><text x="200" y="185" text-anchor="middle" fill="#555" font-size="16">Sin imagen</text></svg>')}`;

let currentUser = null;
let currentVehicleId = null;
let vehicleMapInstance = null;
let currentConversationId = null;
let currentProfileId = null;
let pollingInterval = null;
let searchTimeout = null;
let adminSearchTimeout = null;
let uploadedImages = [];
let reportVehicleId = null;
let rateConversationId = null;
let rateRecipientId = null;
let rateVehicleId = null;
let lastMessageId = 0;
let isLoadingMessages = false;
let pollCount = 0;
let vehicleSearchAbortController = null;
let dolarRate = null;
let dolarRateInterval = null;
let userFavoriteIds = new Set();

// WebSocket
let wsConnection = null;
let wsReconnectTimeout = null;
let wsReconnectDelay = 1000;
let wsReconnectAttempts = 0;
let wsConnected = false;
let wsReadReceiptDebounce = null;
let wsTypingTimeout = null;
let isTyping = false;
let currentChatOtherUserId = null;

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

const motoBrands = {
  'Beta': ['RR 125', 'RR 200', 'RR 250', 'RR 300', 'RR 390', 'RR 430', 'RR 480', 'X-Trainer 250', 'X-Trainer 300'],
  'BMW Motorrad': ['G 310 R', 'G 310 GS', 'F 750 GS', 'F 850 GS', 'R 1250 GS', 'S 1000 RR'],
  'Bajaj': ['Boxer 100', 'Discover 125', 'Pulsar NS160', 'Pulsar NS200', 'Pulsar RS200', 'Dominar 400', 'Rouser NS200'],
  'Corven': ['Energy 110', 'Energy 125', 'Mirage 110', 'Triax 150', 'Triax 250', 'TK 150'],
  'Ducati': ['Monster', 'Panigale V2', 'Panigale V4', 'Multistrada V4', 'Scrambler'],
  'Gilera': ['Smash 110', 'Smash 125', 'VC 150', 'Sahara 150', 'Futura 150'],
  'Harley-Davidson': ['Iron 883', 'Forty-Eight', 'Street Glide', 'Road Glide', 'Fat Boy', 'Sportster S'],
  'Honda': ['CB190R', 'CB300R', 'CB500F', 'CB650R', 'CBR600RR', 'CBR1000RR', 'CG 150', 'Titan 160', 'Wave 110', 'XRE 300', 'Africa Twin'],
  'KTM': ['Duke 200', 'Duke 390', 'Duke 790', 'RC 390', 'Adventure 390', 'Adventure 790', 'EXC 300'],
  'Kawasaki': ['Ninja 300', 'Ninja 400', 'Ninja 650', 'Ninja ZX-6R', 'Z400', 'Z650', 'Z900', 'Versys 650'],
  'Motomel': ['Blitz 110', 'S2 150', 'CG 150', 'Skua 150', 'Skua 250', 'Sirius 200'],
  'Royal Enfield': ['Bullet 350', 'Classic 350', 'Meteor 350', 'Himalayan', 'Interceptor 650', 'Continental GT 650'],
  'Suzuki': ['Gixxer 150', 'Gixxer 250', 'GSX-R600', 'GSX-R750', 'GSX-S750', 'V-Strom 650', 'DR 650'],
  'Yamaha': ['FZ 150', 'FZ 250', 'MT-03', 'MT-07', 'MT-09', 'R3', 'R7', 'R1', 'XTZ 125', 'XTZ 250', 'XMAX 300', 'Tenere 700'],
  'Zanella': ['ZB 110', 'ZB 125', 'Styler 150', 'RZ3 150', 'RX 150', 'Patagonia 250'],
};

function getBrandsForType(type) {
  return type === 'moto' ? motoBrands : carBrands;
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
function updatePriceHint(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  const hintEl = document.getElementById(`${prefix}PriceHint`);
  if (!currencyEl || !priceEl || !hintEl) return;
  const currency = currencyEl.value;
  const val = parseFloat(priceEl.value);
  if (!val || !dolarRate?.venta) { hintEl.textContent = ''; return; }
  if (currency === 'USD') {
    const ars = Math.round(val * dolarRate.venta);
    hintEl.textContent = `≈ ARS $${ars.toLocaleString('es-AR')}`;
  } else {
    const usd = Math.round(val / dolarRate.venta);
    hintEl.textContent = `≈ USD $${usd.toLocaleString('es-AR')}`;
  }
}

function onCurrencyChange(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  if (!currencyEl || !priceEl || !dolarRate?.venta) return;
  const val = parseFloat(priceEl.value);
  if (!val) { updatePriceHint(prefix); return; }
  // Convert current value to the newly selected currency
  const prev = currencyEl.dataset.prev || 'USD';
  if (prev === 'USD' && currencyEl.value === 'ARS') {
    priceEl.value = Math.round(val * dolarRate.venta);
  } else if (prev === 'ARS' && currencyEl.value === 'USD') {
    priceEl.value = Math.round(val / dolarRate.venta);
  }
  currencyEl.dataset.prev = currencyEl.value;
  updatePriceHint(prefix);
}

function getPriceInUSD(prefix) {
  const currencyEl = document.getElementById(`${prefix}Currency`);
  const priceEl = document.getElementById(`${prefix}Price`);
  const val = parseFloat(priceEl.value);
  if (!val) return val;
  if (currencyEl?.value === 'ARS' && dolarRate?.venta) {
    return Math.round(val / dolarRate.venta);
  }
  return val;
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
  // Usar override de sesión si existe, si no auto-detectar por hora
  const override = sessionStorage.getItem('themeOverride');
  applyTheme(override !== null ? override === 'day' : isDay());
  // Re-verificar cada 5 minutos para auto-cambiar cuando cambia la hora
  setInterval(() => {
    if (sessionStorage.getItem('themeOverride') === null) applyTheme(isDay());
  }, 5 * 60 * 1000);
}

function toggleTheme() {
  const newDay = !document.body.classList.contains('day-mode');
  sessionStorage.setItem('themeOverride', newDay ? 'day' : 'night');
  applyTheme(newDay);
}

// Init province/city selects when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupProvinceCity('publishProvince', 'publishCity');
  setupProvinceCity('editProvince', 'editCity');

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

  // Currency selectors
  ['publish', 'edit'].forEach(prefix => {
    const currencyEl = document.getElementById(`${prefix}Currency`);
    const priceEl = document.getElementById(`${prefix}Price`);
    if (currencyEl) {
      currencyEl.dataset.prev = currencyEl.value || 'ARS';
      currencyEl.addEventListener('change', () => onCurrencyChange(prefix));
    }
    if (priceEl) {
      priceEl.addEventListener('input', () => updatePriceHint(prefix));
    }
  });
});

function toggleEngineCCField(prefix = 'publish') {
  const typeEl = document.getElementById(`${prefix}VehicleType`);
  const ccGroup = document.getElementById(`${prefix}EngineCCGroup`);
  if (!typeEl || !ccGroup) return;
  ccGroup.style.display = typeEl.value === 'moto' ? 'block' : 'none';
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
    vehicleMapInstance = L.map('vehicleMap', {
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

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers, signal: options.signal });
  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) throw new Error(data.error || 'Error');
  return data;
}

function showSection(sectionId) {
  if (currentUser && (sectionId === 'login' || sectionId === 'register')) return;
  document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
  const section = document.getElementById(sectionId);
  if (section) {
    section.style.display = 'block';
    section.classList.add('fade-in');
  }
  if (sectionId === 'home') { loadHomeRecent(); loadPublicStats(); }
  else if (sectionId === 'vehicles') loadVehicles(1);
  else if (sectionId === 'my-vehicles') loadMyVehicles();
  else if (sectionId === 'messages') { document.querySelector('.messages-container')?.classList.remove('chat-open'); loadConversations(); }
  else if (sectionId === 'favorites') loadFavorites();
  else if (sectionId === 'notifications') loadNotifications();
  else if (sectionId === 'following-feed') loadFollowingFeed(1, true);
  else if (sectionId === 'admin') loadAdmin();
  else if (sectionId === 'register') {
    // Render hCaptcha when section becomes visible (needed with render=explicit)
    setTimeout(() => {
      const container = document.querySelector('.h-captcha');
      if (container && window.hcaptcha && !container.querySelector('iframe')) {
        try { hcaptcha.render(container, { sitekey: container.dataset.sitekey }); } catch(e) {}
      }
    }, 50);
  }
  else if (sectionId === 'publish') {
    uploadedImages = [];
    renderImagePreviews();
    const pubCurrencyEl = document.getElementById('publishCurrency');
    if (pubCurrencyEl) { pubCurrencyEl.value = 'ARS'; pubCurrencyEl.dataset.prev = 'ARS'; }
    const pubHintEl = document.getElementById('publishPriceHint');
    if (pubHintEl) pubHintEl.textContent = '';
    // Auto-fill location from user profile
    if (currentUser?.profile?.city) {
      const match = AR_CITIES.find(c => c.city === currentUser.profile.city);
      if (match) {
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
    }
  }
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
  let captchaToken = document.querySelector('[name="h-captcha-response"]')?.value || '';
  if (!captchaToken) {
    showToast('Por favor completá el captcha', 'error');
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  try {
    const data = await request('/register', { method: 'POST', body: JSON.stringify({ username, email, password, captchaToken }) });
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    if (!heartbeatInterval) heartbeatInterval = setInterval(() => { if (currentUser && document.visibilityState === 'visible') request('/ping', { method: 'PUT' }).catch(() => {}); }, 30000);
    if (!notifInterval) notifInterval = setInterval(() => { if (currentUser) { loadCounts(); } }, 30000);
    updateNav();
    loadUserFavoriteIds();
    showToast('Registro exitoso. ¡Bienvenido!', 'success');
    showSection('home');
  } catch (err) {
    showToast(err.message, 'error');
    if (window.hcaptcha) window.hcaptcha.reset();
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
    localStorage.setItem('token', data.token);
    currentUser = await request('/user');
    if (!heartbeatInterval) heartbeatInterval = setInterval(() => { if (currentUser && document.visibilityState === 'visible') request('/ping', { method: 'PUT' }).catch(() => {}); }, 30000);
    if (!notifInterval) notifInterval = setInterval(() => { if (currentUser) { loadCounts(); } }, 30000);
    updateNav();
    loadUserFavoriteIds();
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
  userFavoriteIds = new Set();
  clearInterval(heartbeatInterval);
  heartbeatInterval = null;
  clearInterval(notifInterval);
  notifInterval = null;
  stopPolling();
  updateNav();
  showToast('Sesión cerrada', 'success');
  showSection('home');
}

// VEHICLES
async function loadVehicles(page = 1) {
  if (vehicleSearchAbortController) {
    vehicleSearchAbortController.abort();
  }
  vehicleSearchAbortController = new AbortController();
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
    const vehicleTypeEl = document.getElementById('filterVehicleType');
    if (vehicleTypeEl?.value) params.append('vehicle_type', vehicleTypeEl.value);
    params.append('page', page);
    const { vehicles = [], total = 0 } = await request(`/vehicles?${params}`, { signal: vehicleSearchAbortController.signal }) || {};
    document.getElementById('vehiclesCount').textContent = `${total} vehículo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
    if (!vehicles?.length) {
      container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg><h3>No hay vehículos</h3><p>Sé el primero en publicar</p></div>';
      return;
    }
    container.innerHTML = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <div class="vehicle-img-overlay"></div>
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${v.status !== 'sold' ? `<span class="vehicle-trade-badge ${v.accepts_trade ? 'trade-yes' : 'trade-no'}">${v.accepts_trade ? '🔄 Permuta' : 'Sin permuta'}</span>` : ''}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
            ${(() => {
              const ph = v.price_history;
              if (ph && ph.length >= 2) {
                const oldest = ph[0].price;
                const latest = ph[ph.length - 1].price;
                const diff = latest - oldest;
                const pct = Math.round(Math.abs(diff) / oldest * 100);
                if (diff < 0 && pct > 0) return `<span class="price-drop-badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg> ${pct}%</span>`;
              }
              return '';
            })()}
          </div>
          <div class="vehicle-meta">
            ${v.mileage === 0 ? '<span class="badge-nuevo">NUEVO</span>' : `<span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>${formatNumber(v.mileage)} km</span>`}
            <span>${escapeHtml(v.fuel || 'N/A')}</span>
            ${v.vehicle_type === 'moto' && v.engine_cc ? `<span>${v.engine_cc} cc</span>` : v.transmission ? `<span>${escapeHtml(v.transmission)}</span>` : ''}
          </div>
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <div class="avatar-tiny">${v.seller_name?.charAt(0)?.toUpperCase()}</div>
              <span>${escapeHtml(v.seller_name || 'Anónimo')}</span>
              ${v.seller_verified ? verifiedBadge() : ''}
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
    renderPagination(total, page);
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
    html += `<button class="${p === current ? 'active' : ''}" onclick="loadVehicles(${p})">${p}</button>`;
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
  const isHidden = getComputedStyle(panel).display === 'none';
  panel.style.display = isHidden ? 'block' : 'none';
}

function applyFilters() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadVehicles(1), 300);
}

function clearFilters() {
  ['filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxYear', 'filterBrand', 'filterModel', 'filterFuel', 'filterTransmission', 'filterCity', 'filterMaxMileage', 'filterProvince', 'filterSort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const filterModelEl = document.getElementById('filterModel');
  if (filterModelEl) filterModelEl.innerHTML = '<option value="">Todos</option>';
  loadVehicles(1);
}

function formatPesos(usdPrice) {
  if (!dolarRate?.venta || !usdPrice) return null;
  const ars = Math.round(Number(usdPrice) * dolarRate.venta);
  return '$' + ars.toLocaleString('es-AR');
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
    const filterType = document.getElementById('filterVehicleType')?.value || 'auto';
    const filterBrandsObj = getBrandsForType(filterType);
    select.innerHTML = '<option value="">Todas</option>';
    Object.keys(filterBrandsObj).sort().forEach(brand => {
      const opt = document.createElement('option');
      opt.value = brand;
      opt.textContent = brand;
      select.appendChild(opt);
    });
    // Reset model select when brands change
    const filterModel = document.getElementById('filterModel');
    if (filterModel) filterModel.innerHTML = '<option value="">Todos</option>';
  }
  const publishBrand = document.getElementById('publishBrand');
  if (publishBrand) {
    const publishType = document.getElementById('publishVehicleType')?.value || 'auto';
    const publishBrandsObj = getBrandsForType(publishType);
    publishBrand.innerHTML = '<option value="">Seleccionar marca</option>';
    Object.keys(publishBrandsObj).sort().forEach(brand => {
      const opt = document.createElement('option');
      opt.value = brand;
      opt.textContent = brand;
      publishBrand.appendChild(opt);
    });
    // Reset model select when brands change
    const publishModel = document.getElementById('publishModel');
    if (publishModel) publishModel.innerHTML = '<option value="">Seleccionar modelo</option>';
  }
}

function updateFilterModels() {
  const brand = document.getElementById('filterBrand').value;
  const modelSelect = document.getElementById('filterModel');
  modelSelect.innerHTML = '<option value="">Todos</option>';
  const type = document.getElementById('filterVehicleType')?.value || 'auto';
  const brands = getBrandsForType(type);
  if (brand && brands[brand]) brands[brand].forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
}

function updatePublishModels() {
  const brand = document.getElementById('publishBrand').value;
  const modelSelect = document.getElementById('publishModel');
  modelSelect.innerHTML = '<option value="">Seleccionar modelo</option>';
  const type = document.getElementById('publishVehicleType')?.value || 'auto';
  const brands = getBrandsForType(type);
  if (brand && brands[brand]) brands[brand].forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
}

// VEHICLE DETAIL
async function viewVehicle(id) {
  currentVehicleId = id;
  showSection('vehicle-detail');
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
    const isLoggedIn = !!localStorage.getItem('token');
    let isFavorite = false;
    if (isLoggedIn) {
      try { const r = await request(`/favorites/${id}/check`); isFavorite = r.favorited; } catch {}
    }

    const images = vehicle.vehicle_images?.length ? vehicle.vehicle_images : [{ url: vehicle.image_url || PLACEHOLDER_IMG }];
    const mainImgUrl = images[0].url;

    // Price history
    let priceChangeHtml = '';
    try {
      const priceHistoryRes = await request(`/vehicles/${id}/price-history`);
      const history = priceHistoryRes?.history || [];
      if (history.length >= 2) {
        const oldest = history[0].price;
        const latest = history[history.length - 1].price;
        const diff = latest - oldest;
        const pct = Math.round(Math.abs(diff) / oldest * 100);
        const days = Math.round((new Date() - new Date(history[0].created_at)) / 86400000);
        if (diff < 0 && pct > 0) {
          priceChangeHtml = `<span class="price-change price-down">&#9660; Bajó ${pct}% (hace ${days} días)</span>`;
        } else if (diff > 0 && pct > 0) {
          priceChangeHtml = `<span class="price-change price-up">&#9650; Subió ${pct}% (hace ${days} días)</span>`;
        }
      }
    } catch {}

    const content = document.getElementById('vehicleDetailContent');
    content.innerHTML = `
      <div class="detail-container">
        <div class="detail-gallery desktop-only">
          <div class="main-image" style="position:relative;">
            <img src="${escapeHtml(mainImgUrl)}" id="detailMainImage" alt="Vehículo" style="cursor:pointer;" onclick="openLightbox(window._detailImages, window._detailImages.indexOf(this.src) >= 0 ? window._detailImages.indexOf(this.src) : 0)">
            ${vehicle.status === 'sold' ? '<div class="detail-sold-overlay"><span>VENDIDO</span></div>' : ''}
          </div>
          <div class="thumbnail-list" id="imageThumbnails">
            ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" class="${i === 0 ? 'active' : ''}" data-url="${escapeHtml(img.url || '')}" data-index="${i}" onclick="document.getElementById('detailMainImage').src=this.dataset.url;this.parentElement.querySelectorAll('img').forEach(x=>x.classList.remove('active'));this.classList.add('active')">`).join('')}
          </div>
        </div>
        <div class="mobile-only" style="overflow-x: auto; scroll-snap-type: x mandatory; gap: 0.5rem; padding-bottom: 0.5rem; margin-bottom: 1.5rem; display:flex; position:relative;">
          ${images.map((img, i) => `<img src="${escapeHtml(img.url || '')}" style="flex: 0 0 92%; scroll-snap-align: center; height: 350px; object-fit: cover; border-radius: var(--radius-lg); cursor:pointer;" onclick="openLightbox(window._detailImages, ${i})">`).join('')}
          ${vehicle.status === 'sold' ? '<div class="detail-sold-overlay" style="border-radius:var(--radius-lg);"><span>VENDIDO</span></div>' : ''}
        </div>
        <div class="detail-info" id="vehicleDetail">
          ${vehicle.status === 'paused' ? '<div class="sold-banner" style="border-color:rgba(245,158,11,0.3);color:var(--primary);background:rgba(245,158,11,0.08);">PAUSADO</div>' : ''}
          <h1>${escapeHtml(vehicle.title)}</h1>
          <p class="detail-subtitle">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</p>
          <div class="detail-price-block">
            <div class="detail-price">USD ${formatNumber(vehicle.price)}${priceChangeHtml}</div>
            ${formatPesos(vehicle.price) ? `<div class="detail-price-ars">${formatPesos(vehicle.price)}</div>` : ''}
          </div>
          <div class="detail-specs">
            <div class="spec-card"><div class="label">Año</div><div class="value">${escapeHtml(String(vehicle.year))}</div></div>
            <div class="spec-card"><div class="label">Kilometraje</div><div class="value">${vehicle.mileage === 0 ? '<span class="badge-nuevo">NUEVO</span>' : formatNumber(vehicle.mileage) + ' km'}</div></div>
            ${vehicle.version ? `<div class="spec-card"><div class="label">Versión</div><div class="value">${escapeHtml(vehicle.version)}</div></div>` : ''}
            <div class="spec-card"><div class="label">Combustible</div><div class="value">${vehicle.fuel || 'N/A'}</div></div>
            <div class="spec-card"><div class="label">Transmisión</div><div class="value">${vehicle.transmission || 'N/A'}</div></div>
            ${vehicle.vehicle_type === 'moto' && vehicle.engine_cc ? `<div class="spec-card"><div class="label">Cilindrada</div><div class="value">${vehicle.engine_cc} cc</div></div>` : ''}
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
              <h4 onclick="viewProfile(${vehicle.seller_id})">${vehicle.seller_verified && vehicle.seller_profile?.dealership_name ? escapeHtml(vehicle.seller_profile.dealership_name) : escapeHtml(vehicle.seller_name)}</h4>
              ${vehicle.seller_verified ? `<div style="margin-bottom:0.5rem;">${verifiedBadge()}</div>` : ''}
              ${vehicle.seller_rating ? `<div class="rating">${'★'.repeat(Math.round(vehicle.seller_rating))}${'☆'.repeat(5-Math.round(vehicle.seller_rating))} <span>(${vehicle.seller_ratings_count} reseñas)</span></div>` : '<div class="rating"><span style="color:var(--text-secondary)">Sin reseñas aún</span></div>'}
              <div class="seller-stats">
                <span><strong>${vehicle.seller_vehicles_count}</strong> vehículos</span>
                <span><strong id="followersCount">${vehicle.seller_followers_count || 0}</strong> seguidores</span>
              </div>
            </div>
            
            ${vehicle.seller_verified && (vehicle.seller_profile?.dealership_address || vehicle.seller_profile?.instagram) || vehicle.seller_profile?.phone ? `
              <div class="seller-contact-actions">
                ${vehicle.seller_verified && vehicle.seller_profile?.dealership_address ? `
                  <span class="seller-contact-link">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    ${escapeHtml(vehicle.seller_profile.dealership_address)}
                  </span>
                ` : ''}
                ${vehicle.seller_profile?.instagram ? `
                  <a href="${escapeHtml(instagramUrl(vehicle.seller_profile.instagram))}" target="_blank" rel="noopener" class="seller-contact-link instagram">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    ${escapeHtml(instagramLabel(vehicle.seller_profile.instagram))}
                  </a>
                ` : ''}
                ${vehicle.seller_profile?.phone && vehicle.status !== 'sold' ? `
                  <a href="https://wa.me/${escapeHtml(vehicle.seller_profile.phone.replace(/[\s\-\(\)]/g,'').replace(/^\+/,''))}" target="_blank" rel="noopener" class="btn btn-primary" style="background:#25D366;border:none;width:100%;margin-top:0.5rem;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right:0.4rem;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> 
                    Contactar por WhatsApp
                  </a>
                ` : ''}
              </div>
            ` : ''}
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
            <button class="btn btn-secondary share-btn" onclick="shareVehicle(${vehicle.id}, '${escapeHtml(vehicle.title).replace(/'/g, '&#39;')}', ${vehicle.price})"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right:0.5rem;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>Compartir</button>
            ${isLoggedIn && (vehicle.status !== 'sold' || isFavorite) ? `<button id="detailFavBtn" class="btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}" onclick="toggleFavorite(${vehicle.id}, event)"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" style="margin-right:0.5rem;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}</button>` : ''}
            ${isLoggedIn && !isOwner ? `<button class="btn btn-ghost" onclick="openReportModal(${vehicle.id})" style="color:var(--text-3);">Reportar esta publicación</button>` : ''}
            ${!isLoggedIn ? `<button class="btn btn-primary" style="width:100%" onclick="showSection('login')">Inicia sesión para contactar</button>` : ''}
          </div>
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
    if (vehicle.city) initVehicleMap(vehicle.city, vehicle.province);
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
  const files = Array.from(e.target.files).slice(0, 12 - uploadedImages.length);
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
      <button class="preview-cover ${i === 0 ? 'active' : ''}" onclick="setCoverImage(${i})">Portada</button>
    </div>
  `).join('');
}

function setCoverImage(index) {
  if (index === 0) return; // already cover
  const item = uploadedImages.splice(index, 1)[0];
  uploadedImages.unshift(item);
  renderImagePreviews();
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
    const title = document.getElementById('publishTitle').value.trim();
    const brand = document.getElementById('publishBrand').value;
    const model = document.getElementById('publishModel').value;
    const year = document.getElementById('publishYear').value;
    const price = getPriceInUSD('publish');
    const fuel = document.getElementById('publishFuel').value;
    const transmission = document.getElementById('publishTransmission').value;
    const description = document.getElementById('publishDescription').value.trim();

    const missing = [];
    if (!title) missing.push('título');
    if (!brand) missing.push('marca');
    if (!model) missing.push('modelo');
    if (!year) missing.push('año');
    if (!price || isNaN(price) || price <= 0) missing.push('precio');
    if (!fuel) missing.push('combustible');
    if (!transmission) missing.push('transmisión');
    if (!province || !city) missing.push('ubicación');
    if (!description) missing.push('descripción');
    if (!uploadedImages.length) missing.push('al menos una foto');

    if (missing.length) {
      showToast(`Completá: ${missing.join(', ')}`, 'error');
      btn.disabled = false;
      btn.textContent = 'Publicar Vehículo';
      return;
    }
    const urls = await uploadImages();
    const data = {
      title: document.getElementById('publishTitle').value,
      brand: document.getElementById('publishBrand').value,
      model: document.getElementById('publishModel').value,
      version: document.getElementById('publishVersion')?.value || '',
      year: document.getElementById('publishYear').value,
      price: getPriceInUSD('publish'),
      transmission: document.getElementById('publishTransmission').value,
      mileage: document.getElementById('publishMileage').value || 0,
      fuel: document.getElementById('publishFuel').value,
      city: city,
      province: province,
      description: document.getElementById('publishDescription').value,
      accepts_trade: document.getElementById('publishAcceptsTrade').checked,
      vehicle_type: document.getElementById('publishVehicleType')?.value || 'auto',
      engine_cc: document.getElementById('publishEngineCC')?.value ? parseInt(document.getElementById('publishEngineCC').value) : null,
      images: urls
    };
    await request('/vehicles', { method: 'POST', body: JSON.stringify(data) });
    showToast('¡Vehículo publicado!', 'success');
    uploadedImages = [];
    renderImagePreviews();
    e.target.reset();
    document.getElementById('publishProvince').value = '';
    document.getElementById('publishCity').innerHTML = '<option value="">Primero seleccioná una provincia</option>';
    document.getElementById('publishCity').disabled = true;
    const pubCur = document.getElementById('publishCurrency');
    if (pubCur) pubCur.dataset.prev = 'USD';
    const pubHint = document.getElementById('publishPriceHint');
    if (pubHint) pubHint.textContent = '';
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
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <span class="vehicle-badge ${v.status === 'sold' ? 'badge-sold' : ''}">${v.status === 'active' ? 'Activo' : v.status === 'sold' ? 'VENDIDO' : v.status === 'paused' ? 'Pausado' : v.status}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
          </div>
          <div class="vehicle-views"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5z"/></svg> ${v.view_count || 0} vistas</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
            <button class="btn btn-secondary" style="flex:1;" onclick="openEditModal(${v.id}, event)">✏️ Editar</button>
            <button class="btn btn-danger" style="flex:1;" onclick="deleteVehicle(${v.id}, event)">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
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
    document.getElementById('editVersion').value = v.version || '';
    const editCurrencyEl = document.getElementById('editCurrency');
    if (editCurrencyEl) { editCurrencyEl.value = 'USD'; editCurrencyEl.dataset.prev = 'USD'; }
    document.getElementById('editPrice').value = v.price || '';
    updatePriceHint('edit');
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
    document.getElementById('editDescription').value = v.description || '';
    document.getElementById('editAcceptsTrade').checked = !!v.accepts_trade;
    const editTypeEl = document.getElementById('editVehicleType');
    if (editTypeEl) editTypeEl.value = v.vehicle_type || 'auto';
    const editCCEl = document.getElementById('editEngineCC');
    if (editCCEl) editCCEl.value = v.engine_cc || '';
    toggleEngineCCField('edit');
    document.getElementById('editVehicleModal').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'block';
  } catch (err) { showToast(err.message, 'error'); }
}

function closeEditModal() {
  document.getElementById('editVehicleModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
  const editCur = document.getElementById('editCurrency');
  if (editCur) { editCur.value = 'USD'; editCur.dataset.prev = 'USD'; }
  const editHint = document.getElementById('editPriceHint');
  if (editHint) editHint.textContent = '';
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
        version: document.getElementById('editVersion').value,
        price: getPriceInUSD('edit'),
        mileage: document.getElementById('editMileage').value,
        fuel: document.getElementById('editFuel').value,
        transmission: document.getElementById('editTransmission').value,
        city: city,
        province: province,
        status: document.getElementById('editStatus').value,
        description: document.getElementById('editDescription').value,
        accepts_trade: document.getElementById('editAcceptsTrade').checked,
        vehicle_type: document.getElementById('editVehicleType')?.value,
        engine_cc: document.getElementById('editEngineCC')?.value ? parseInt(document.getElementById('editEngineCC').value) : null
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
          <img src="${v.images?.[0]?.url || v.image_url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          ${v.status === 'sold' ? '<div class="sold-overlay"><span>VENDIDO</span></div>' : ''}
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</p>
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
          </div>
          ${v.status === 'sold' ? `<button class="btn btn-ghost btn-sm" style="margin-top:0.5rem;color:var(--text-3);width:100%;" onclick="toggleFavorite(${v.id}, event);this.closest('.vehicle-card').remove()">Eliminar de favoritos</button>` : ''}
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleFavorite(id, e) {
  if (e) e.stopPropagation();
  if (!localStorage.getItem('token')) { showToast('Inicia sesión para agregar favoritos', 'error'); return; }
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
      <div class="conversation-item ${String(currentConversationId) === String(c.id) ? 'active' : ''}" onclick="openConversation(${c.id}, this)">
        <div class="conversation-avatar">${c.other_user?.avatar_url ? `<img src="${escapeHtml(c.other_user.avatar_url || '')}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (c.other_user?.username ? c.other_user.username.charAt(0).toUpperCase() : '?')}</div>
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.other_user?.username || 'Usuario')}</div>
          <div class="conversation-vehicle">${escapeHtml(c.vehicle?.title || '')}</div>
          <div class="conversation-preview">${escapeHtml(c.last_message?.startsWith('__TRADE_CARD__') ? 'Propuesta de permuta' : (c.last_message || ''))}</div>
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

    const vehicleImg = vehicle?.image_url || PLACEHOLDER_IMG;

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
          <img src="${escapeHtml(vehicleImg)}" onerror="this.src=PLACEHOLDER_IMG" alt="">
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
        loadUnreadMessageCount();
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
      html += `
        <div class="trade-card" onclick="viewVehicle(${v.id})">
          <div class="trade-card-badge">🔄 Propuesta de permuta</div>
          <div class="trade-card-img">
            <img src="${escapeHtml(v.image) || PLACEHOLDER_IMG}" onerror="this.src=PLACEHOLDER_IMG" alt="${escapeHtml(v.title)}">
          </div>
          <div class="trade-card-body">
            <div class="trade-card-title">${escapeHtml(v.title)}</div>
            <div class="trade-card-sub">${escapeHtml(v.brand)} ${escapeHtml(v.model)} · ${escapeHtml(String(v.year))}</div>
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
  const token = localStorage.getItem('token');
  if (!token) return;

  clearTimeout(wsReconnectTimeout);
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

  // Fallback timeout: si no conecta en 5s, activar polling
  wsReconnectTimeout = setTimeout(function () {
    if (!wsConnected && currentConversationId) {
      startFallbackPolling();
    }
  }, 5000);
}

function destroyWebSocket() {
  clearTimeout(wsReconnectTimeout);
  wsReconnectTimeout = null;
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
};
function notifIcon(type) {
  const svg = NOTIF_ICONS[type] || `<svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>`;
  const colors = { message:'#60a5fa', trade_offer:'#f59e0b', trade_accepted:'#22c55e', trade_rejected:'#ef4444', follow:'#a78bfa', new_vehicle:'#f59e0b', rating:'#facc15', favorite_sold:'#ef4444' };
  const bg = colors[type] || 'var(--text-3)';
  return `<div class="notification-icon" style="background:${bg}22;color:${bg};">${svg}</div>`;
}

async function loadNotifications() {
  try {
    // Auto-mark all as read when viewing notifications
    request('/notifications/read-all', { method: 'PUT' }).catch(() => {});
    const badge = document.getElementById('notificationsBadge');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    const notifications = await request('/notifications');
    const container = document.getElementById('notificationsList');
    if (!notifications?.length) { container.innerHTML = '<div class="empty-state"><p>Sin notificaciones</p></div>'; return; }
    container.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" data-link="${escapeHtml(n.link || '')}" data-notif-id="${n.id}" onclick="handleNotificationClick(this.dataset.link, this.dataset.notifId)">
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
    const canFollow = !isOwn && !!localStorage.getItem('token');
    
    // Header content
    let headerHtml = `
      ${completenessHtml}
      <div class="profile-header">
        <div class="profile-avatar-wrapper">
          <div class="profile-avatar">
            ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url || '')}" alt="">` : profile.username?.charAt(0).toUpperCase()}
          </div>
        </div>
        
        <h2>${escapeHtml(profile.username)}</h2>
        ${profile.is_verified ? verifiedBadge() : ''}
        
        ${profile.rating ? `
          <div class="rating">
            ${'★'.repeat(Math.round(profile.rating))}${'☆'.repeat(5-Math.round(profile.rating))} 
            <span>(${profile.ratings_count} reseñas)</span>
          </div>
        ` : '<p style="color:var(--text-3); margin-top:0.5rem;">Sin reseñas aún</p>'}
        
        ${profile.city ? `
          <div class="location">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            ${escapeHtml(profile.city)}${(() => { const m = AR_CITIES.find(c => c.city === profile.city); return m ? ', ' + escapeHtml(m.prov.replace(/\s*\(.*?\)/g,'').trim()) : ''; })()}
          </div>
        ` : ''}
        
        ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
        
        <div class="profile-actions-grid">
          ${profile.instagram ? `
            <a href="${escapeHtml(instagramUrl(profile.instagram))}" target="_blank" rel="noopener" class="profile-action-btn instagram">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> 
              Instagram
            </a>
          ` : ''}
          ${profile.phone ? `
            <a href="https://wa.me/${escapeHtml(profile.phone.replace(/[\\s\\-\\(\\)]/g,'').replace(/^\\+/,''))}" target="_blank" rel="noopener" class="profile-action-btn whatsapp">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> 
              WhatsApp
            </a>
          ` : ''}
          ${isOwn ? `
            <button class="profile-action-btn" onclick="showSection('profile'); editProfile()">
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
    const vehicles = await request(`/vehicles?user_id=${id}`).catch(() => ({ vehicles: [] }));
    document.getElementById('profileVehiclesList').innerHTML = vehicles.vehicles?.length ? vehicles.vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container"><img src="${v.images?.[0]?.url || v.image_url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG"></div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
          </div>
          <span class="vehicle-trade-badge ${v.accepts_trade ? 'trade-yes' : 'trade-no'}" style="position:static;display:inline-block;margin-top:0.3rem;">${v.accepts_trade ? '🔄 Permuta' : 'Sin permuta'}</span>
          ${isViewerAdmin && !isOwn ? `<button class="btn btn-sm btn-danger" style="margin-top:0.5rem;width:100%;" data-vid="${v.id}" data-title="${escapeHtml(v.title)}" onclick="event.stopPropagation(); adminDeleteVehicle(+this.dataset.vid, this.dataset.title)">🗑 Eliminar</button>` : ''}
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
  document.getElementById('editProfileModalBody').innerHTML = `
    <form onsubmit="saveProfile(event)" style="padding:0.25rem 0;">
      <div class="form-group" style="margin-bottom:1rem;">
        <label>Foto de perfil</label>
        <div style="display:flex;align-items:center;gap:1rem;">
          <div class="profile-avatar" style="width:60px;height:60px;margin:0;" id="editAvatarPreview">${currentUser.profile?.avatar_url ? `<img src="${currentUser.profile.avatar_url}">` : currentUser.username.charAt(0).toUpperCase()}</div>
          <input type="file" id="editAvatarFile" accept="image/*" onchange="previewProfileImage(event)" style="flex:1;">
        </div>
        <input type="hidden" id="editAvatarBase64" value="${currentUser.profile?.avatar_url || ''}">
      </div>
      <div class="form-group"><label for="editUsername">Nombre de usuario</label><input type="text" id="editUsername" value="${escapeHtml(currentUser.username || '')}" placeholder="tunombre" minlength="3"></div>
      <div class="form-group"><label for="editPhone">Teléfono</label><input type="tel" id="editPhone" value="${escapeHtml(currentUser.profile?.phone || '')}" placeholder="+54..."></div>
      <div class="form-group"><label for="editProfileProvince">Provincia</label><select id="editProfileProvince" onchange="onEditProfileProvinceChange()"><option value="">Seleccioná una provincia</option>${AR_PROVINCES.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}</select></div>
      <div class="form-group"><label for="editProfileCity">Ciudad</label><select id="editProfileCity"><option value="">Seleccioná una ciudad</option></select></div>
      <div class="form-group"><label for="editBio">Bio</label><textarea id="editBio" rows="3" placeholder="Cuéntanos sobre ti...">${escapeHtml(currentUser.profile?.bio || '')}</textarea></div>
      ${currentUser.profile?.is_verified ? `
        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
          <h4 style="font-size:0.95rem;margin-bottom:0.75rem;color:var(--primary);">Datos de concesionaria (verificado)</h4>
          <div class="form-group"><label>Nombre de la concesionaria</label><input type="text" id="editDealershipName" value="${escapeHtml(currentUser.profile?.dealership_name || '')}" placeholder="Ej: Autos Premium SRL"></div>
          <div class="form-group"><label>Dirección de la concesionaria</label><input type="text" id="editDealershipAddress" value="${escapeHtml(currentUser.profile?.dealership_address || '')}" placeholder="Ej: Av. Libertador 1234, CABA"></div>
          <div class="form-group"><label>Instagram</label><input type="text" id="editInstagram" value="${escapeHtml(currentUser.profile?.instagram || '')}" placeholder="https://instagram.com/tuconcesionaria"><small style="color:var(--text-secondary);font-size:0.78rem;">Pegá el enlace completo de tu perfil de Instagram</small></div>
        </div>
      ` : ''}
      <div style="display:flex;gap:0.75rem;margin-top:1.25rem;">
        <button type="button" class="btn btn-ghost" style="flex:1;" onclick="closeEditProfileModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" style="flex:2;">Guardar</button>
      </div>
    </form>
  `;
  document.getElementById('editProfileModal').style.display = 'flex';
  document.getElementById('modalOverlay').style.display = 'block';
  setTimeout(initEditProfileCity, 0);
}

function closeEditProfileModal() {
  document.getElementById('editProfileModal').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'none';
}

function onEditProfileProvinceChange() {
  const prov = document.getElementById('editProfileProvince')?.value;
  const cityEl = document.getElementById('editProfileCity');
  if (!cityEl) return;
  const cities = AR_CITIES.filter(c => c.prov === prov);
  cityEl.innerHTML = '<option value="">Seleccioná una ciudad</option>' +
    cities.map(c => `<option value="${escapeHtml(c.city)}">${escapeHtml(c.city)}</option>`).join('');
}

function initEditProfileCity() {
  const savedCity = currentUser.profile?.city || '';
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
      username: document.getElementById('editUsername')?.value?.trim() || currentUser.username,
      phone: document.getElementById('editPhone').value,
      city: document.getElementById('editProfileCity')?.value || '',
      bio: document.getElementById('editBio').value,
      avatar_url: avatarUrl,
      dealership_name: document.getElementById('editDealershipName')?.value ?? '',
      dealership_address: document.getElementById('editDealershipAddress')?.value ?? '',
      instagram: document.getElementById('editInstagram')?.value ?? '',
    }) });
    showToast('Perfil actualizado', 'success');
    closeEditProfileModal();
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

function showAdminTab(tab, el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  (el || document.querySelector(`.admin-tab[onclick*="'${tab}'"]`))?.classList.add('active');
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
                ${r.vehicle?.id ? `<button class="btn btn-sm btn-danger" data-vid="${r.vehicle.id}" data-title="${escapeHtml(r.vehicle.title || '')}" onclick="adminDeleteVehicle(+this.dataset.vid, this.dataset.title)">🗑 Eliminar pub.</button>` : ''}
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
                  <td>
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
  lightboxIndex = typeof startIndex === 'number' ? startIndex : 0;
  const modal = document.getElementById('lightboxModal');
  // Render thumbnail strip
  const thumbsEl = document.getElementById('lightboxThumbs');
  if (thumbsEl) {
    if (images.length > 1) {
      thumbsEl.innerHTML = images.map((url, i) =>
        `<img src="${url}" class="lightbox-thumb${i === lightboxIndex ? ' active' : ''}" data-index="${i}" onclick="lightboxSetIndex(${i})" alt="">`
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
  modal.style.display = 'flex';
}
function closeLightbox(e) {
  if (e && e.target && e.target.tagName === 'IMG') return;
  document.getElementById('lightboxModal').style.display = 'none';
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

// Builds a proper Instagram URL from a handle (@foo, foo) or a full URL
function instagramUrl(val) {
  if (!val) return '';
  const v = val.trim();
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

function shareVehicle(id, title, price) {
  const url = `${window.location.origin}${window.location.pathname}?vehicle=${id}`;
  const text = `🚗 ${title}\n💰 $${Number(price).toLocaleString('es-AR')}\n${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  const existing = document.getElementById('shareDropdown');
  if (existing) { existing.remove(); return; }

  const dropdown = document.createElement('div');
  dropdown.id = 'shareDropdown';
  dropdown.className = 'share-dropdown';
  dropdown.innerHTML = `
    <a href="${escapeHtml(waUrl)}" target="_blank" rel="noopener" class="share-option">
      <span>📱</span> Compartir por WhatsApp
    </a>
    <button class="share-option" id="copyLinkBtn">
      <span>🔗</span> Copiar link
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
    const res = await request('/vehicles?limit=200&status=active');
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
  if (!localStorage.getItem('token')) return;
  try {
    const vehicles = await request('/favorites');
    userFavoriteIds = new Set((vehicles || []).map(v => v.id));
  } catch { /* silencioso */ }
}

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      currentUser = await request('/user');
      if (currentUser.profile?.is_admin) document.getElementById('navAdmin').style.display = 'inline';
      updateNav();
      loadCounts();
      request('/ping', { method: 'PUT' }).catch(() => {});
      loadUserFavoriteIds();
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
  } else {
    showSection('home');
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

initBrandFilters();
updateVehicleTypeOptions('publish');
updateVehicleTypeOptions('filter');

function autoFillTitle() {
  const brand = document.getElementById('publishBrand')?.value || '';
  const model = document.getElementById('publishModel')?.value || '';
  const version = document.getElementById('publishVersion')?.value || '';
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
document.getElementById('publishYear')?.addEventListener('input', autoFillTitle);

const yearInput = document.getElementById('publishYear');
if (yearInput) yearInput.max = new Date().getFullYear() + 1;

// MOBILE ACCOUNT MENU
function toggleMobileMenu() {
  const menu = document.getElementById('mobileAccountMenu');
  if (menu.style.display === 'none' || menu.style.display === '') {
    document.getElementById('mobileMenuUsername').textContent = currentUser?.username || '';
    const adminItem = document.getElementById('mobileMenuAdmin');
    if (adminItem) adminItem.style.display = currentUser?.profile?.is_admin ? 'flex' : 'none';
    menu.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
  } else {
    menu.style.display = 'none';
  }
}
function closeMobileMenu() {
  const menu = document.getElementById('mobileAccountMenu');
  if (menu) menu.style.display = 'none';
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
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location">📍 ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
            ${(() => {
              const ph = v.price_history;
              if (ph && ph.length >= 2) {
                const oldest = ph[0].price;
                const latest = ph[ph.length - 1].price;
                const diff = latest - oldest;
                const pct = Math.round(Math.abs(diff) / oldest * 100);
                if (diff < 0 && pct > 0) return `<span class="price-drop-badge">↓ ${pct}%</span>`;
              }
              return '';
            })()}
          </div>
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              <span>${escapeHtml(v.seller_name || 'Anónimo')}</span>
              ${v.seller_verified ? verifiedBadge() : ''}
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
  // Show skeletons
  container.innerHTML = Array(6).fill().map(() => `
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
      container.innerHTML = '<div class="empty-state"><p>No hay vehículos publicados aún</p></div>';
      return;
    }
    container.innerHTML = vehicles.slice(0, 6).map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || PLACEHOLDER_IMG}" class="vehicle-image" alt="${escapeHtml(v.title)}" loading="lazy" onerror="this.src=PLACEHOLDER_IMG">
          <div class="vehicle-img-overlay"></div>
          <span class="vehicle-badge">${escapeHtml(String(v.year))}</span>
          ${v.status === 'sold' ? '<span class="vehicle-badge badge-sold">VENDIDO</span>' : ''}
          ${v.status !== 'sold' ? `<span class="vehicle-trade-badge ${v.accepts_trade ? 'trade-yes' : 'trade-no'}">${v.accepts_trade ? '🔄 Permuta' : 'Sin permuta'}</span>` : ''}
          ${v.status !== 'sold' ? `<button class="favorite-btn ${userFavoriteIds.has(v.id) ? 'active' : ''}" data-vehicle-id="${v.id}" onclick="toggleFavorite(${v.id}, event)"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          ${v.city ? `<p class="vehicle-location"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> ${escapeHtml(v.city)}${v.province ? ', ' + escapeHtml(v.province.replace(/\s*\(.*?\)/g,'').trim()) : ''}</p>` : ''}
          <div class="vehicle-price-block">
            <p class="vehicle-price">USD ${formatNumber(v.price)}</p>
            ${formatPesos(v.price) ? `<p class="vehicle-price-ars">${formatPesos(v.price)}</p>` : ''}
          </div>
          <div class="vehicle-meta">
            ${v.mileage === 0 ? '<span class="badge-nuevo">NUEVO</span>' : `<span>${formatNumber(v.mileage)} km</span>`}
            <span>${escapeHtml(v.fuel || 'N/A')}</span>
            ${v.transmission ? `<span>${escapeHtml(v.transmission)}</span>` : ''}
          </div>
          <div class="vehicle-card-footer">
            <div class="vehicle-seller">
              <div class="avatar-tiny">${v.seller_name?.charAt(0)?.toUpperCase()}</div>
              <span>${escapeHtml(v.seller_name || 'Anónimo')}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    applyCardCascade(container);
  } catch { container.innerHTML = ''; }
}

function applyCardCascade(container) {
  container.querySelectorAll('.vehicle-card[onclick]').forEach((card, i) => {
    card.style.animationDelay = `${i * 65}ms`;
  });
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
loadDolarRate();
dolarRateInterval = setInterval(loadDolarRate, 10 * 60 * 1000);

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
          ${formatPesos(v.price) ? `<p class="similar-card-ars">${formatPesos(v.price)}</p>` : ''}
          <p class="similar-card-meta">${v.year} · ${formatNumber(v.mileage)} km · ${escapeHtml(v.city || '')}</p>
        </div>
      </div>
    `).join('');
  } catch {
    document.getElementById('similarVehiclesSection')?.remove();
  }
}
