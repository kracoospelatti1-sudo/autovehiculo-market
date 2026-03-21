require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const SECRET_KEY = process.env.JWT_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3001';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en el archivo .env');
  process.exit(1);
}

if (!SECRET_KEY) {
  console.error('❌ ERROR: JWT_SECRET es requerido en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
  }
});

app.use(express.static('public'));

// Rate limiting
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { error: 'Demasiados intentos. Esperá 15 minutos.' } });
const messageLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Enviás mensajes demasiado rápido' } });
app.use('/api/', globalLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (!err) req.user = user;
    next();
  });
};

const isAdmin = async (userId) => {
  try {
    const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', userId).maybeSingle();
    return data?.is_admin === true;
  } catch { return false; }
};

const isBanned = async (userId) => {
  try {
    const { data } = await supabase.from('profiles').select('is_banned').eq('user_id', userId).maybeSingle();
    return data?.is_banned === true;
  } catch { return false; }
};

function formatNumber(num) {
  if (num == null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// AUTH
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data: existingByUsername } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    const { data: existingByEmail } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    const existingUser = existingByUsername || existingByEmail;

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({ username, email, password: hashedPassword })
      .select()
      .single();

    if (error) throw error;

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ user_id: data.id, city: '', bio: '', phone: '' });
    if (profileError) {
      // Rollback user creation if profile fails
      await supabase.from('users').delete().eq('id', data.id);
      throw profileError;
    }

    const token = jwt.sign({ id: data.id, username: data.username }, SECRET_KEY, { expiresIn: '30d' });
    res.json({ token, user: { id: data.id, username: data.username, email: data.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (profileError) console.error('[/api/user] profile error:', profileError.message, 'user_id:', req.user.id);

    res.json({ ...data, profile: profile || null });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// VEHICLES with SEARCH and FILTERS
app.get('/api/vehicles', async (req, res) => {
  try {
    // Obtener IDs de usuarios baneados para excluirlos
    const { data: bannedProfiles } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('is_banned', true);
    const bannedIds = (bannedProfiles || []).map(p => p.user_id).filter(Boolean);

    let query = supabase
      .from('vehicles')
      .select('*, users!vehicles_user_id_fkey(id, username)', { count: 'exact' })
      .eq('status', 'active');

    if (bannedIds.length > 0) {
      query = query.not('user_id', 'in', `(${bannedIds.join(',')})`);
    }

    const { brand, model, minPrice, maxPrice, minYear, maxYear, minMileage, maxMileage, fuel, transmission, city, province, search, sort, user_id, page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;

    if (search) {
      const s = search.replace(/[%_\\]/g, '');
      query = query.or(`title.ilike.%${s}%,brand.ilike.%${s}%,model.ilike.%${s}%`);
    }
    if (user_id) query = query.eq('user_id', user_id);
    if (brand) query = query.eq('brand', brand);
    if (model) query = query.ilike('model', `%${model}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (minYear) query = query.gte('year', parseInt(minYear));
    if (maxYear) query = query.lte('year', parseInt(maxYear));
    if (minMileage) query = query.gte('mileage', parseInt(minMileage));
    if (maxMileage) query = query.lte('mileage', parseInt(maxMileage));
    if (fuel) query = query.eq('fuel', fuel);
    if (transmission) query = query.ilike('transmission', `%${transmission}%`);
    if (city) query = query.ilike('city', `%${city}%`);
    if (province) query = query.ilike('province', `%${province}%`);

    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else if (sort === 'year_desc') query = query.order('year', { ascending: false });
    else if (sort === 'views') query = query.order('view_count', { ascending: false });
    else if (sort === 'oldest') query = query.order('created_at', { ascending: true });
    else query = query.order('created_at', { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    
    const vehicleIds = data.map(v => v.id);
    const userIds = [...new Set(data.map(v => v.user_id).filter(Boolean))];
    let imagesMap = {};
    let profilesMap = {};
    if (vehicleIds.length > 0) {
      const { data: images } = await supabase.from('vehicle_images').select('*').in('vehicle_id', vehicleIds);
      imagesMap = images.reduce((acc, img) => {
        if (!acc[img.vehicle_id]) acc[img.vehicle_id] = [];
        acc[img.vehicle_id].push(img);
        return acc;
      }, {});
    }
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, is_verified').in('user_id', userIds);
      profilesMap = (profiles || []).reduce((acc, p) => { acc[p.user_id] = p; return acc; }, {});
    }

    const vehicles = data.map(v => ({
      ...v,
      seller_name: v.users?.username,
      seller_id: v.users?.id,
      seller_verified: profilesMap[v.user_id]?.is_verified || false,
      images: imagesMap[v.id] || []
    }));
    
    res.json({ vehicles, total: count || vehicles.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener vehículos' });
  }
});

app.get('/api/vehicles/:id', optionalAuth, async (req, res) => {
  try {
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const requesterId = req.user?.id;
    const isOwner = requesterId && vehicle.user_id === requesterId;
    const admin = requesterId ? await isAdmin(requesterId) : false;
    if (!isOwner && !admin && vehicle.status !== 'active') {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const newViewCount = (vehicle.view_count || 0) + 1;
    await supabase.from('vehicles').update({ view_count: newViewCount }).eq('id', vehicle.id);

    const [userRes, imagesRes, profileRes, sellerVehiclesRes, sellerRatingsRes, followersRes] = await Promise.all([
      supabase.from('users').select('id, username').eq('id', vehicle.user_id).single(),
      supabase.from('vehicle_images').select('*').eq('vehicle_id', vehicle.id),
      supabase.from('profiles').select('*').eq('user_id', vehicle.user_id).maybeSingle(),
      supabase.from('vehicles').select('id').eq('user_id', vehicle.user_id).eq('status', 'active'),
      supabase.from('ratings').select('stars').eq('to_user_id', vehicle.user_id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', vehicle.user_id)
    ]);

    const user = userRes.data;
    const images = imagesRes.data;
    const profile = profileRes.data;
    const sellerVehicles = sellerVehiclesRes.data;
    const sellerRatings = sellerRatingsRes.data;

    const avgRating = sellerRatings?.length
      ? (sellerRatings.reduce((a, b) => a + b.stars, 0) / sellerRatings.length).toFixed(1)
      : null;

    res.json({
      ...vehicle,
      seller_name: user?.username,
      seller_id: vehicle.user_id,
      seller_verified: profile?.is_verified || false,
      seller_followers_count: followersRes.count || 0,
      seller_profile: profile,
      seller_vehicles_count: sellerVehicles?.length || 0,
      seller_rating: avgRating,
      seller_ratings_count: sellerRatings?.length || 0,
      vehicle_images: images || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    if (await isBanned(req.user.id)) {
      return res.status(403).json({ error: 'Tu cuenta ha sido restringida. No podés publicar contenido.' });
    }

    const { title, brand, model, year, price, mileage, fuel, transmission, description, city, province, images, accepts_trade } = req.body;

    if (!title || !brand || !model || !year || !price) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }
    if (!city || !city.trim()) return res.status(400).json({ error: 'La ciudad es obligatoria' });
    if (!province || !province.trim()) return res.status(400).json({ error: 'La provincia es obligatoria' });

    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        user_id: req.user.id,
        title,
        brand,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        mileage: parseInt(mileage) || 0,
        fuel: fuel || '',
        transmission: transmission || '',
        description: description || '',
        city: city.trim(),
        province: province.trim(),
        status: 'active',
        view_count: 0,
        accepts_trade: !!accepts_trade
      })
      .select()
      .single();

    if (error) throw error;

    if (images && images.length > 0) {
      const imageRecords = images.map((url, index) => ({
        vehicle_id: data.id,
        url,
        is_primary: index === 0,
        order_index: index
      }));
      await supabase.from('vehicle_images').insert(imageRecords);
    }

    // Notify followers
    const { data: followers } = await supabase.from('follows').select('follower_id').eq('following_id', req.user.id);
    if (followers?.length) {
      const { data: seller } = await supabase.from('users').select('username').eq('id', req.user.id).single();
      const notifs = followers.map(f => ({
        user_id: f.follower_id,
        type: 'new_vehicle',
        title: 'Nueva publicación',
        message: `${seller?.username || 'Un vendedor que seguís'} publicó: ${title}`,
        link: `vehicle/${data.id}`,
        read: false
      }));
      await supabase.from('notifications').insert(notifs);
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el vehículo' });
  }
});

app.put('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const admin = await isAdmin(req.user.id);
    if (vehicle.user_id !== req.user.id && !admin) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const { title, brand, model, year, price, mileage, fuel, transmission, description, city, province, status } = req.body;

    let updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (brand !== undefined) updates.brand = brand;
    if (model !== undefined) updates.model = model;
    if (year !== undefined) updates.year = parseInt(year);
    if (price !== undefined) updates.price = parseFloat(price);
    if (mileage !== undefined) updates.mileage = parseInt(mileage);
    if (fuel !== undefined) updates.fuel = fuel;
    if (transmission !== undefined) updates.transmission = transmission;
    if (description !== undefined) updates.description = description;
    if (city !== undefined) {
      if (!city.trim()) return res.status(400).json({ error: 'La ciudad no puede estar vacía' });
      updates.city = city.trim();
    }
    if (province !== undefined) {
      if (!province.trim()) return res.status(400).json({ error: 'La provincia no puede estar vacía' });
      updates.province = province.trim();
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'sold', 'inactive', 'paused', 'reserved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}` });
      }
      updates.status = status;
    }
    if (req.body.accepts_trade !== undefined) updates.accepts_trade = !!req.body.accepts_trade;

    const { data, error } = await supabase
      .from('vehicles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('user_id')
      .eq('id', req.params.id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const admin = await isAdmin(req.user.id);
    if (vehicle.user_id !== req.user.id && !admin) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const { data: images } = await supabase
      .from('vehicle_images')
      .select('url')
      .eq('vehicle_id', req.params.id);

    for (const img of images || []) {
      if (img.url && img.url.includes('supabase.co/storage')) {
        const fileName = img.url.split('/storage/v1/object/public/')[1];
        if (fileName) await supabase.storage.from('vehicle-images').remove([fileName]);
      }
    }

    const vid = req.params.id;
    const safeDelete = async (table, filter) => {
      try { const r = await filter(supabase.from(table)); if (r?.error) console.error(`${table} cleanup:`, r.error.message); }
      catch (e) { console.error(`${table} cleanup threw:`, e.message); }
    };

    // Delete messages first (FK from messages → conversations)
    const { data: convs } = await supabase.from('conversations').select('id').eq('vehicle_id', vid);
    if (convs?.length) {
      await safeDelete('messages', t => t.delete().in('conversation_id', convs.map(c => c.id)));
    }

    // Clean up all related tables — each failure is isolated
    await safeDelete('conversations',   t => t.delete().eq('vehicle_id', vid));
    await safeDelete('vehicle_images',  t => t.delete().eq('vehicle_id', vid));
    await safeDelete('favorites',       t => t.delete().eq('vehicle_id', vid));
    await safeDelete('reports',         t => t.delete().eq('vehicle_id', vid));
    await safeDelete('trade_offers',    t => t.delete().or(`vehicle_id.eq.${vid},offered_vehicle_id.eq.${vid}`));

    const { error: delErr } = await supabase.from('vehicles').delete().eq('id', vid);
    if (delErr) {
      console.error('vehicles delete error:', delErr.message);
      return res.status(500).json({ error: `No se pudo eliminar: ${delErr.message}` });
    }

    res.json({ message: 'Vehículo eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/api/my-vehicles', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const myIds = data.map(v => v.id);
    let myImagesMap = {};
    if (myIds.length > 0) {
      const { data: imgs } = await supabase.from('vehicle_images').select('*').in('vehicle_id', myIds);
      myImagesMap = (imgs || []).reduce((acc, img) => {
        if (!acc[img.vehicle_id]) acc[img.vehicle_id] = [];
        acc[img.vehicle_id].push(img);
        return acc;
      }, {});
    }
    res.json(data.map(v => ({ ...v, images: myImagesMap[v.id] || [] })));
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// UPLOAD IMAGE
app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${req.user.id}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('vehicle-images')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('vehicle-images')
      .getPublicUrl(fileName);

    res.json({ url: publicUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
});

// PROFILE
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', req.params.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const targetId = parseInt(req.params.id);

    // Resolve optional auth for is_following
    let viewerId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try { const decoded = require('jsonwebtoken').verify(token, SECRET_KEY); viewerId = decoded.id; } catch {}
    }

    const [profileRes, vehiclesRes, ratingsRes, followersRes, followingRes, isFollowingRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', targetId).maybeSingle(),
      supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('user_id', targetId).eq('status', 'active'),
      supabase.from('ratings').select('stars').eq('to_user_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetId),
      viewerId && viewerId !== targetId
        ? supabase.from('follows').select('id').eq('follower_id', viewerId).eq('following_id', targetId).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const avgRating = ratingsRes.data?.length
      ? (ratingsRes.data.reduce((a, b) => a + b.stars, 0) / ratingsRes.data.length).toFixed(1)
      : null;

    res.json({
      ...user,
      ...profileRes.data,
      vehicles_count: vehiclesRes.count || 0,
      rating: avgRating,
      ratings_count: ratingsRes.data?.length || 0,
      followers_count: followersRes.count || 0,
      following_count: followingRes.count || 0,
      is_following: !!isFollowingRes.data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar perfil' });
  }
});

// FOLLOWS
app.post('/api/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.id);
    if (followerId === followingId) return res.status(400).json({ error: 'No podés seguirte a vos mismo' });

    const { data: existing } = await supabase.from('follows').select('id').eq('follower_id', followerId).eq('following_id', followingId).maybeSingle();

    if (existing) {
      await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
      const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', followingId);
      return res.json({ following: false, followers_count: count || 0 });
    }

    await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });

    const { data: followerUser } = await supabase.from('users').select('username').eq('id', followerId).single();
    await supabase.from('notifications').insert({
      user_id: followingId,
      type: 'follow',
      title: 'Nuevo seguidor',
      message: `${followerUser?.username || 'Alguien'} comenzó a seguirte`,
      link: `profile/${followerId}`,
      read: false
    });

    const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', followingId);
    res.json({ following: true, followers_count: count || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al seguir usuario' });
  }
});

// HEARTBEAT
app.put('/api/ping', authenticateToken, async (req, res) => {
  try {
    await supabase.from('profiles').upsert({ user_id: req.user.id, last_seen: new Date().toISOString() }, { onConflict: 'user_id' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Ping fallido' }); }
});

app.delete('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  if (!await isAdmin(req.user.id)) return res.status(403).json({ error: 'Acceso denegado' });
  try {
    await supabase.from('reports').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Error al borrar' }); }
});

app.put('/api/admin/users/:id/ban', authenticateToken, async (req, res) => {
  if (!await isAdmin(req.user.id)) return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const targetUser = req.params.id;
    const { data: profile } = await supabase.from('profiles').select('is_banned').eq('user_id', targetUser).maybeSingle();
    const newStatus = !profile?.is_banned;
    const { error } = await supabase.from('profiles').update({ is_banned: newStatus }).eq('user_id', targetUser);
    if (error) throw error;
    res.json({ is_banned: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Error cambiando estado de baneo' });
  }
});

app.put('/api/admin/users/:id/verify', authenticateToken, async (req, res) => {
  if (!await isAdmin(req.user.id)) return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const targetUser = req.params.id;
    const { data: profile } = await supabase.from('profiles').select('is_verified').eq('user_id', targetUser).maybeSingle();
    const newStatus = !profile?.is_verified;
    const { error } = await supabase.from('profiles').update({
      is_verified: newStatus,
      verified_at: newStatus ? new Date().toISOString() : null
    }).eq('user_id', targetUser);
    if (error) throw error;
    res.json({ is_verified: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Error cambiando verificación' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, phone, city, bio, avatar_url } = req.body;

    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' });
      }
      const { error: usernameError } = await supabase
        .from('users')
        .update({ username })
        .eq('id', req.user.id);
      if (usernameError) {
        return res.status(400).json({ error: 'No se pudo actualizar el username. Es posible que ya esté en uso.' });
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: req.user.id,
        phone: phone || '',
        city: city || '',
        bio: bio || '',
        avatar_url: avatar_url || '',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// FAVORITES
app.get('/api/favorites', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('vehicle_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const vehicleIds = data.map(f => f.vehicle_id);
    if (vehicleIds.length === 0) return res.json([]);
    
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .in('id', vehicleIds)
      .eq('status', 'active');

    const ids = (vehicles || []).map(v => v.id);
    let imagesMap = {};
    if (ids.length > 0) {
      const { data: imgs } = await supabase.from('vehicle_images').select('*').in('vehicle_id', ids);
      imagesMap = (imgs || []).reduce((acc, img) => {
        if (!acc[img.vehicle_id]) acc[img.vehicle_id] = [];
        acc[img.vehicle_id].push(img);
        return acc;
      }, {});
    }
    const vehiclesWithImages = (vehicles || []).map(v => ({ ...v, is_favorite: true, images: imagesMap[v.id] || [] }));
    res.json(vehiclesWithImages);
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/favorites/:vehicleId', authenticateToken, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const { data: existing } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('vehicle_id', vehicleId)
      .maybeSingle();

    if (existing) {
      await supabase.from('favorites').delete().eq('user_id', req.user.id).eq('vehicle_id', vehicleId);
      return res.json({ favorited: false });
    }

    await supabase.from('favorites').insert({ user_id: req.user.id, vehicle_id: vehicleId });
    
    const { data: vehicle } = await supabase
      .from('vehicles')
      .select('user_id')
      .eq('id', vehicleId)
      .single();

    if (vehicle && vehicle.user_id !== req.user.id) {
      await supabase.from('notifications').insert({
        user_id: vehicle.user_id,
        type: 'favorite',
        title: 'Nuevo favorito',
        message: 'Alguien agregó tu vehículo a favoritos',
        link: `/vehicle/${vehicleId}`
      });
    }

    res.json({ favorited: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/favorites/:vehicleId/check', authenticateToken, async (req, res) => {
  try {
    const { data } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('vehicle_id', req.params.vehicleId)
      .maybeSingle();

    res.json({ favorited: !!data });
  } catch (error) {
    res.json({ favorited: false });
  }
});

// CONVERSATIONS
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    
    // Batch queries instead of N+1
    const vehicleIds = [...new Set(data.map(c => c.vehicle_id))];
    const userIds = [...new Set(data.flatMap(c => [c.buyer_id, c.seller_id]))];
    const convIds = data.map(c => c.id);

    if (!data.length) return res.json({ conversations: [], total: 0 });

    const [vehiclesRes, usersRes, profilesRes, messagesRes] = await Promise.all([
      supabase.from('vehicles').select('id, title, image_url, price, brand, model, user_id').in('id', vehicleIds),
      supabase.from('users').select('id, username').in('id', userIds),
      supabase.from('profiles').select('user_id, avatar_url').in('user_id', userIds),
      supabase.from('messages').select('conversation_id, content, created_at, sender_id').in('conversation_id', convIds).order('created_at', { ascending: false })
    ]);

    const vehiclesMap = Object.fromEntries((vehiclesRes.data || []).map(v => [v.id, v]));
    const usersMap = Object.fromEntries((usersRes.data || []).map(u => [u.id, u]));
    const profilesMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));
    const lastMessageMap = {};
    (messagesRes.data || []).forEach(m => {
      if (!lastMessageMap[m.conversation_id]) lastMessageMap[m.conversation_id] = m;
    });

    const conversationsWithDetails = data.map(c => {
      const buyer = { ...usersMap[c.buyer_id], avatar_url: profilesMap[c.buyer_id]?.avatar_url };
      const seller = { ...usersMap[c.seller_id], avatar_url: profilesMap[c.seller_id]?.avatar_url };
      const otherUser = c.buyer_id === req.user.id ? seller : buyer;
      const lastMsg = lastMessageMap[c.id];
      return {
        ...c,
        vehicle: vehiclesMap[c.vehicle_id],
        other_user: otherUser,
        last_message: lastMsg?.content,
        last_message_time: lastMsg?.created_at
      };
    });
    
    res.json({ conversations: conversationsWithDetails, total: count || conversationsWithDetails.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// Unread messages count (for nav badge)
app.get('/api/messages/unread-count', authenticateToken, async (req, res) => {
  try {
    // Get all conversations where user participates
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`);

    if (!convs?.length) return res.json({ count: 0 });

    const convIds = convs.map(c => c.id);
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', req.user.id)
      .is('read_at', null);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    res.json({ count: 0 });
  }
});

app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, initial_message } = req.body;
    
    if (!vehicle_id || !initial_message) {
      return res.status(400).json({ error: 'Datos requeridos' });
    }

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('user_id, title, status')
      .eq('id', vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (vehicle.status !== 'active') {
      return res.status(400).json({ error: 'Este vehículo no está disponible' });
    }

    if (vehicle.user_id === req.user.id) {
      return res.status(400).json({ error: 'No puedes chatear contigo mismo' });
    }

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('vehicle_id', vehicle_id)
      .eq('buyer_id', req.user.id)
      .maybeSingle();

    if (existingConv) {
      await supabase.from('messages').insert({
        conversation_id: existingConv.id,
        sender_id: req.user.id,
        content: initial_message
      });
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', existingConv.id);
      return res.json(existingConv);
    }

    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({
        vehicle_id,
        buyer_id: req.user.id,
        seller_id: vehicle.user_id
      })
      .select()
      .single();

    if (convError) throw convError;

    await supabase.from('messages').insert({
      conversation_id: newConv.id,
      sender_id: req.user.id,
      content: initial_message
    });

    await supabase.from('notifications').insert({
      user_id: vehicle.user_id,
      type: 'message',
      title: 'Nuevo mensaje',
      message: `Te enviaron un mensaje sobre "${vehicle.title}"`,
      link: `messages/${newConv.id}`
    });

    res.json(newConv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear conversación' });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    if (conversation.buyer_id !== req.user.id && conversation.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    const [vehicleRes, vehicleImagesRes, buyerUserRes, buyerProfileRes, sellerUserRes, sellerProfileRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('id', conversation.vehicle_id).single(),
      supabase.from('vehicle_images').select('url').eq('vehicle_id', conversation.vehicle_id).order('order_index', { ascending: true }).limit(1),
      supabase.from('users').select('id, username').eq('id', conversation.buyer_id).single(),
      supabase.from('profiles').select('avatar_url, last_seen').eq('user_id', conversation.buyer_id).maybeSingle(),
      supabase.from('users').select('id, username').eq('id', conversation.seller_id).single(),
      supabase.from('profiles').select('avatar_url, last_seen').eq('user_id', conversation.seller_id).maybeSingle()
    ]);
    const vehicleUrl = vehicleImagesRes.data?.[0]?.url;
    const vehicle = { ...vehicleRes.data, image_url: vehicleUrl || vehicleRes.data?.image_url };
    const buyerUser = buyerUserRes.data;
    const buyerProfile = buyerProfileRes.data;
    const sellerUser = sellerUserRes.data;
    const sellerProfile = sellerProfileRes.data;

    const now = Date.now();
    const calcStatus = (lastSeen) => {
      if (!lastSeen) return { last_seen: null, is_online: false };
      const diffMin = Math.floor((now - new Date(lastSeen).getTime()) / 60000);
      return { last_seen: lastSeen, is_online: diffMin < 3 };
    };
    const buyer = { ...buyerUser, avatar_url: buyerProfile?.avatar_url, ...calcStatus(buyerProfile?.last_seen) };
    const seller = { ...sellerUser, avatar_url: sellerProfile?.avatar_url, ...calcStatus(sellerProfile?.last_seen) };

    res.json({ ...conversation, vehicle, buyer, seller });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', req.params.id)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    if (conversation.buyer_id !== req.user.id && conversation.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    let msgQuery = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id);

    // Delta polling: only fetch messages after a given ID
    const afterId = parseInt(req.query.after);
    if (!isNaN(afterId) && afterId > 0) {
      msgQuery = msgQuery.gt('id', afterId);
    } else {
      // Sin after = carga inicial, limitar a los últimos 200
      msgQuery = msgQuery.order('created_at', { ascending: false }).limit(200);
    }

    let { data: messages, error } = await msgQuery;
    if (error) throw error;

    // Si era carga inicial (sin after), revertir el orden para mostrar cronológicamente
    if (isNaN(afterId) || afterId <= 0) {
      messages = (messages || []).reverse();
    }

    // Batch fetch usernames (only 2 unique senders max)
    const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
    let usernameMap = {};
    if (senderIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username').in('id', senderIds);
      usernameMap = Object.fromEntries((users || []).map(u => [u.id, u.username]));
    }
    const messagesWithUsers = (messages || []).map(m => ({ ...m, username: usernameMap[m.sender_id] }));

    // Fetch read receipts for messages sent by current user
    const { data: receipts } = await supabase
      .from('messages')
      .select('id, read_at')
      .eq('conversation_id', req.params.id)
      .eq('sender_id', req.user.id)
      .not('read_at', 'is', null);
    const readReceipts = receipts || [];

    res.json({ messages: messagesWithUsers, read_receipts: readReceipts });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/conversations/:id/messages', authenticateToken, messageLimiter, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Mensaje requerido' });
    if (content.trim().length > 5000) return res.status(400).json({ error: 'El mensaje no puede superar los 5000 caracteres' });

    const { data: conversation } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', req.params.id)
      .single();

    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada' });

    if (conversation.buyer_id !== req.user.id && conversation.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    const recipientId = conversation.buyer_id === req.user.id ? conversation.seller_id : conversation.buyer_id;

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: req.params.id,
        sender_id: req.user.id,
        content
      })
      .select('*, users(username)')
      .single();

    if (error) throw error;

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', req.params.id);

    // Obtener username del remitente para la notificación
    const { data: senderUser } = await supabase.from('users').select('username').eq('id', req.user.id).single();
    const preview = content.length > 60 ? content.slice(0, 60) + '…' : content;

    // Anti-spam: solo crear notificación si no hay una pendiente del mismo chat
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', recipientId)
      .eq('type', 'message')
      .eq('link', `messages/${req.params.id}`)
      .eq('read', false)
      .maybeSingle();

    if (existingNotif) {
      // Actualizar la notificación existente en vez de crear una nueva
      await supabase.from('notifications').update({
        title: `Mensaje de ${senderUser?.username || 'alguien'}`,
        message: preview,
        created_at: new Date().toISOString()
      }).eq('id', existingNotif.id);
    } else {
      await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'message',
        title: `Mensaje de ${senderUser?.username || 'alguien'}`,
        message: preview,
        link: `messages/${req.params.id}`
      });
    }

    res.json({ ...message, username: message.users?.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

// MARK MESSAGES AS READ
app.put('/api/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('buyer_id, seller_id')
      .eq('id', req.params.id)
      .single();

    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada' });
    if (conversation.buyer_id !== req.user.id && conversation.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes acceso' });
    }

    const otherUserId = conversation.buyer_id === req.user.id ? conversation.seller_id : conversation.buyer_id;

    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', req.params.id)
      .eq('sender_id', otherUserId)
      .is('read_at', null);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

// TRADE OFFERS
app.post('/api/vehicles/:id/trade-offer', authenticateToken, async (req, res) => {
  try {
    const targetVehicleId = req.params.id;
    const { offered_vehicle_id, message } = req.body;
    if (!offered_vehicle_id) return res.status(400).json({ error: 'Seleccioná un vehículo para ofrecer' });

    const { data: target } = await supabase.from('vehicles').select('user_id, title, accepts_trade, status').eq('id', targetVehicleId).single();
    if (!target) return res.status(404).json({ error: 'Vehículo no encontrado' });
    if (!target.accepts_trade) return res.status(400).json({ error: 'Este vehículo no acepta permutas' });
    if (target.status !== 'active') return res.status(400).json({ error: 'Este vehículo no está disponible' });
    if (target.user_id === req.user.id) return res.status(400).json({ error: 'No podés proponer permuta con tu propio vehículo' });

    const { data: offered } = await supabase.from('vehicles').select('user_id, title').eq('id', offered_vehicle_id).single();
    if (!offered || offered.user_id !== req.user.id) return res.status(403).json({ error: 'No tenés permiso sobre ese vehículo' });

    const { data: existing } = await supabase.from('trade_offers').select('id').eq('vehicle_id', targetVehicleId).eq('offered_vehicle_id', offered_vehicle_id).eq('proposer_id', req.user.id).eq('status', 'pending').maybeSingle();
    if (existing) return res.status(400).json({ error: 'Ya tenés una oferta pendiente para esta combinación' });

    const { data: offer, error } = await supabase.from('trade_offers').insert({
      vehicle_id: targetVehicleId,
      offered_vehicle_id: parseInt(offered_vehicle_id),
      proposer_id: req.user.id,
      owner_id: target.user_id,
      message: message || '',
      status: 'pending'
    }).select().single();
    if (error) throw error;

    // 1. Obtener datos completos del vehículo ofrecido (con imagen)
    const { data: offeredFull } = await supabase
      .from('vehicles')
      .select('id, title, brand, model, year, price, city, province')
      .eq('id', parseInt(offered_vehicle_id))
      .single();

    const { data: offeredImage } = await supabase
      .from('vehicle_images')
      .select('url')
      .eq('vehicle_id', parseInt(offered_vehicle_id))
      .eq('is_primary', true)
      .maybeSingle();

    // 2. Encontrar o crear conversación entre proposer (buyer) y owner (seller) para el vehículo TARGET
    let conversationId;
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('vehicle_id', targetVehicleId)
      .eq('buyer_id', req.user.id)
      .eq('seller_id', target.user_id)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({ vehicle_id: targetVehicleId, buyer_id: req.user.id, seller_id: target.user_id })
        .select('id')
        .single();
      conversationId = newConv?.id;
    }

    // 3. Enviar mensaje especial con card del vehículo ofrecido
    if (conversationId && offeredFull) {
      const cardData = {
        id: offeredFull.id,
        title: offeredFull.title,
        brand: offeredFull.brand,
        model: offeredFull.model,
        year: offeredFull.year,
        price: offeredFull.price,
        city: offeredFull.city,
        province: offeredFull.province,
        image: offeredImage?.url || null
      };
      const cardMessage = message
        ? `__TRADE_CARD__${JSON.stringify(cardData)}\n${message}`
        : `__TRADE_CARD__${JSON.stringify(cardData)}`;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: req.user.id,
        content: cardMessage
      });
    }

    const { data: proposerUser } = await supabase.from('users').select('username').eq('id', req.user.id).single();
    await supabase.from('notifications').insert({
      user_id: target.user_id,
      type: 'trade_offer',
      title: 'Nueva propuesta de permuta',
      message: `${proposerUser?.username} quiere permutar por tu ${target.title}`,
      link: `trade-offers`,
      read: false
    });

    res.json(offer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear oferta' });
  }
});

app.get('/api/trade-offers', authenticateToken, async (req, res) => {
  try {
    const { data: received, error } = await supabase
      .from('trade_offers')
      .select('*')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: sent } = await supabase
      .from('trade_offers')
      .select('*')
      .eq('proposer_id', req.user.id)
      .order('created_at', { ascending: false });

    const allOffers = [...(received || []), ...(sent || [])];
    const vehicleIds = [...new Set(allOffers.flatMap(o => [o.vehicle_id, o.offered_vehicle_id]))];
    const userIds = [...new Set(allOffers.flatMap(o => [o.proposer_id, o.owner_id]))];

    const [vehiclesRes, usersRes] = await Promise.all([
      vehicleIds.length ? supabase.from('vehicles').select('id, title, brand, model, year, price, image_url').in('id', vehicleIds) : { data: [] },
      userIds.length ? supabase.from('users').select('id, username').in('id', userIds) : { data: [] }
    ]);

    const vMap = Object.fromEntries((vehiclesRes.data || []).map(v => [v.id, v]));
    const uMap = Object.fromEntries((usersRes.data || []).map(u => [u.id, u]));

    const enrich = o => ({
      ...o,
      target_vehicle: vMap[o.vehicle_id],
      offered_vehicle: vMap[o.offered_vehicle_id],
      proposer: uMap[o.proposer_id],
      owner: uMap[o.owner_id]
    });

    res.json({
      received: (received || []).map(enrich),
      sent: (sent || []).map(enrich)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener permutas' });
  }
});

app.put('/api/trade-offers/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });

    const { data: offer } = await supabase.from('trade_offers').select('*').eq('id', req.params.id).single();
    if (!offer) return res.status(404).json({ error: 'Oferta no encontrada' });
    if (offer.owner_id !== req.user.id) return res.status(403).json({ error: 'Sin permiso' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'Esta oferta ya fue respondida' });

    await supabase.from('trade_offers').update({ status }).eq('id', req.params.id);

    const [targetV, offeredV, ownerU] = await Promise.all([
      supabase.from('vehicles').select('title').eq('id', offer.vehicle_id).single(),
      supabase.from('vehicles').select('title').eq('id', offer.offered_vehicle_id).single(),
      supabase.from('users').select('username').eq('id', req.user.id).single()
    ]);

    let conversationId = null;
    if (status === 'accepted') {
      // Create or get conversation between both parties
      const { data: existingConv } = await supabase.from('conversations').select('id')
        .eq('vehicle_id', offer.vehicle_id).eq('buyer_id', offer.proposer_id).eq('seller_id', offer.owner_id).maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
        await supabase.from('messages').insert({ conversation_id: existingConv.id, sender_id: req.user.id, content: `✅ Permuta aceptada. Hablemos de los detalles.` });
        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', existingConv.id);
      } else {
        const { data: newConv } = await supabase.from('conversations').insert({
          vehicle_id: offer.vehicle_id, buyer_id: offer.proposer_id, seller_id: offer.owner_id
        }).select().single();
        if (newConv) {
          conversationId = newConv.id;
          await supabase.from('messages').insert({ conversation_id: newConv.id, sender_id: req.user.id, content: `✅ Permuta aceptada: ${offeredV.data?.title} por ${targetV.data?.title}. ¡Coordinemos!` });
          await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', newConv.id);
        }
      }
    }

    await supabase.from('notifications').insert({
      user_id: offer.proposer_id,
      type: status === 'accepted' ? 'trade_accepted' : 'trade_rejected',
      title: status === 'accepted' ? '¡Permuta aceptada!' : 'Permuta rechazada',
      message: status === 'accepted'
        ? `${ownerU.data?.username} aceptó tu permuta. ¡Abrí el chat para coordinar!`
        : `${ownerU.data?.username} rechazó tu propuesta de permuta`,
      link: status === 'accepted' && conversationId ? `messages/${conversationId}` : '',
      read: false
    });

    res.json({ success: true, status, conversation_id: conversationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al responder oferta' });
  }
});

// NOTIFICATIONS
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/notifications/count', authenticateToken, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await supabase.from('notifications').update({ read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await supabase.from('notifications').update({ read: true }).eq('user_id', req.user.id).eq('read', false);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

// RATINGS
app.post('/api/ratings', authenticateToken, async (req, res) => {
  try {
    const { to_user_id, vehicle_id, stars, review } = req.body;
    
    if (!vehicle_id || vehicle_id === undefined || vehicle_id === null) {
      return res.status(400).json({ error: 'vehicle_id es requerido' });
    }

    const starsInt = parseInt(stars);
    if (!to_user_id || isNaN(starsInt) || starsInt < 1 || starsInt > 5) {
      return res.status(400).json({ error: 'Datos requeridos (estrellas: 1-5)' });
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('vehicle_id', vehicle_id)
      .or(`and(buyer_id.eq.${req.user.id},seller_id.eq.${to_user_id}),and(buyer_id.eq.${to_user_id},seller_id.eq.${req.user.id})`)
      .maybeSingle();

    if (!conversation) {
      return res.status(400).json({ error: 'Necesitás haber tenido una conversación sobre este vehículo para poder calificar' });
    }

    const { data: existing } = await supabase
      .from('ratings')
      .select('*')
      .eq('from_user_id', req.user.id)
      .eq('to_user_id', to_user_id)
      .eq('vehicle_id', vehicle_id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Ya calificaste a este usuario' });
    }

    const { data, error } = await supabase
      .from('ratings')
      .insert({
        from_user_id: req.user.id,
        to_user_id,
        vehicle_id,
        stars: starsInt,
        review: review || ''
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/ratings/:userId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ratings')
      .select('*')
      .eq('to_user_id', req.params.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const fromIds = [...new Set((data || []).map(r => r.from_user_id))];
    let ratingUsersMap = {};
    if (fromIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username').in('id', fromIds);
      ratingUsersMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    }
    const ratingsWithUsers = (data || []).map(r => ({ ...r, from_user: ratingUsersMap[r.from_user_id] || null }));
    
    res.json(ratingsWithUsers);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

// REPORTS
app.post('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, reason, description } = req.body;
    
    if (!vehicle_id || !reason) {
      return res.status(400).json({ error: 'Datos requeridos' });
    }

    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', req.user.id)
      .eq('vehicle_id', vehicle_id)
      .maybeSingle();

    if (existingReport) {
      return res.status(400).json({ error: 'Ya reportaste este vehículo' });
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        vehicle_id,
        reporter_id: req.user.id,
        reason,
        description: description || ''
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Reporte enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

// STATS
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id, view_count')
      .eq('user_id', req.user.id);

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`);

    const convIds = (conversations || []).map(c => c.id);
    const myVehicleIds = (vehicles || []).map(v => v.id);

    const [messagesRes, favoritesRes] = await Promise.all([
      convIds.length > 0
        ? supabase.from('messages').select('*', { count: 'exact', head: true }).in('conversation_id', convIds)
        : Promise.resolve({ count: 0 }),
      myVehicleIds.length > 0
        ? supabase.from('favorites').select('*', { count: 'exact', head: true }).in('vehicle_id', myVehicleIds)
        : Promise.resolve({ count: 0 })
    ]);

    res.json({
      vehicles_count: vehicles?.length || 0,
      total_views: vehicles?.reduce((a, v) => a + (v.view_count || 0), 0) || 0,
      messages_count: messagesRes.count || 0,
      favorites_count: favoritesRes.count || 0,
      conversations_count: conversations?.length || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
  }
});

// ADMIN — listar todos los vehículos
app.get('/api/admin/vehicles', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { page = 1, search = '' } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('vehicles')
      .select('id, title, brand, model, year, price, status, view_count, created_at, user_id, city, province', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      const s = search.replace(/[%_\\]/g, '');
      query = query.or(`title.ilike.%${s}%,brand.ilike.%${s}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    const userIds = [...new Set((data || []).map(v => v.user_id))];
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, username').in('id', userIds)
      : { data: [] };
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('user_id, is_banned').in('user_id', userIds)
      : { data: [] };
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

    res.json({
      vehicles: (data || []).map(v => ({
        ...v,
        seller_username: userMap[v.user_id]?.username || 'Desconocido',
        seller_banned: profileMap[v.user_id]?.is_banned || false
      })),
      total: count || 0
    });
  } catch (error) {
    console.error('[/api/admin/vehicles]', error.message);
    res.status(500).json({ error: 'Error' });
  }
});

// ADMIN
app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const vehicleIds = [...new Set((data || []).map(r => r.vehicle_id))];
    const reporterIds = [...new Set((data || []).map(r => r.reporter_id))];
    const [vehiclesRes, reportersRes] = await Promise.all([
      vehicleIds.length > 0 ? supabase.from('vehicles').select('id, title, status, user_id').in('id', vehicleIds) : Promise.resolve({ data: [] }),
      reporterIds.length > 0 ? supabase.from('users').select('id, username').in('id', reporterIds) : Promise.resolve({ data: [] })
    ]);
    const vehiclesMap = Object.fromEntries((vehiclesRes.data || []).map(v => [v.id, v]));
    const reportersMap = Object.fromEntries((reportersRes.data || []).map(u => [u.id, u]));
    const reportsWithDetails = (data || []).map(r => ({
      ...r,
      vehicle: vehiclesMap[r.vehicle_id] || null,
      reporter: reportersMap[r.reporter_id] || null
    }));

    res.json(reportsWithDetails);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/admin/reports/:id', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { status } = req.body;
    const validReportStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!status || !validReportStatuses.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Valores permitidos: ${validReportStatuses.join(', ')}` });
    }
    const { data, error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username, email, created_at')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    const userIds = (users || []).map(u => u.id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, is_admin, is_banned, is_verified')
      .in('user_id', userIds);

    const profileMap = (profiles || []).reduce((acc, p) => { acc[p.user_id] = p; return acc; }, {});

    const result = (users || []).map(u => ({
      ...u,
      profiles: [profileMap[u.id] || { is_admin: false, is_banned: false, is_verified: false }]
    }));

    res.json(result);
  } catch (error) {
    console.error('[/api/admin/users]', error.message);
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/admin/users/:id/admin', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { is_admin } = req.body;
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !!is_admin })
      .eq('user_id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { count: users } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: vehicles } = await supabase.from('vehicles').select('*', { count: 'exact', head: true });
    const { count: activeVehicles } = await supabase.from('vehicles').select('*', { count: 'exact', head: true }).eq('status', 'active');
    const { count: reports } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: conversations } = await supabase.from('conversations').select('*', { count: 'exact', head: true });

    res.json({
      users: users || 0,
      vehicles: vehicles || 0,
      active_vehicles: activeVehicles || 0,
      pending_reports: reports || 0,
      conversations: conversations || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

// BRANDS/MODELS FOR AUTOCOMPLETE
app.get('/api/brands', (req, res) => {
  const brands = Object.keys({
    'Acura': 1, 'Alfa Romeo': 1, 'Aston Martin': 1, 'Audi': 1, 'Bentley': 1, 'BMW': 1,
    'Buick': 1, 'Cadillac': 1, 'Chevrolet': 1, 'Chrysler': 1, 'Citroën': 1, 'Dodge': 1,
    'Fiat': 1, 'Ford': 1, 'Geely': 1, 'Genesis': 1, 'GMC': 1, 'Honda': 1, 'Hyundai': 1,
    'Infiniti': 1, 'Jaguar': 1, 'Jeep': 1, 'Kia': 1, 'Lamborghini': 1, 'Land Rover': 1,
    'Lexus': 1, 'Lincoln': 1, 'Maserati': 1, 'Mazda': 1, 'McLaren': 1, 'Mercedes-Benz': 1,
    'Mini': 1, 'Mitsubishi': 1, 'Nissan': 1, 'Opel': 1, 'Peugeot': 1, 'Porsche': 1,
    'Ram': 1, 'Renault': 1, 'Rolls-Royce': 1, 'Saab': 1, 'Seat': 1, 'Skoda': 1,
    'Smart': 1, 'Subaru': 1, 'Suzuki': 1, 'Tesla': 1, 'Toyota': 1, 'Volkswagen': 1, 'Volvo': 1
  });
  res.json(brands.sort());
});

// DIAGNOSTIC: check which FK tables reference a vehicle (temp endpoint)
app.get('/api/admin/debug-vehicle/:id', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not found' });
  if (!await isAdmin(req.user.id)) return res.status(403).json({ error: 'Solo admin' });
  const vid = parseInt(req.params.id);
  const [convs, imgs, favs, reps, trades] = await Promise.all([
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('vehicle_id', vid),
    supabase.from('vehicle_images').select('id', { count: 'exact', head: true }).eq('vehicle_id', vid),
    supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('vehicle_id', vid),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('vehicle_id', vid),
    supabase.from('trade_offers').select('id', { count: 'exact', head: true }).or(`vehicle_id.eq.${vid},offered_vehicle_id.eq.${vid}`).catch(() => ({ count: 'N/A (tabla no existe)' })),
  ]);
  res.json({
    vehicle_id: vid,
    conversations: convs.count,
    vehicle_images: imgs.count,
    favorites: favs.count,
    reports: reps.count,
    trade_offers: trades.count ?? 'N/A',
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
