# AutoVehículo Market — Contexto para Claude

Marketplace de compraventa de vehículos para Argentina.

## Stack

- **Backend:** Node.js + Express (`server.js`, ~1600 líneas)
- **Frontend:** Vanilla JS SPA (`public/app.js`, `public/styles.css`, `public/index.html`)
- **Base de datos:** Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Auth:** JWT (`jsonwebtoken`) + bcrypt. Token en `localStorage`, header `Authorization: Bearer <token>`
- **Storage:** Supabase Storage, bucket `vehicle-images`
- **Mapas:** Leaflet + Nominatim (OpenStreetMap)
- **Puerto:** 3000 (definido en `.env`)

## Correr el servidor

```bash
node server.js
# o
npm run dev
```

## Correr migraciones SQL

```bash
# Usando npx (supabase CLI disponible vía npx)
npx supabase db execute --file <archivo.sql>

# O conectarse directamente con psql si hay credenciales directas
```

Los archivos `.sql` de migración están en la raíz del proyecto:
- `supabase-migration.sql` — schema inicial
- `chat-migration.sql` — read receipts
- `fix-columns.sql` — columnas adicionales
- `add-province-column.sql` — columna `province` en vehicles (**ejecutar si no está**)
- `add-accepts-trade.sql` — columna `accepts_trade` en vehicles (**ejecutar si no está**)

## Estructura de archivos

```
server.js              # Backend completo (Express + Supabase)
public/
  index.html           # HTML de la SPA (secciones, modales)
  app.js               # Lógica frontend completa
  styles.css           # Estilos globales
.claude/agents/        # Agentes especializados del proyecto
*.sql                  # Migraciones de base de datos
```

## Base de datos — tablas principales

| Tabla | Campos clave |
|-------|-------------|
| `users` | id, username, email, password_hash |
| `profiles` | user_id, phone, city, bio, avatar_url, is_admin, is_banned, is_verified, last_seen |
| `vehicles` | id, user_id, title, brand, model, year, price, mileage, fuel, transmission, city, **province**, description, status, view_count, **accepts_trade** |
| `vehicle_images` | vehicle_id, url, is_primary, order_index |
| `conversations` | vehicle_id, buyer_id, seller_id |
| `messages` | conversation_id, sender_id, content, read_at |
| `favorites` | user_id, vehicle_id |
| `ratings` | from_user_id, to_user_id, vehicle_id, stars, review |
| `notifications` | user_id, type, title, message, link, read |
| `reports` | vehicle_id, reporter_id, reason, description, status |
| `follows` | follower_id, following_id |
| `trade_offers` | vehicle_id, offered_vehicle_id, buyer_id, seller_id, status, message |

## Convenciones backend (server.js)

```js
// Auth middleware
authenticateToken   // Requerido
optionalAuth        // Opcional (no falla si no hay token)

// Cliente Supabase — siempre maybeSingle() para queries que pueden no devolver resultado
const { data, error } = await supabase.from('tabla').select().eq('id', id).maybeSingle()

// Patrón estándar de endpoint
app.METHOD('/api/ruta', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('tabla').select()
    if (error) throw error
    res.json({ data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Mensaje descriptivo' })
  }
})

// Status válidos para vehicles
['active', 'sold', 'inactive', 'paused', 'reserved']

// Status válidos para reports
['pending', 'reviewed', 'resolved', 'dismissed']
```

## Convenciones frontend (app.js)

```js
// Estado global principal
let currentUser = null          // Usuario logueado
let currentVehicleId = null     // Vehículo en detalle
let currentConversationId = null // Chat activo
let uploadedImages = []         // Imágenes en formulario publish

// Llamadas a la API
await request('/endpoint', { method: 'POST', body: JSON.stringify(data) })

// Feedback al usuario
showToast('Mensaje', 'success' | 'error' | 'info')
showConfirmModal('Título', 'Descripción', callbackFn)

// Navegación entre secciones
showSection('sectionId')
// IDs: home, vehicles, vehicle-detail, publish, my-vehicles,
//       favorites, messages, notifications, profile, admin

// Seguridad — SIEMPRE escapar contenido dinámico en innerHTML
escapeHtml(valor)

// Ciudades — estructura
AR_CITIES // Array de { label, city, prov }
AR_PROVINCES // Array de provincias únicas ordenadas
```

## Ubicación (provincia + ciudad)

Desde 2026-03-21 la ubicación está separada en dos campos:
- `province` — nombre de provincia (ej: `"Buenos Aires (Prov.)"`)
- `city` — nombre de ciudad (ej: `"Chacabuco"`)

El mapa usa ambos: `initVehicleMap(city, province)` → busca `"Ciudad, Provincia, Argentina"` en Nominatim.

## Agentes disponibles y cuándo usarlos

IMPORTANTE: Usar siempre el agente correspondiente según la tarea. No hacer cambios directamente sin delegar al agente correcto.

| Agente | Cuándo usarlo |
|--------|--------------|
| **backend-dev** | Cualquier cambio en `server.js`: endpoints, auth, middleware, Supabase queries |
| **frontend-dev** | Cualquier cambio en `app.js`, `styles.css` o `index.html` |
| **db-migration** | Nuevas columnas, tablas, índices o políticas RLS en Supabase |
| **qa-debug** | Bugs reportados, errores en consola, auditorías de código |
| **feature-planner** | Features nuevas que tocan más de un archivo — planificar antes de implementar |
| **deploy** | Deploy a producción, configuración de entorno, variables de entorno |
| **performance** | Optimizaciones de velocidad, queries lentas, bundle size |
| **seo-content** | SEO, meta tags, contenido, accesibilidad |

### Habilidades (skills) disponibles

| Skill | Cuándo usarla |
|-------|--------------|
| **webapp-testing** | Tests E2E con Playwright, verificar UI en el browser |
| **simplify** | Revisar código recién escrito para simplificarlo |

## Variables de entorno (.env)

```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
PORT=3000
ALLOWED_ORIGIN=http://localhost:3000   # (agregar si no existe)
```

## Notas importantes

- `appearance: none` en CSS **NO** aplica a `input[type="checkbox"]` ni `input[type="radio"]`
- `accepts_trade` y `province` son columnas nuevas — verificar que existan en Supabase antes de usar
- El polling del chat es cada 3 segundos, solo activo en sección `messages`
- `isAdmin`/`isBanned` hacen query a `profiles` — usan `maybeSingle()`
- El delete de vehículo hace cleanup manual en cascada (Storage + FK tables)

## Arquitectura y Optimizaciones (2026-03-21)

- **Imágenes (Frontend):** Las fotos de vehículos (1920x1080px JPEG 80%) y avatares de perfil (800x800px JPEG 85%) usan compresión por Canvas del lado del cliente ANTES de subirse a Supabase Storage con `compressImage()`, evitando transferencias pesadas. Los avatares de perfil ahora se suben a Storage devolviendo URL (no más base64 crudo en DB).
- **Notificaciones "Inteligentes":** Los endpoints `/api/messages/unread-count` y `/api/notifications/count` soportan un query param `?ignoreChat=<ID>` para no ensuciar contadores con mensajes del chat que está actualmente abierto en el DOM (`currentConversationId`).
- **Limpieza de notificaciones:** Al invocar `PUT /api/conversations/:id/read`, el backend no sólo tilda los `messages` como `read_at = NOW()`, sino que intercepta la tabla `notifications` y setea `read = true` para cualquier alerta tipo `message` ligada a este chat.
- **Lista de Conversaciones:** En `/api/conversations`, agrupamos cuántos mensajes sin leer hay de cada chat haciendo un mapeo del resultset en el array `unreadMap`, y luego se renderiza esto en `app.js` como un "badge rojo" de contador numérico.
- **Tablas Admin:** Se envuelven las tablas en un contenedor `.table-responsive` con `overflow-x: auto; -webkit-overflow-scrolling: touch;` para no romper el layout grid en dispositivos móviles.
