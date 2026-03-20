let currentUser = null;
let currentVehicleId = null;
let currentConversationId = null;
let currentProfileId = null;
let pollingInterval = null;
let searchTimeout = null;
let uploadedImages = [];
let reportVehicleId = null;
let rateConversationId = null;
let rateRecipientId = null;

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

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();
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
  else if (sectionId === 'messages') loadConversations();
  else if (sectionId === 'favorites') loadFavorites();
  else if (sectionId === 'notifications') loadNotifications();
  else if (sectionId === 'admin') loadAdmin();
  if (sectionId !== 'messages' && sectionId !== 'vehicle-detail') stopPolling();
  if (sectionId !== 'messages') currentConversationId = null;
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
  btn.disabled = false;
  btn.textContent = originalText;
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
  btn.disabled = false;
  btn.textContent = originalText;
}

function logout() {
  localStorage.removeItem('token');
  currentUser = null;
  uploadedImages = [];
  updateNav();
  showToast('Sesión cerrada', 'success');
  showSection('home');
}

// VEHICLES
async function loadVehicles(page = 1) {
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('searchInput')?.value;
    if (search) params.append('search', search);
    ['brand', 'model', 'minPrice', 'maxPrice', 'minYear', 'maxYear', 'fuel', 'city', 'sort'].forEach(key => {
      const el = document.getElementById('filter' + key.charAt(0).toUpperCase() + key.slice(1));
      if (el?.value) params.append(key, el.value);
    });
    params.append('page', page);
    const { vehicles, total } = await request(`/vehicles?${params}`);
    const container = document.getElementById('vehiclesList');
    document.getElementById('vehiclesCount').textContent = `${total} vehículo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
    if (!vehicles?.length) {
      container.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg><h3>No hay vehículos</h3><p>Sé el primero en publicar</p></div>';
      return;
    }
    container.innerHTML = vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container">
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'">
          <span class="vehicle-badge">${v.year}</span>
          ${localStorage.getItem('token') ? `<button class="favorite-btn ${v.is_favorite ? 'active' : ''}" onclick="toggleFavorite(${v.id}, event)"><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>` : ''}
        </div>
        <div class="vehicle-info">
          <h3 class="vehicle-title">${escapeHtml(v.title)}</h3>
          <p class="vehicle-brand">${escapeHtml(v.brand)} ${escapeHtml(v.model)}${v.city ? ` - ${escapeHtml(v.city)}` : ''}</p>
          <p class="vehicle-price">$${formatNumber(v.price)}</p>
          <div class="vehicle-meta">
            <span>${formatNumber(v.mileage || 0)} km</span>
            <span>${v.fuel || 'N/A'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem;">
            <div class="vehicle-views" style="margin-top:0;"><svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg> ${v.views || 0} vistas</div>
            <div style="font-size:0.8rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.25rem;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              ${escapeHtml(v.seller_name || 'Anónimo')}
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
  ['filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxYear', 'filterBrand', 'filterModel', 'filterFuel', 'filterCity', 'filterSort'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('filterModel').innerHTML = '<option value="">Todos</option>';
  loadVehicles(1);
}

function initBrandFilters() {
  const select = document.getElementById('filterBrand');
  if (!select || select.options.length > 1) return;
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
    const isOwner = currentUser?.id === vehicle.seller_id;
    const isLoggedIn = !!localStorage.getItem('token');
    let isFavorite = false;
    if (isLoggedIn) {
      try { const r = await request(`/favorites/${id}/check`); isFavorite = r.favorited; } catch {}
    }

    const images = [{ url: vehicle.vehicle_images?.[0]?.url || vehicle.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=600&fit=crop' }, ...(vehicle.vehicle_images || [])].filter((v, i, a) => v.url && a.findIndex(x => x.url === v.url) === i);
    const mainImgUrl = images[0].url;

    const content = document.getElementById('vehicleDetailContent');
    content.innerHTML = `
      <div class="detail-grid">
        <div class="detail-gallery">
          <div class="main-image">
            <img src="${mainImgUrl}" id="detailMainImage" alt="Vehículo">
          </div>
          <div class="thumbnail-list" id="imageThumbnails">
            ${images.map((img, i) => `<img src="${img.url}" class="${i === 0 ? 'active' : ''}" onclick="document.getElementById('detailMainImage').src='${img.url}';this.parentElement.querySelectorAll('img').forEach(x=>x.classList.remove('active'));this.classList.add('active')">`).join('')}
          </div>
        </div>
        <div class="detail-info" id="vehicleDetail">
          <h1>${escapeHtml(vehicle.title)}</h1>
          <p class="detail-subtitle">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</p>
          <p class="detail-price">$${formatNumber(vehicle.price)}</p>
          <div class="detail-specs">
            <div class="spec-card"><div class="label">Año</div><div class="value">${vehicle.year}</div></div>
            <div class="spec-card"><div class="label">Kilometraje</div><div class="value">${formatNumber(vehicle.mileage || 0)} km</div></div>
            <div class="spec-card"><div class="label">Combustible</div><div class="value">${vehicle.fuel || 'N/A'}</div></div>
            <div class="spec-card"><div class="label">Ciudad</div><div class="value">${vehicle.city || 'No especificada'}</div></div>
          </div>
          ${vehicle.description ? `<div class="detail-description"><h4>Descripción</h4><p>${escapeHtml(vehicle.description)}</p></div>` : ''}
          <div class="seller-card">
            <div class="seller-avatar">${vehicle.seller_profile?.avatar_url ? `<img src="${vehicle.seller_profile.avatar_url}" alt="">` : vehicle.seller_name?.charAt(0).toUpperCase()}</div>
            <div class="seller-info">
              <h4 onclick="viewProfile(${vehicle.seller_id})" style="cursor:pointer;color:var(--primary-light);">${escapeHtml(vehicle.seller_name)}</h4>
              ${vehicle.seller_rating ? `<div class="rating">${'★'.repeat(Math.round(vehicle.seller_rating))}${'☆'.repeat(5-Math.round(vehicle.seller_rating))} <span>(${vehicle.seller_ratings_count} reseñas)</span></div>` : '<div class="rating"><span style="color:var(--text-secondary)">Sin reseñas</span></div>'}
              <div class="seller-stats"><span>${vehicle.seller_vehicles_count} vehículos</span></div>
            </div>
          </div>
          
          ${isLoggedIn && !isOwner ? `
            <div class="marketplace-chat-box" style="margin-top:1.5rem;background:var(--dark-2);padding:1.5rem;border-radius:var(--radius-lg);border:1px solid var(--border);">
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
          ` : ''}

          <div class="detail-actions" style="margin-top:1.5rem;display:flex;gap:1rem;flex-direction:column;">
            ${isLoggedIn ? `<button class="btn ${isFavorite ? 'btn-primary' : 'btn-secondary'}" onclick="toggleFavorite(${vehicle.id}, event)"><svg width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" style="margin-right:0.5rem;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>${isFavorite ? 'En favoritos' : 'Guardar en favoritos'}</button>` : ''}
            ${isLoggedIn && !isOwner ? `<button class="btn btn-ghost" onclick="openReportModal(${vehicle.id})" style="color:var(--text-3);">Reportar esta publicación</button>` : ''}
            ${!isLoggedIn ? `<button class="btn btn-primary" style="width:100%" onclick="showSection('login')">Inicia sesión para contactar</button>` : ''}
          </div>
        </div>
      </div>
    `;
    showSection('vehicle-detail');
  } catch (err) { showToast(err.message, 'error'); }
}

// PUBLISH
function handleImageSelect(e) {
  const files = Array.from(e.target.files).slice(0, 5 - uploadedImages.length);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      uploadedImages.push({ file, preview: ev.target.result });
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

async function uploadImages() {
  const urls = [];
  for (const img of uploadedImages) {
    if (img.url) { urls.push(img.url); continue; }
    const formData = new FormData();
    formData.append('image', img.file);
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
    const data = await res.json();
    urls.push(data.url);
  }
  return urls;
}

function renderImagePreviews() {
  const container = document.getElementById('imagePreview');
  container.innerHTML = uploadedImages.map((img, i) => `
    <div class="image-preview-item ${i === 0 ? 'primary' : ''}">
      <img src="${img.preview || img.url}" alt="">
      <button class="remove-btn" onclick="removeImage(${i})">&times;</button>
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
      city: document.getElementById('publishCity').value,
      description: document.getElementById('publishDescription').value,
      images: urls
    };
    await request('/vehicles', { method: 'POST', body: JSON.stringify(data) });
    showToast('¡Vehículo publicado!', 'success');
    uploadedImages = [];
    e.target.reset();
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
          <img src="${v.images?.find(i => i.is_primary)?.url || v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" alt="${escapeHtml(v.title)}" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'">
          <span class="vehicle-badge">${v.status === 'active' ? 'Activo' : v.status}</span>
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
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteVehicle(id, e) {
  e.stopPropagation();
  if (!confirm('¿Eliminar este vehículo?')) return;
  try { await request(`/vehicles/${id}`, { method: 'DELETE' }); showToast('Eliminado', 'success'); loadMyVehicles(); } catch (err) { showToast(err.message, 'error'); }
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
    document.getElementById('editCity').value = v.city || '';
    document.getElementById('editStatus').value = v.status || 'active';
    document.getElementById('editDescription').value = v.description || '';
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
    await request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: document.getElementById('editTitle').value,
        price: document.getElementById('editPrice').value,
        mileage: document.getElementById('editMileage').value,
        fuel: document.getElementById('editFuel').value,
        transmission: document.getElementById('editTransmission').value,
        city: document.getElementById('editCity').value,
        status: document.getElementById('editStatus').value,
        description: document.getElementById('editDescription').value
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
    if (document.getElementById('vehicle-detail')?.style.display !== 'none') viewVehicle(id);
    else loadVehicles();
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

async function loadConversations() {
  try {
    const conversations = await request('/conversations');
    const container = document.getElementById('conversationsListContent');
    if (!conversations?.length) { container.innerHTML = '<div class="empty-state" style="padding:2rem;"><p>Sin conversaciones</p></div>'; renderEmptyChat(); return; }
    container.innerHTML = conversations.map(c => `
      <div class="conversation-item ${currentConversationId === c.id ? 'active' : ''}" onclick="openConversation(${c.id})">
        <div class="conversation-avatar">${c.other_user?.username?.charAt(0).toUpperCase()}</div>
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.other_user?.username || 'Usuario')}</div>
          <div class="conversation-vehicle">${escapeHtml(c.vehicle?.title || '')}</div>
          <div class="conversation-preview">${escapeHtml(c.last_message || '')}</div>
        </div>
        <div class="conversation-meta">
          <span class="conversation-time">${formatRelTime(c.updated_at)}</span>
        </div>
      </div>
    `).join('');
    if (currentConversationId) loadChatMessages(currentConversationId);
    else renderEmptyChat();
  } catch (err) { console.error(err); }
}

async function openConversation(convId) {
  currentConversationId = convId;
  document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
  loadChatMessages(convId);
  startPolling();
}

async function loadChatMessages(convId, isPolling = false) {
  try {
    const conv = await request(`/conversations/${convId}`);
    const messages = await request(`/conversations/${convId}/messages`);
    const otherUser = conv.buyer_id === currentUser?.id ? conv.seller : conv.buyer;
    const vehicle = conv.vehicle;
    const chatView = document.getElementById('chatView');

    // Solo reconstruir el layout completo la primera vez (o si el header no existe)
    if (!isPolling || !chatView.querySelector('.chat-active-header')) {
      let vehicleImg = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=120&h=80&fit=crop';
      try {
        const vData = await request(`/vehicles/${vehicle?.id}`);
        vehicleImg = vData.vehicle_images?.[0]?.url || vData.image_url || vehicleImg;
      } catch {}

      chatView.innerHTML = `
        <div class="chat-active-header">
          <div class="conversation-avatar">${otherUser?.username?.charAt(0).toUpperCase()}</div>
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

          ${conv.buyer_id === currentUser?.id ? `<button class="chat-header-btn" onclick="openRateModal(${convId}, ${otherUser?.id})" title="Calificar">★</button>` : ''}
        </div>

        <div class="chat-messages-container" id="chatMessagesContainer"></div>
        <div class="chat-input-container"><input type="text" id="chatMessageInput" placeholder="Escribe un mensaje..." onkeypress="if(event.key==='Enter')sendMessage()"><button class="btn btn-primary" onclick="sendMessage()"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></div>
      `;
    }

    // Actualizar solo los mensajes (sin borrar el input)
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (messagesContainer) {
      const messagesHtml = messages.map(m => `<div class="chat-bubble ${m.sender_id === currentUser?.id ? 'sent' : 'received'}">${m.sender_id !== currentUser?.id ? `<div class="sender">${escapeHtml(m.username)}</div>` : ''}<div class="content">${escapeHtml(m.content)}</div><div class="time">${formatTime(m.created_at)}</div></div>`).join('');
      messagesContainer.innerHTML = messagesHtml;
    }

    const onlineStatusEl = document.getElementById('chatOnlineStatus');
    if (onlineStatusEl) {
      const lastSeenStr = otherUser?.profiles?.length ? otherUser.profiles[0].last_seen : (otherUser?.profiles?.last_seen || null);
      if (lastSeenStr) {
        const diffMinutes = Math.floor((Date.now() - new Date(lastSeenStr)) / 60000);
        if (diffMinutes < 3) {
           onlineStatusEl.textContent = 'En línea 🟢';
           onlineStatusEl.style.color = 'var(--success)';
        } else {
           onlineStatusEl.textContent = 'Últ. vez: ' + formatRelTime(lastSeenStr);
           onlineStatusEl.style.color = 'var(--text-secondary)';
        }
      } else {
        onlineStatusEl.textContent = 'Desconectado';
        onlineStatusEl.style.color = 'var(--text-secondary)';
      }
    }

    if (!isPolling) scrollChat(); // Only scroll down on initial open or new message
  } catch (err) { showToast(err.message, 'error'); }
}

async function sendMessage() {
  const input = document.getElementById('chatMessageInput');
  const content = input?.value.trim();
  if (!content || !currentConversationId) return;
  try {
    await request(`/conversations/${currentConversationId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
    if (input) input.value = '';
    loadChatMessages(currentConversationId);
  } catch (err) { showToast(err.message, 'error'); }
}

function renderEmptyChat() {
  document.getElementById('chatView').innerHTML = '<div class="chat-empty"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg><p>Selecciona una conversación</p></div>';
}

function scrollChat() { setTimeout(() => { const c = document.getElementById('chatMessagesContainer'); if (c) c.scrollTop = c.scrollHeight; }, 100); }
function startPolling() { 
  stopPolling(); 
  pollingInterval = setInterval(() => { 
    if (currentConversationId) {
      const isAtBottom = hasUserScrolledToBottom();
      loadChatMessages(currentConversationId, true).then(() => {
        if (isAtBottom) scrollChat();
      });
    }
  }, 3000); 
}
function stopPolling() { if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } }

function hasUserScrolledToBottom() {
  const c = document.getElementById('chatMessagesContainer');
  if(!c) return true; // Default to scroll down if not found
  // If user is within 50px of the bottom, consider them at the bottom
  return c.scrollHeight - c.scrollTop - c.clientHeight < 50;
}

// HEARTBEAT
setInterval(() => {
  if (currentUser && document.visibilityState === 'visible') {
    request('/ping', { method: 'PUT' }).catch(() => {});
  }
}, 60000);

// NOTIFICATIONS
async function loadNotifications() {
  try {
    const notifications = await request('/notifications');
    const container = document.getElementById('notificationsList');
    if (!notifications?.length) { container.innerHTML = '<div class="empty-state"><p>Sin notificaciones</p></div>'; return; }
    container.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.link || ''}', ${n.id})">
        <div class="notification-icon"><svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg></div>
        <div class="notification-content"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.message)}</p><div class="notification-time">${formatRelTime(n.created_at)}</div></div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}

async function loadNotificationCount() {
  try {
    const { count } = await request('/notifications/count');
    const badge = document.getElementById('notificationsBadge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline' : 'none'; }
  } catch {}
}

function handleNotificationClick(link, id) {
  request(`/notifications/${id}/read`, { method: 'PUT' }).catch(() => {});
  loadNotificationCount();
  if (link.includes('messages/')) openConversation(parseInt(link.split('/').pop()), event?.currentTarget);
  else if (link.includes('vehicle/')) viewVehicle(parseInt(link.split('/').pop()));
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
    document.getElementById('profileHeader').innerHTML = `
      <div class="profile-avatar">${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="">` : profile.username?.charAt(0).toUpperCase()}</div>
      <h2>${escapeHtml(profile.username)}</h2>
      ${profile.rating ? `<div class="rating">${'★'.repeat(Math.round(profile.rating))}${'☆'.repeat(5-Math.round(profile.rating))} <span>(${profile.ratings_count} reseñas)</span></div>` : '<p style="color:var(--text-secondary)">Sin reseñas</p>'}
      ${profile.city ? `<p style="color:var(--text-secondary)">${escapeHtml(profile.city)}</p>` : ''}
      ${profile.bio ? `<p style="margin-top:0.5rem;font-size:0.9rem">${escapeHtml(profile.bio)}</p>` : ''}
      <div class="stats"><span>${profile.vehicles_count || 0} vehículos publicados</span></div>
      ${isOwn ? `<button class="btn btn-secondary" style="margin-top:1rem" onclick="showSection('profile'); editProfile()">Editar perfil</button>` : ''}
    `;
    const vehicles = await request(`/vehicles?user_id=${id}`).catch(() => ({ vehicles: [] }));
    document.getElementById('profileVehiclesList').innerHTML = vehicles.vehicles?.length ? vehicles.vehicles.map(v => `
      <div class="vehicle-card" onclick="viewVehicle(${v.id})">
        <div class="vehicle-image-container"><img src="${v.images?.[0]?.url || v.image_url || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'}" class="vehicle-image" onerror="this.src='https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=300&fit=crop'"></div>
        <div class="vehicle-info"><h3 class="vehicle-title">${escapeHtml(v.title)}</h3><p class="vehicle-price">$${formatNumber(v.price)}</p></div>
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

function previewProfileImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('editAvatarBase64').value = evt.target.result;
    document.getElementById('editAvatarPreview').innerHTML = `<img src="${evt.target.result}">`;
  };
  reader.readAsDataURL(file);
}

async function saveProfile(e) {
  e.preventDefault();
  try {
    await request('/profile', { method: 'PUT', body: JSON.stringify({
      username: document.getElementById('editUsername').value,
      phone: document.getElementById('editPhone').value,
      city: document.getElementById('editCity').value,
      bio: document.getElementById('editBio').value,
      avatar_url: document.getElementById('editAvatarBase64').value
    }) });
    showToast('Perfil actualizado', 'success');
    currentUser = await request('/user');
    updateNav();
    if (currentProfileId) viewProfile(currentProfileId);
  } catch (err) { showToast(err.message, 'error'); }
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
  event?.currentTarget?.classList?.add('active') || document.querySelector(`.admin-tab[onclick*="${tab}"]`)?.classList.add('active');
  if (tab === 'reports') loadAdminReports();
  else if (tab === 'users') loadAdminUsers();
}

async function loadAdminReports() {
  try {
    const reports = await request('/admin/reports');
    document.getElementById('adminContent').innerHTML = reports?.length ? `
      <table class="admin-table"><thead><tr><th>Fecha</th><th>Vehículo</th><th>Reportado por</th><th>Razón</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        ${reports.map(r => `
          <tr>
            <td>${formatRelTime(r.created_at)}</td>
            <td><a href="#" onclick="viewVehicle(${r.vehicle?.id})">${escapeHtml(r.vehicle?.title || 'N/A')}</a></td>
            <td>${escapeHtml(r.reporter?.username || 'N/A')}</td>
            <td>${escapeHtml(r.reason)}</td>
            <td><span style="color:${r.status === 'pending' ? 'var(--warning)' : 'var(--success)'}">${r.status}</span></td>
            <td>
              ${r.status === 'pending' ? `
                <button class="btn btn-secondary" onclick="resolveReport(${r.id}, 'resolved')">Resolver</button>
                <button class="btn btn-danger" onclick="resolveReport(${r.id}, 'dismissed')">Descartar</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody></table>
    ` : '<p>Sin reportes</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function resolveReport(id, status) {
  try { await request(`/admin/reports/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }); showToast('Reporte resuelto', 'success'); loadAdminReports(); } catch (err) { showToast(err.message, 'error'); }
}

async function loadAdminUsers() {
  try {
    const users = await request('/admin/users');
    document.getElementById('adminContent').innerHTML = users?.length ? `
      <table class="admin-table"><thead><tr><th>Usuario</th><th>Email</th><th>Fecha</th><th>Vehículos</th><th>Admin</th></tr></thead><tbody>
        ${users.map(u => `
          <tr>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${formatRelTime(u.created_at)}</td>
            <td>${u.vehicles?.[0]?.count || 0}</td>
            <td>
              <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                <input type="checkbox" ${u.profiles?.[0]?.is_admin ? 'checked' : ''} onchange="toggleAdmin(${u.id}, this.checked)">
                Admin
              </label>
            </td>
          </tr>
        `).join('')}
      </tbody></table>
    ` : '<p>Sin usuarios</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

async function toggleAdmin(id, isAdmin) {
  try { await request(`/admin/users/${id}/admin`, { method: 'PUT', body: JSON.stringify({ is_admin: isAdmin }) }); showToast('Actualizado', 'success'); } catch (err) { showToast(err.message, 'error'); }
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

function openRateModal(convId, recipientId) {
  rateConversationId = convId;
  rateRecipientId = recipientId;
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
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('star') && e.target.closest('#starRating')) {
    e.target.closest('#starRating').querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    e.target.classList.add('active');
  }
});

async function submitRating() {
  const stars = document.querySelectorAll('#starRating .star.active').length;
  const review = document.getElementById('rateReview').value;
  if (!stars) { showToast('Selecciona estrellas', 'error'); return; }
  try {
    await request('/ratings', { method: 'POST', body: JSON.stringify({ to_user_id: rateRecipientId, vehicle_id: currentVehicleId, stars, review }) });
    showToast('Calificación enviada', 'success');
    closeRateModal();
  } catch (err) { showToast(err.message, 'error'); }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
  document.getElementById('modalOverlay').style.display = 'none';
}

// UTILS
function formatNumber(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function formatTime(d) { return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function formatRelTime(d) {
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}
function escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
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
         descObj.addEventListener('input', () => descObj.dataset.userEdited = "true");
      }
    }, 500);
    
  } else {
    document.getElementById('navLogin').style.display = 'flex';
    document.getElementById('navRegister').style.display = 'flex';
  }
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
    } catch { localStorage.removeItem('token'); currentUser = null; }
  }
  updateNav();
}

checkAuth();
showSection('home');
