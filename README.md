# Agente UDEP TI

Aplicación web React + backend proxy para un asistente de soporte TI de la Universidad de Piura (UDEP).

## Estructura

- `index.html` - entrada de la aplicación.
- `src/main.jsx` - arranca React.
- `src/App.jsx` - componente principal del agente.
- `server.js` - proxy backend para enviar solicitudes a la API de IA.
- `vite.config.js` - configuración de desarrollo y proxy local.
- `.env.example` - ejemplo de variables de entorno.

## Instalación

1. Copia `.env.example` a `.env`.
2. Completa `AGENT_API_URL` y `AGENT_API_KEY`.
3. Ejecuta:

```bash
npm install
```

## Desarrollo local

Abre dos terminales mientras desarrollas:

```bash
npm run backend
```

```bash
npm run dev
```

El frontend usará el proxy local para llamar a `/api/chat`.

## Producción

1. Ejecuta `npm run build`.
2. Inicia el servidor con `npm start`.

> El backend sirve los archivos estáticos desde `dist` y comprueba las variables `AGENT_API_URL` y `AGENT_API_KEY`.

## Configuración de IA

- `AGENT_API_PROVIDER` puede ser `anthropic`, `openai` o `openrouter`.
- `AGENT_API_URL` debe apuntar al endpoint de la API.
- `AGENT_API_MODEL` puede personalizarse según el proveedor.

## Notas

- Los tickets se guardan en `localStorage` para mantener el estado entre recargas.
- La aplicación está lista para desplegar en un entorno real con un proxy backend y la API de IA configurada.
