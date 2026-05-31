# Agente UDEP TI

Aplicación web React + API serverless para un asistente de soporte TI de la Universidad de Piura (UDEP).

**Repositorio**: https://github.com/yordanR23/udep-it-agente

## 🎯 Características

✅ 4 roles de usuario (Usuario Final, Técnico, Admin, Jefe)
✅ Panel de tickets con persistencia en localStorage
✅ Base de conocimiento interactiva
✅ Dashboard con estadísticas y gráficos
✅ Diagnóstico de red
✅ Chat en tiempo real con IA (OpenRouter, OpenAI, Anthropic)
✅ Diseño responsive y moderno
✅ Despliegue gratuito en Vercel

## 📁 Estructura del proyecto

```
.
├── src/
│   ├── App.jsx          # Componente principal
│   ├── main.jsx         # Bootstrap React
│   └── styles.css       # Estilos globales
├── api/
│   └── chat.js          # Serverless function (Vercel)
├── index.html           # Entrada HTML
├── package.json         # Dependencias
├── vercel.json          # Configuración Vercel
├── vite.config.js       # Config Vite
└── .env.example         # Variables de entorno (plantilla)
```

## 🚀 Despliegue en Vercel (recomendado)

### Paso 1: Crear cuenta en Vercel
1. Ve a https://vercel.com
2. Haz clic en "Sign up" y conecta con GitHub

### Paso 2: Importar proyecto
1. Haz clic en "Add New..." → "Project"
2. Selecciona tu repositorio `udep-it-agente`
3. Vercel detectará automáticamente la configuración desde `vercel.json`

### Paso 3: Configurar variables de entorno
En el panel de Vercel, haz clic en "Environment Variables" y agrega:

```
AGENT_API_URL=https://openrouter.ai/v1/chat/completions
AGENT_API_KEY=tu_clave_sk-or-...
AGENT_API_PROVIDER=openrouter
AGENT_MODEL=gpt-4o-mini
```

### Paso 4: Desplegar
Haz clic en "Deploy" y espera a que termine.

**Tu agente estará en vivo en**: `https://tu-proyecto.vercel.app`

## 💻 Desarrollo local

### Instalación

```bash
npm install
```

### Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173 en tu navegador.

### Compilar para producción

```bash
npm run build
```

Genera el frontend en `dist/`.

## 🔑 Configuración de IA

### OpenRouter (recomendado)

```env
AGENT_API_PROVIDER=openrouter
AGENT_API_URL=https://openrouter.ai/v1/chat/completions
AGENT_API_KEY=sk-or-tu-clave-aqui
AGENT_MODEL=gpt-4o-mini
```

Obtén tu clave en: https://openrouter.ai

### OpenAI

```env
AGENT_API_PROVIDER=openai
AGENT_API_URL=https://api.openai.com/v1/chat/completions
AGENT_API_KEY=sk-...
AGENT_MODEL=gpt-4o
```

### Anthropic

```env
AGENT_API_PROVIDER=anthropic
AGENT_API_URL=https://api.anthropic.com/v1/messages
AGENT_API_KEY=sk-ant-...
AGENT_MODEL=claude-opus-4-1
```

## 📝 Notas importantes

- Tu archivo `.env` local NO se sube a GitHub (excluido en `.gitignore`)
- Usa `.env.example` como plantilla
- Las variables se configuran en Vercel desde el panel de control
- El backend usa Vercel Serverless Functions (sin costo adicional)
- Los tickets se guardan en `localStorage` del navegador

## 🛠️ Stack tecnológico

- **Frontend**: React 18 + Vite
- **Estilos**: CSS vanilla (DM Sans font)
- **Backend**: Vercel Serverless Functions
- **APIs soportadas**: OpenRouter, OpenAI, Anthropic

## 📚 Roles disponibles

1. **Usuario Final** - Reportar incidencias, consultar estado, acceso a base de conocimiento
2. **Técnico** - Gestión de tickets, diagnóstico, búsqueda de usuarios
3. **Admin** - Acceso total, logs del sistema, inventario
4. **Jefe** - Dashboard ejecutivo, reportes, estadísticas

## 🤝 Contribuciones

Para hacer cambios:

```bash
git clone https://github.com/yordanR23/udep-it-agente.git
git checkout -b feature/tu-feature
git add .
git commit -m "Descripción del cambio"
git push origin feature/tu-feature
```

Luego abre un Pull Request en GitHub.

## 📧 Contacto

Para soporte o preguntas sobre el agente, contacta al equipo de TI de UDEP.

---

**Última actualización**: 31 de mayo de 2026
