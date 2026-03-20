require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const SECRET_KEY = process.env.JWT_SECRET || 'fallback-secret-key';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ERROR: SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(cors());
app.use(express.json());

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

const isAdmin = async (userId) => {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  return data?.is_admin === true;
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

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`username.ilike.${username},email.ilike.${email}`)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({ username, email, password: hashedPassword })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('profiles')
      .insert({ user_id: data.id, username, city: '', bio: '', phone: '' });

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
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();
    
    res.json({ ...data, profile });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// VEHICLES with SEARCH and FILTERS
app.get('/api/vehicles', async (req, res) => {
  try {
    let query = supabase
      .from('vehicles')
      .select('*, users!vehicles_user_id_fkey(id, username)')
      .eq('status', 'active');

    const { brand, model, minPrice, maxPrice, minYear, maxYear, minMileage, maxMileage, fuel, city, search, sort, page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;

    if (search) {
      query = query.or(`title.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%`);
    }
    if (brand) query = query.eq('brand', brand);
    if (model) query = query.ilike('model', `%${model}%`);
    if (minPrice) query = query.gte('price', parseFloat(minPrice));
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice));
    if (minYear) query = query.gte('year', parseInt(minYear));
    if (maxYear) query = query.lte('year', parseInt(maxYear));
    if (minMileage) query = query.gte('mileage', parseInt(minMileage));
    if (maxMileage) query = query.lte('mileage', parseInt(maxMileage));
    if (fuel) query = query.eq('fuel', fuel);
    if (city) query = query.ilike('city', `%${city}%`);

    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc') query = query.order('price', { ascending: false });
    else if (sort === 'year_desc') query = query.order('year', { ascending: false });
    else if (sort === 'views') query = query.order('view_count', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    
    const vehicleIds = data.map(v => v.id);
    let imagesMap = {};
    if (vehicleIds.length > 0) {
      const { data: images } = await supabase.from('vehicle_images').select('*').in('vehicle_id', vehicleIds);
      imagesMap = images.reduce((acc, img) => {
        if (!acc[img.vehicle_id]) acc[img.vehicle_id] = [];
        acc[img.vehicle_id].push(img);
        return acc;
      }, {});
    }
    
    const vehicles = data.map(v => ({
      ...v,
      seller_name: v.users?.username,
      seller_id: v.users?.id,
      images: imagesMap[v.id] || []
    }));
    
    res.json({ vehicles, total: count || vehicles.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener vehículos' });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    await supabase.rpc('increment_view_count', { vehicle_id: req.params.id });

    const { data: user } = await supabase.from('users').select('id, username').eq('id', vehicle.user_id).single();
    const { data: images } = await supabase.from('vehicle_images').select('*').eq('vehicle_id', vehicle.id);
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', vehicle.user_id).single();
    const { data: sellerVehicles } = await supabase.from('vehicles').select('id').eq('user_id', vehicle.user_id).eq('status', 'active');
    const { data: sellerRatings } = await supabase.from('ratings').select('stars').eq('to_user_id', vehicle.user_id);

    const avgRating = sellerRatings?.length 
      ? (sellerRatings.reduce((a, b) => a + b.stars, 0) / sellerRatings.length).toFixed(1) 
      : null;

    res.json({
      ...vehicle,
      seller_name: user?.username,
      seller_id: vehicle.user_id,
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
    const { title, brand, model, year, price, mileage, fuel, transmission, description, city, images } = req.body;
    
    if (!title || !brand || !model || !year || !price) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

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
        city: city || '',
        status: 'active',
        view_count: 0
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

    const { title, brand, model, year, price, mileage, fuel, transmission, description, city, status } = req.body;

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
    if (city !== undefined) updates.city = city;
    if (status !== undefined) updates.status = status;

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

    await supabase.from('messages').delete().eq('vehicle_id', req.params.id);
    await supabase.from('conversations').delete().eq('vehicle_id', req.params.id);
    await supabase.from('vehicle_images').delete().eq('vehicle_id', req.params.id);
    await supabase.from('favorites').delete().eq('vehicle_id', req.params.id);
    await supabase.from('vehicle_views').delete().eq('vehicle_id', req.params.id);
    await supabase.from('vehicles').delete().eq('id', req.params.id);
    
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
    
    const vehiclesWithImages = await Promise.all(data.map(async v => {
      const { data: images } = await supabase.from('vehicle_images').select('*').eq('vehicle_id', v.id);
      return { ...v, images: images || [] };
    }));
    
    res.json(vehiclesWithImages);
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.params.id)
      .single();

    const { count: vehicles_count } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.params.id)
      .eq('status', 'active');
      
    const { data: ratings } = await supabase
      .from('ratings')
      .select('stars')
      .eq('to_user_id', req.params.id);

    const avgRating = ratings?.length ? (ratings.reduce((a, b) => a + b.stars, 0) / ratings.length).toFixed(1) : null;

    res.json({
      ...user,
      ...profile,
      vehicles_count: vehicles_count || 0,
      rating: avgRating,
      ratings_count: ratings?.length || 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cargar perfil' });
  }
});

// HEARTBEAT
app.put('/api/ping', authenticateToken, async (req, res) => {
  try {
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('user_id', req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Ping fallido' }); }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, phone, city, bio, avatar_url } = req.body;

    await supabase
      .from('users')
      .update({ username })
      .eq('id', req.user.id);

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
      .in('id', vehicleIds);

    const vehiclesWithImages = await Promise.all((vehicles || []).map(async v => {
      const { data: images } = await supabase.from('vehicle_images').select('*').eq('vehicle_id', v.id);
      return { ...v, is_favorite: true, images: images || [] };
    }));
    
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
      .single();

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
      .single();
    
    res.json({ favorited: !!data });
  } catch (error) {
    res.json({ favorited: false });
  }
});

// CONVERSATIONS
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    
    const conversationsWithDetails = await Promise.all(data.map(async c => {
      const { data: vehicle } = await supabase.from('vehicles').select('id, title, image_url, price, brand, model, user_id').eq('id', c.vehicle_id).single();
      const { data: buyer } = await supabase.from('users').select('id, username').eq('id', c.buyer_id).single();
      const { data: seller } = await supabase.from('users').select('id, username').eq('id', c.seller_id).single();
      const { data: messages } = await supabase.from('messages').select('content, created_at, sender_id').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1);
      const otherUser = c.buyer_id === req.user.id ? seller : buyer;
      return {
        ...c,
        vehicle,
        other_user: otherUser,
        last_message: messages?.[0]?.content,
        last_message_time: messages?.[0]?.created_at
      };
    }));
    
    res.json(conversationsWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
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
      .select('user_id, title')
      .eq('id', vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    if (vehicle.user_id === req.user.id) {
      return res.status(400).json({ error: 'No puedes chatear contigo mismo' });
    }

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('vehicle_id', vehicle_id)
      .eq('buyer_id', req.user.id)
      .single();

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
      link: `/messages/${newConv.id}`
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

    const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', conversation.vehicle_id).single();
    const { data: buyer } = await supabase.from('users').select('id, username, profiles(last_seen)').eq('id', conversation.buyer_id).single();
    const { data: seller } = await supabase.from('users').select('id, username, profiles(last_seen)').eq('id', conversation.seller_id).single();

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

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    const messagesWithUsers = await Promise.all((messages || []).map(async m => {
      const { data: user } = await supabase.from('users').select('username').eq('id', m.sender_id).single();
      return { ...m, username: user?.username };
    }));
    
    res.json(messagesWithUsers);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Mensaje requerido' });

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

    await supabase.from('notifications').insert({
      user_id: recipientId,
      type: 'message',
      title: 'Nuevo mensaje',
      message: 'Recibiste un nuevo mensaje',
      link: `/messages/${req.params.id}`
    });

    res.json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error' });
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
    
    if (!to_user_id || !stars) {
      return res.status(400).json({ error: 'Datos requeridos' });
    }

    const { data: existing } = await supabase
      .from('ratings')
      .select('*')
      .eq('from_user_id', req.user.id)
      .eq('to_user_id', to_user_id)
      .eq('vehicle_id', vehicle_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Ya calificaste a este usuario' });
    }

    const { data, error } = await supabase
      .from('ratings')
      .insert({
        from_user_id: req.user.id,
        to_user_id,
        vehicle_id,
        stars: parseInt(stars),
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
    
    const ratingsWithUsers = await Promise.all((data || []).map(async r => {
      const { data: user } = await supabase.from('users').select('id, username').eq('id', r.from_user_id).single();
      return { ...r, from_user: user };
    }));
    
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

    const { data: messages } = await supabase
      .from('messages')
      .select('id, conversations(buyer_id, seller_id)');

    const myMessages = messages?.filter(m => 
      m.conversations?.buyer_id === req.user.id || m.conversations?.seller_id === req.user.id
    ) || [];

    const { data: favorites } = await supabase
      .from('favorites')
      .select('vehicle_id, vehicles(user_id)');

    const myFavorites = favorites?.filter(f => f.vehicles?.user_id === req.user.id) || [];

    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`);

    res.json({
      vehicles_count: vehicles?.length || 0,
      total_views: vehicles?.reduce((a, v) => a + (v.view_count || 0), 0) || 0,
      messages_count: new Set(myMessages.map(m => m.conversations?.id)).size,
      favorites_count: myFavorites.length,
      conversations_count: conversations?.length || 0
    });
  } catch (error) {
    console.error(error);
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
    
    const reportsWithDetails = await Promise.all((data || []).map(async r => {
      const { data: vehicle } = await supabase.from('vehicles').select('id, title, status, user_id').eq('id', r.vehicle_id).single();
      const { data: reporter } = await supabase.from('users').select('id, username').eq('id', r.reporter_id).single();
      return { ...r, vehicle, reporter };
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

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        profiles(is_admin),
        vehicles(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.put('/api/admin/users/:id/admin', authenticateToken, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Acceso denegado' });

    const { is_admin } = req.body;
    await supabase
      .from('profiles')
      .upsert({ user_id: req.params.id, is_admin })
      .eq('user_id', req.params.id);

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
