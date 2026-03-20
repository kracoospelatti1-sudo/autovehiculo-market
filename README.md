# AutoVehículo Market 🚗

Plataforma moderna para la compra y venta de vehículos con sistema de registro, chat en tiempo real y panel de administración.

## Características

- 🏎️ **Exploración de Vehículos**: Filtros avanzados por marca, modelo, precio, año y más.
- 👤 **Gestión de Usuarios**: Registro, inicio de sesión y perfiles personalizados.
- 💬 **Mensajería**: Chat integrado para conectar compradores y vendedores.
- ⭐ **Favoritos y Calificaciones**: Guarda tus vehículos preferidos y califica a los vendedores.
- 🔔 **Notificaciones**: Sistema de alertas para mensajes y nuevos favoritos.
- 🛡️ **Panel Admin**: Control de reportes y gestión de usuarios.

## Requisitos Previos

- **Node.js**: v14 o superior.
- **Supabase**: Una cuenta y proyecto activo.

## Configuración

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   Crea o edita el archivo `.env` en la raíz del proyecto:
   ```env
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_KEY=tu_service_role_key
   JWT_SECRET=una_clave_secreta_segura
   PORT=3000
   ```

3. **Configurar la base de datos**:
   Copia el contenido de `supabase-migration.sql` y ejecútalo en el **SQL Editor** de tu panel de Supabase.

4. **Configurar Storage**:
   Crea un bucket público llamado `vehicle-images` en Supabase Storage.

## Ejecución

Para iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

El sitio estará disponible en `http://localhost:3000`.

## Tecnologías

- **Backend**: Node.js, Express, JWT, Bcrypt, Multer.
- **Database**: Supabase (PostgreSQL).
- **Frontend**: Vanilla HTML5, CSS3 (Modern UI), JavaScript (ES6).
