# Feel & Flow

Aplicación para crear rutinas de gimnasio y acompañar el progreso personal. El proyecto separa el frontend React/Vite de una API Express con persistencia SQLite.

## Requisitos

- Node.js 22 o superior
- npm

## Desarrollo local

Desde la raíz del repositorio:

```sh
npm install
npm run dev
```

El frontend estará disponible en `http://127.0.0.1:5173` y la API en `http://127.0.0.1:3001`. Vite redirige las solicitudes `/api` al backend.

Para configurar el backend, copiá `backend/.env.example` a `backend/.env`. La base SQLite se crea por defecto en `backend/data/feel-flow.sqlite`; se puede cambiar con `DATABASE_PATH`.

## Comandos

```sh
npm run build  # Compila el frontend en frontend/dist
npm run lint   # Ejecuta ESLint en el frontend
npm test       # Ejecuta las pruebas de integración del backend
npm start      # Inicia el backend
```

Después de compilar el frontend, `npm start` también sirve `frontend/dist` desde el backend.

## Estructura

- `frontend/`: pantallas, estilos, recursos estáticos y cliente de API.
- `backend/`: API, autenticación, SQLite y pruebas.

Las cuentas, sesiones, perfiles, rutinas y asistencias se guardan en SQLite. Cada cuenta empieza sin rutinas y puede crear su primera desde la pantalla de inicio.
