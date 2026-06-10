import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';

const STORAGE_KEY = 'udep_helpdesk_tickets_v2';
const CLEAN_BOOT_KEY = 'udep_helpdesk_clean_boot_v2';
const ALLOWED_ROLES = ['usuario', 'tecnico', 'jefe'];
const AUTO_SYNC_MS = 60000;
const AUTO_TECHNICIAN_EMAIL = 'tecnico@udep.pe';
const BOSS_NOTIFICATION_LABEL = 'Jefe de Mesa de Ayuda';

const ROLES = {
  usuario: {
    label: 'Usuario Final',
    subtitle: 'Docente / Alumno / Administrativo',
    icon: '👤',
    tools: ['mis_tickets', 'base_conocimiento'],
    welcome: 'Hola. Soy el motor lógico de Mesa de Ayuda. Puedo crear tickets por chat, mostrar tus tickets, modificar un campo de tus tickets, eliminarlos y darte recomendaciones de soporte.',
  },
  tecnico: {
    label: 'Técnico',
    subtitle: 'Soporte asignado',
    icon: '🔧',
    tools: ['tickets_asignados', 'pendientes'],
    welcome: 'Panel técnico activo. Solo puedes ver tickets asignados a tu usuario, agregar comentarios y cambiar su estado.',
  },
  jefe: {
    label: 'Jefe',
    subtitle: 'Gestión de Mesa de Ayuda',
    icon: '📊',
    tools: ['todos_tickets', 'dashboard', 'asignar_tecnico', 'sincronizar_sheets'],
    welcome: 'Panel de jefatura activo. Puedes consultar todos los tickets, ver indicadores y asignar técnicos. Genera reportes o gráficos desde el chat.',
  },
};

const TOOLS_META = {
  mis_tickets: { icon: '📋', label: 'Mis tickets', desc: 'Tickets reportados' },
  tickets_asignados: { icon: '🧰', label: 'Asignados', desc: 'Solo mis tickets' },
  pendientes: { icon: '⏱️', label: 'Pendientes', desc: 'Abiertos o en proceso' },
  todos_tickets: { icon: '📚', label: 'Todos los tickets', desc: 'Vista global' },
  dashboard: { icon: '📊', label: 'Dashboard', desc: 'Indicadores clave' },
  asignar_tecnico: { icon: '👥', label: 'Asignar técnico', desc: 'Asignación manual' },
  sincronizar_sheets: { icon: '🔄', label: 'Google Sheets', desc: 'Sincronizar datos' },
  base_conocimiento: { icon: '💡', label: 'Recomendaciones', desc: 'Ayuda rápida' },
};

const KNOWLEDGE_BASE = [
  {
    keywords: ['wifi', 'wi-fi', 'red', 'internet', 'conexion', 'conexión'],
    category: 'Red',
    title: 'Problema de WiFi',
    steps: [
      'Verifica que el WiFi esté activo y que estés conectado a la red institucional correcta.',
      'Desconéctate y vuelve a conectarte; si el equipo lo permite, usa la opción "Olvidar red" y autentícate nuevamente.',
      'Reinicia el adaptador WiFi o el equipo si otros dispositivos sí tienen conexión.',
      'Si el problema ocurre en toda el aula, mantén el ticket abierto para revisión de punto de acceso o cobertura.',
    ],
    source: 'Basado en guías oficiales de Microsoft Support sobre problemas de conexión WiFi.',
  },
  {
    keywords: ['moodle', 'aula virtual', 'campus virtual'],
    category: 'Software',
    title: 'Problema de acceso a Moodle',
    steps: [
      'Prueba ingresar desde una ventana privada o de incógnito.',
      'Limpia caché y cookies del navegador.',
      'Confirma que tu cuenta institucional funciona en otros servicios.',
      'Si el error persiste, adjunta el mensaje exacto o una captura al ticket.',
    ],
    source: 'Basado en prácticas recomendadas de soporte de plataformas web y documentación de Moodle.',
  },
  {
    keywords: ['contraseña', 'password', 'clave', 'correo', 'gmail', 'cuenta'],
    category: 'Accesos',
    title: 'Problema de acceso a cuenta institucional',
    steps: [
      'Verifica que estés usando tu correo institucional completo.',
      'Prueba recuperación de contraseña por el canal institucional autorizado.',
      'Evita compartir contraseñas o códigos de verificación por chat.',
      'Si la cuenta está bloqueada o suspendida, el ticket debe revisarse por TI.',
    ],
    source: 'Basado en recomendaciones de Google Workspace Admin Help para problemas de inicio de sesión.',
  },
  {
    keywords: ['proyector', 'pantalla', 'hdmi', 'imagen', 'monitor'],
    category: 'Hardware',
    title: 'Problema con proyector o pantalla',
    steps: [
      'Verifica que el proyector o pantalla esté encendido.',
      'Revisa que el cable HDMI o adaptador esté bien conectado.',
      'Cambia la fuente de entrada del proyector si no detecta señal.',
      'Prueba duplicar pantalla desde el equipo antes de escalar a soporte físico.',
    ],
    source: 'Basado en prácticas comunes de diagnóstico de hardware audiovisual.',
  },
];

const TICKET_FIELDS = ['titulo', 'categoria', 'descripcion', 'prioridad', 'aula', 'edificio'];
const STATES = ['abierto', 'en_proceso', 'resuelto', 'pendiente'];
const CATEGORIES = ['Red', 'Hardware', 'Software', 'Accesos', 'Otro'];
const PRIORITIES = ['alta', 'media', 'baja'];
const RESOLVE_TICKET_REGEX = /(?:cerrar|cierra|cerrado|resolver|resuelve|resuelto|solucionar|solucionado|atender|atiende|atendido).*(TKT-\d+)/i;
const PRIORITY_RANK = { baja: 1, media: 2, alta: 3 };

function TypingDots() {
  return (
    <span className="typing-dots">
      {[0, 1, 2].map((i) => <span key={i} />)}
    </span>
  );
}

function normalize(text) {
  return String(text || '').trim();
}

function lower(text) {
  return normalize(text).toLowerCase();
}

function makeTicketId(count) {
  return `TKT-${String(count + 1).padStart(3, '0')}`;
}

function makeNextTicketId(tickets) {
  const maxId = tickets.reduce((max, ticket) => {
    const match = String(ticket.id || '').match(/TKT-(\d+)/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return makeTicketId(maxId);
}

function statusLabel(estado) {
  return {
    abierto: 'Abierto',
    en_proceso: 'En progreso',
    resuelto: 'Resuelto',
    pendiente: 'Pendiente',
  }[estado] || estado || 'Sin estado';
}

function TicketBadge({ estado }) {
  const map = {
    abierto: { bg: '#fef2f2', color: '#dc2626' },
    en_proceso: { bg: '#fffbeb', color: '#d97706' },
    resuelto: { bg: '#f0fdf4', color: '#16a34a' },
    pendiente: { bg: '#eff6ff', color: '#2563eb' },
  };
  const s = map[estado] || map.abierto;
  return <span className="ticket-badge" style={{ background: s.bg, color: s.color }}>{statusLabel(estado)}</span>;
}

function PrioridadDot({ p }) {
  const c = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
  return <span className="prioridad-dot" style={{ background: c[p] || '#94a3b8' }} />;
}

export default function App() {
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginRole, setLoginRole] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null);
  const [tickets, setTickets] = useState(() => {
    if (localStorage.getItem(CLEAN_BOOT_KEY) !== 'done') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(CLEAN_BOOT_KEY, 'done');
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [draft, setDraft] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (tickets.some((ticket) => !ticket.sincronizado)) {
        syncTicketsToSheet(tickets, { automatic: true });
      }
    }, AUTO_SYNC_MS);

    return () => window.clearInterval(interval);
  }, [tickets]);

  const roleData = role ? ROLES[role] : null;
  const visibleTickets = useMemo(() => getVisibleTickets(tickets, role, currentUser), [tickets, role, currentUser]);
  const dashboard = useMemo(() => buildDashboard(tickets), [tickets]);

  function startLogin(r) {
    if (!ALLOWED_ROLES.includes(r)) return;
    setLoginRole(r);
    setAuthError('');
    setLoginEmail('');
    setLoginPassword('');
  }

  function selectRole(r, email) {
    const user = { id: email, email, role: r };
    setRole(r);
    setCurrentUser(user);
    setMessages([{ role: 'assistant', text: ROLES[r].welcome }]);
    setPanel(null);
    setDraft(null);
  }

  async function handleLoginSubmit() {
    if (!loginRole || !ALLOWED_ROLES.includes(loginRole)) return;
    setLoading(true);
    setAuthError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole,
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error de autenticación');
      selectRole(data.role, data.email);
      setLoginRole(null);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function appendAssistant(text) {
    setMessages((prev) => [...prev, { role: 'assistant', text }]);
  }

  function addTicket(ticket) {
    setTickets((prev) => [ticket, ...prev]);
  }

  function updateTicket(ticketId, updater) {
    setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? updater(ticket) : ticket)));
  }

  function deleteTicket(ticketId) {
    setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
  }

  function getRecommendation(text) {
    const query = lower(text);
    const match = KNOWLEDGE_BASE.find((item) => item.keywords.some((keyword) => query.includes(keyword)));
    if (!match) return '';

    return [
      'Recomendación inicial que puedes intentar:',
      ...match.steps.map((step, index) => `${index + 1}. ${step}`),
      match.source,
    ].join('\n');
  }

  function mergeTicketDraft(base, text) {
    const extracted = extractTicketData(text);
    const explicitPriority = normalizePriority(text);
    const category = extracted.categoria !== 'Otro'
      ? extracted.categoria
      : base.categoria || extracted.categoria;
    const priority = !base.prioridad || explicitPriority || PRIORITY_RANK[extracted.prioridad] > PRIORITY_RANK[base.prioridad]
      ? extracted.prioridad
      : base.prioridad;
    const descripcion = normalize(base.descripcion)
      ? `${base.descripcion}\n${normalize(text)}`.trim()
      : extracted.descripcion || normalize(text);

    return {
      ...base,
      ...Object.fromEntries(Object.entries(extracted).filter(([key, value]) => normalize(value) && !['categoria', 'prioridad', 'descripcion', 'titulo'].includes(key))),
      categoria: category,
      prioridad: priority,
      descripcion,
      titulo: buildTicketTitle({ categoria: category, descripcion, aula: extracted.aula || base.aula }),
    };
  }

  function missingTicketFields(data) {
    return [
      !data.descripcion && 'descripción del problema',
      !data.categoria && 'categoría',
      !data.aula && 'aula o lugar',
      !data.edificio && 'edificio',
    ].filter(Boolean);
  }

  function buildMissingFieldsQuestion(data) {
    const missing = missingTicketFields(data);
    if (!missing.length) return '';
    return `Para registrar el ticket me falta: ${missing.join(', ')}. Puedes responderlo en una sola frase.`;
  }

  function createTicketFromDraft(data) {
    const today = new Date().toISOString().slice(0, 10);
    const priority = data.prioridad || inferPriority(`${data.categoria} ${data.descripcion} ${data.aula} ${data.edificio}`);
    const autoAssigned = priority === 'alta';
    const createdTicket = {
      id: makeNextTicketId(tickets),
      titulo: data.titulo || buildTicketTitle(data),
      categoria: data.categoria || inferCategory(data.descripcion),
      descripcion: summarizeDescription(data.descripcion),
      estado: autoAssigned ? 'pendiente' : 'abierto',
      prioridad: priority,
      tecnicoId: autoAssigned ? AUTO_TECHNICIAN_EMAIL : '',
      tecnico: autoAssigned ? AUTO_TECHNICIAN_EMAIL : 'Sin asignar',
      fecha: today,
      aula: data.aula || 'No especificado',
      edificio: data.edificio || 'No especificado',
      fechaModificacion: today,
      usuarioId: currentUser.id,
      usuario: currentUser.email,
      comentarios: [],
      notificaciones: [
        {
          para: BOSS_NOTIFICATION_LABEL,
          motivo: autoAssigned
            ? `Ticket de prioridad alta autoasignado a ${AUTO_TECHNICIAN_EMAIL}.`
            : 'Ticket pendiente de asignación manual por jefatura.',
          fecha: new Date().toISOString(),
        },
      ],
      sincronizado: false,
    };
    addTicket(createdTicket);
    return createdTicket;
  }

  function finishTicketReply(ticket) {
    const recommendation = getRecommendation(`${ticket.categoria} ${ticket.descripcion}`);
    const notificationText = ticket.prioridad === 'alta'
      ? `Por prioridad alta, lo asigné automáticamente a ${ticket.tecnico} y notifiqué al jefe.`
      : 'Notifiqué al jefe para que asigne un técnico.';

    return [
      `Ticket ${ticket.id} creado.`,
      `Título: ${ticket.titulo}`,
      `Categoría: ${ticket.categoria}`,
      `Prioridad: ${ticket.prioridad}`,
      `Ubicación: ${ticket.aula} / ${ticket.edificio}`,
      notificationText,
      recommendation,
    ].filter(Boolean).join('\n\n');
  }

  function startTicketConversation(seedText) {
    const data = mergeTicketDraft({ titulo: '', categoria: '', descripcion: '', prioridad: '', aula: '', edificio: '' }, seedText);
    const missingQuestion = buildMissingFieldsQuestion(data);

    if (missingQuestion) {
      setDraft({ data });
      return [
        'Entendí el incidente y preparé un borrador de ticket.',
        data.titulo ? `Título sugerido: ${data.titulo}` : '',
        data.categoria ? `Categoría detectada: ${data.categoria}` : '',
        data.aula ? `Aula/lugar detectado: ${data.aula}` : '',
        getRecommendation(seedText),
        missingQuestion,
      ].filter(Boolean).join('\n\n');
    }

    const createdTicket = createTicketFromDraft(data);
    setDraft(null);
    return finishTicketReply(createdTicket);
  }

  function continueTicketConversation(text) {
    if (!draft) return null;
    const data = mergeTicketDraft(draft.data, text);
    const missingQuestion = buildMissingFieldsQuestion(data);
    if (missingQuestion) {
      setDraft({ data });
      return missingQuestion;
    }

    const createdTicket = createTicketFromDraft(data);
    setDraft(null);
    return finishTicketReply(createdTicket);
  }

  function applyTicketFieldUpdate(ticketId, field, rawValue, allowedTickets) {
    const ticket = allowedTickets.find((t) => t.id === ticketId);
    if (!ticket) return null;

    const today = new Date().toISOString().slice(0, 10);
    const value = normalizeFieldValue(field, rawValue);
    if (!value) return `No pude identificar un valor valido para ${field}.`;
    if (field === 'prioridad' && !PRIORITIES.includes(value)) return `Prioridad no valida. Usa: ${PRIORITIES.join(', ')}.`;
    if (field === 'categoria' && !CATEGORIES.includes(value)) return `Categoria no valida. Usa: ${CATEGORIES.join(', ')}.`;

    updateTicket(ticketId, (t) => {
      const next = {
        ...t,
        [field]: value,
        fechaModificacion: today,
        sincronizado: false,
      };

      if (field === 'prioridad' && value === 'alta') {
        next.estado = t.estado === 'abierto' ? 'pendiente' : t.estado;
        next.tecnicoId = t.tecnicoId || AUTO_TECHNICIAN_EMAIL;
        next.tecnico = t.tecnicoId ? t.tecnico : AUTO_TECHNICIAN_EMAIL;
        next.notificaciones = [
          ...(t.notificaciones || []),
          {
            para: BOSS_NOTIFICATION_LABEL,
            motivo: `Prioridad actualizada a alta en ${ticketId}.`,
            fecha: new Date().toISOString(),
          },
        ];
      }

      return next;
    });

    const assignmentNote = field === 'prioridad' && value === 'alta' && !ticket.tecnicoId
      ? ` Lo asigné automáticamente a ${AUTO_TECHNICIAN_EMAIL}.`
      : '';
    return `Ticket ${ticketId} actualizado: ${field} = ${value}.${assignmentNote}`;
  }

  function handleUsuarioCommand(text) {
    const q = lower(text);
    const ownTickets = getVisibleTickets(tickets, 'usuario', currentUser);
    const implicitTicketId = getImplicitTicketId(ownTickets, text);

    const fieldUpdate = parseTicketFieldUpdate(text, implicitTicketId);
    if (fieldUpdate) {
      const result = applyTicketFieldUpdate(fieldUpdate.ticketId, fieldUpdate.field, fieldUpdate.value, ownTickets);
      return result || 'No puedo modificar ese ticket porque no pertenece a tu usuario o no existe.';
    }

    if (isTicketCreationIntent(q)) return startTicketConversation(text);

    const resolveMatch = text.match(RESOLVE_TICKET_REGEX);
    if (resolveMatch) {
      const ticketId = resolveMatch[1].toUpperCase();
      const ticket = ownTickets.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedo cerrar ese ticket porque no pertenece a tu usuario o no existe.';
      return 'No tienes permisos para cerrar tickets. Un tecnico o jefe de TI debe marcarlo como resuelto.';
    }

    if (q.includes('mis tickets') || q.includes('ver tickets') || q.includes('estado')) {
      return summarizeTickets(ownTickets, 'Tus tickets');
    }

    const deleteMatch = q.match(/eliminar\s+(tkt-\d+)/i);
    if (deleteMatch) {
      const ticketId = deleteMatch[1].toUpperCase();
      const ticket = ownTickets.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedo eliminar ese ticket porque no pertenece a tu usuario o no existe.';
      deleteTicket(ticketId);
      return `Ticket ${ticketId} eliminado.`;
    }

    if (q.includes('recomend')) return getRecommendation(q).replace('\n\n', '') || null;
    return null;
  }

  function handleTecnicoCommand(text) {
    const q = lower(text);
    const assigned = getVisibleTickets(tickets, 'tecnico', currentUser);

    if (q.includes('pendientes')) return summarizeTickets(assigned.filter((t) => t.estado !== 'resuelto'), 'Tus tickets pendientes');
    if (q.includes('tickets') || q.includes('asignados')) return summarizeTickets(assigned, 'Tus tickets asignados');

    const resolveMatch = text.match(RESOLVE_TICKET_REGEX);
    if (resolveMatch) {
      const ticketId = resolveMatch[1].toUpperCase();
      const ticket = assigned.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedes cerrar ese ticket porque no esta asignado a tu usuario.';
      updateTicket(ticketId, (t) => ({
        ...t,
        estado: 'resuelto',
        comentarios: [
          ...(t.comentarios || []),
          { autor: currentUser.email, texto: 'Ticket marcado como resuelto por soporte TI.', fecha: new Date().toISOString() },
        ],
        fechaModificacion: new Date().toISOString().slice(0, 10),
        sincronizado: false,
      }));
      return `Ticket ${ticketId} actualizado a ${statusLabel('resuelto')}.`;
    }

    const startedMatch = text.match(/(?:iniciad[oa]|empec[eé]|comenc[eé]|atenci[oó]n|atendiendo|en atenci[oó]n).*(TKT-\d+)/i);
    if (startedMatch) {
      const ticketId = startedMatch[1].toUpperCase();
      const ticket = assigned.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedo iniciar la atención de ese ticket porque no está asignado a tu usuario.';
      updateTicket(ticketId, (t) => ({ ...t, estado: 'en_proceso', fechaModificacion: new Date().toISOString().slice(0, 10), sincronizado: false }));
      return `Entendido. Actualicé el ticket ${ticketId} a En progreso.`;
    }

    const stateMatch = text.match(/(?:estado|cambiar)\s+(TKT-\d+)\s+(?:a\s+)?([a-z_ ]+)/i);
    if (stateMatch) {
      const ticketId = stateMatch[1].toUpperCase();
      const estado = normalizeState(stateMatch[2]);
      const ticket = assigned.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedes cambiar ese ticket porque no está asignado a tu usuario.';
      if (!STATES.includes(estado)) return `Estado no válido. Usa: ${STATES.join(', ')}.`;
      updateTicket(ticketId, (t) => ({ ...t, estado, fechaModificacion: new Date().toISOString().slice(0, 10), sincronizado: false }));
      return `Ticket ${ticketId} actualizado a ${statusLabel(estado)}.`;
    }

    const commentMatch = text.match(/(?:comentar|comentario)\s+(TKT-\d+)\s+(.+)/i);
    if (commentMatch) {
      const ticketId = commentMatch[1].toUpperCase();
      const ticket = assigned.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedes comentar ese ticket porque no está asignado a tu usuario.';
      updateTicket(ticketId, (t) => ({
        ...t,
        comentarios: [...(t.comentarios || []), { autor: currentUser.email, texto: normalize(commentMatch[2]), fecha: new Date().toISOString() }],
        fechaModificacion: new Date().toISOString().slice(0, 10),
        sincronizado: false,
      }));
      return `Comentario agregado al ticket ${ticketId}.`;
    }

    return null;
  }

  function handleJefeCommand(text) {
    const q = lower(text);
    const implicitTicketId = getImplicitTicketId(tickets.length === 1 ? tickets : [], text);

    if (q.includes('dashboard') || q.includes('indicadores')) return dashboardText(dashboard);
    if (q.includes('pdf') || q.includes('reporte')) {
      downloadReportPdf();
      return 'Reporte general PDF generado.';
    }
    if (q.includes('grafico temporal') || q.includes('serie temporal') || q.includes('temporal')) {
      downloadTemporalChartPng();
      return 'Gráfico temporal de incidentes generado en PNG.';
    }
    if (q.includes('grafico circular') || q.includes('circular') || q.includes('grafico por prioridad') || q.includes('grafico por estado')) {
      const type = q.includes('prioridad') ? 'prioridad' : 'estado';
      downloadCircularChartPng(type);
      return `Gráfico circular por ${type} generado en PNG.`;
    }
    if (q.includes('todos') || q.includes('tickets')) return summarizeTickets(tickets, 'Todos los tickets del sistema');
    if (q.includes('sincron')) {
      syncTicketsToSheet(tickets);
      return 'Sincronización con Google Sheets iniciada.';
    }

    const fieldUpdate = parseTicketFieldUpdate(text, implicitTicketId);
    if (fieldUpdate) {
      const result = applyTicketFieldUpdate(fieldUpdate.ticketId, fieldUpdate.field, fieldUpdate.value, tickets);
      return result || `No existe el ticket ${fieldUpdate.ticketId}.`;
    }

    const resolveMatch = text.match(RESOLVE_TICKET_REGEX);
    if (resolveMatch) {
      const ticketId = resolveMatch[1].toUpperCase();
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return `No existe el ticket ${ticketId}.`;
      updateTicket(ticketId, (t) => ({
        ...t,
        estado: 'resuelto',
        comentarios: [
          ...(t.comentarios || []),
          { autor: currentUser.email, texto: 'Ticket marcado como resuelto por jefatura TI.', fecha: new Date().toISOString() },
        ],
        fechaModificacion: new Date().toISOString().slice(0, 10),
        sincronizado: false,
      }));
      return `Ticket ${ticketId} actualizado a ${statusLabel('resuelto')}.`;
    }

    const assignMatch = text.match(/asignar\s+(TKT-\d+)\s+(?:a\s+)?([^\s]+@[^\s]+)/i);
    if (assignMatch) {
      const ticketId = assignMatch[1].toUpperCase();
      const tecnicoEmail = assignMatch[2].toLowerCase();
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return `No existe el ticket ${ticketId}.`;
      updateTicket(ticketId, (t) => ({ ...t, tecnicoId: tecnicoEmail, tecnico: tecnicoEmail, estado: t.estado === 'abierto' ? 'pendiente' : t.estado, fechaModificacion: new Date().toISOString().slice(0, 10), sincronizado: false }));
      return `Ticket ${ticketId} asignado a ${tecnicoEmail}.`;
    }

    return null;
  }

  function buildAgentMessages(nextUserText) {
    return [...messages, { role: 'user', text: nextUserText }]
      .slice(-12)
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        text: message.text,
      }));
  }

  function buildAgentContext() {
    return {
      userEmail: currentUser?.email,
      tickets: visibleTickets,
    };
  }

  async function askConversationalAgent(nextUserText) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          context: buildAgentContext(),
          messages: buildAgentMessages(nextUserText),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo conectar con el agente IA.');
      return normalize(data.content) || fallbackConversationalReply(nextUserText);
    } catch (error) {
      return fallbackConversationalReply(nextUserText, error.message);
    }
  }

  function fallbackConversationalReply(text, errorMessage = '') {
    const recommendation = getRecommendation(text);
    if (recommendation) return recommendation;

    const base = role === 'jefe'
      ? 'Puedo ayudarte a revisar indicadores, tickets, asignaciones, reportes o carga operativa. Cuéntame qué decisión o dato necesitas y lo aterrizamos.'
      : role === 'tecnico'
        ? 'Puedo ayudarte a diagnosticar el caso, revisar tickets asignados, agregar comentarios o cambiar estados. Describe el síntoma, equipo, ubicación e impacto.'
        : 'Puedo ayudarte con problemas de red, correo, Moodle, equipos, accesos o creación de tickets. Describe qué ocurre, dónde ocurre y desde cuándo.';

    return errorMessage ? `${base}\n\nNota: no pude consultar el modelo IA en este momento (${errorMessage}).` : base;
  }

  async function sendMessage() {
    if (!input.trim() || loading || !role || !currentUser) return;
    const text = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      let reply = draft ? continueTicketConversation(text) : null;
      if (!reply) {
        if (role === 'usuario') reply = handleUsuarioCommand(text);
        if (role === 'tecnico') reply = handleTecnicoCommand(text);
        if (role === 'jefe') reply = handleJefeCommand(text);
      }
      if (!reply) reply = await askConversationalAgent(text);
      appendAssistant(reply || fallbackConversationalReply(text));
    } finally {
      setLoading(false);
    }
  }

  function buildCsvText(ticketsToExport) {
    const header = ['ID', 'Titulo', 'Categoria', 'Estado', 'Prioridad', 'Aula', 'Edificio', 'Usuario', 'Tecnico', 'Fecha', 'Descripcion'];
    const rows = ticketsToExport.map((ticket) => [ticket.id, ticket.titulo, ticket.categoria, ticket.estado, ticket.prioridad, ticket.aula, ticket.edificio, ticket.usuario, ticket.tecnico, ticket.fecha, ticket.descripcion]);
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  function buildReportSummary(tickets) {
    const total = tickets.length;
    const abiertos = tickets.filter((t) => t.estado === 'abierto').length;
    const enTrabajo = tickets.filter((t) => t.estado === 'en_proceso' || t.estado === 'pendiente').length;
    const resueltos = tickets.filter((t) => t.estado === 'resuelto').length;
    const topCategory = tickets.reduce((counts, ticket) => {
      counts[ticket.categoria] = (counts[ticket.categoria] || 0) + 1;
      return counts;
    }, {});
    const sortedCategories = Object.entries(topCategory).sort((a, b) => b[1] - a[1]);
    const frequentCategory = sortedCategories[0] ? `${sortedCategories[0][0]} (${sortedCategories[0][1]})` : 'N/A';
    const highPriority = tickets.filter((t) => t.prioridad === 'alta').length;

    return [
      `Resumen generado por IA: Se han registrado ${total} tickets en el periodo.`,
      `Actualmente hay ${abiertos} ticket(s) abiertos, ${enTrabajo} en proceso/pendientes y ${resueltos} resuelto(s).`,
      `La categoría más frecuente es ${frequentCategory}.`,
      `Hay ${highPriority} ticket(s) de prioridad alta que requieren atención inmediata.`,
      `Recomiendo revisar primero los tickets de prioridad alta y los de la categoría más común para reducir el volumen de solicitudes recurrentes.`,
    ].join(' ');
  }

  function buildReportRecommendations(tickets) {
    const recommendations = [];
    if (tickets.some((t) => t.prioridad === 'alta')) {
      recommendations.push('Atender los tickets de prioridad alta lo antes posible para evitar impacto en la operación.');
    }
    if (tickets.some((t) => t.estado === 'abierto')) {
      recommendations.push('Revisar los tickets abiertos y asignarlos a técnicos para que no queden sin seguimiento.');
    }
    if (tickets.some((t) => t.tecnico === 'Sin asignar')) {
      recommendations.push('Asignar técnicos a los tickets sin responsable para mejorar la trazabilidad.');
    }
    if (!recommendations.length) {
      recommendations.push('El flujo de gestión está estable; continúa con el seguimiento normal y la sincronización periódica con Google Sheets.');
    }
    return recommendations;
  }

  function downloadTicketsCsv(ticketsToExport = visibleTickets) {
    const blob = new Blob([buildCsvText(ticketsToExport)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tickets-helpdesk.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function createTicketPng(ticket) {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 900, 520);
    ctx.fillStyle = '#172554';
    ctx.fillRect(0, 0, 900, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px sans-serif';
    ctx.fillText(`Ticket ${ticket.id}`, 32, 44);
    ctx.font = '15px sans-serif';
    ctx.fillText(ticket.titulo || 'Incidente', 32, 70);
    drawWrappedFields(ctx, ticket);
    downloadCanvas(canvas, `ticket-${ticket.id}.png`);
  }

  function downloadChartsPng() {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 640;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '26px sans-serif';
    ctx.fillText('Mesa de Ayuda - Graficos', 32, 46);
    drawTimeSeries(ctx, tickets, 40, 95, 560, 220);
    drawCircularChart(ctx, tickets, 760, 205, 115, 'estado');
    downloadCanvas(canvas, 'resumen-tickets.png');
  }

  function downloadTemporalChartPng() {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '24px sans-serif';
    ctx.fillText('Mesa de Ayuda - Gráfico Temporal', 32, 44);
    drawTimeSeries(ctx, tickets, 40, 90, 920, 240);
    downloadCanvas(canvas, 'grafico-temporal-tickets.png');
  }

  function downloadCircularChartPng(type = 'estado') {
    const canvas = document.createElement('canvas');
    canvas.width = 620;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '24px sans-serif';
    const title = type === 'prioridad' ? 'Gráfico Circular por Prioridad' : 'Gráfico Circular por Estado';
    ctx.fillText(title, 32, 44);
    drawCircularChart(ctx, tickets, 320, 240, 140, type);
    downloadCanvas(canvas, `grafico-circular-${type}.png`);
  }

  function drawCircularChart(ctx, tickets, cx, cy, radius, type = 'estado') {
    const items = type === 'prioridad' ? PRIORITIES : STATES;
    const colors = type === 'prioridad' ? ['#ef4444', '#f59e0b', '#10b981'] : ['#dc2626', '#d97706', '#16a34a', '#2563eb'];
    const counts = items.map((item) => tickets.filter((ticket) => (type === 'prioridad' ? ticket.prioridad === item : ticket.estado === item)).length);
    const total = Math.max(counts.reduce((sum, count) => sum + count, 0), 1);
    let start = -Math.PI / 2;
    for (let index = 0; index < items.length; index += 1) {
      const count = counts[index];
      const angle = (count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();
      start += angle;
    }
    ctx.font = '12px sans-serif';
    items.forEach((item, index) => {
      ctx.fillStyle = colors[index];
      ctx.fillRect(cx - radius, cy + radius + 24 + index * 20, 12, 12);
      ctx.fillStyle = '#475569';
      const label = type === 'prioridad' ? item : statusLabel(item);
      ctx.fillText(`${label}: ${counts[index]}`, cx - radius + 18, cy + radius + 34 + index * 20);
    });
  }

  function downloadReportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const title = 'Reporte general de Mesa de Ayuda';
    const now = new Date().toLocaleString();
    const summary = buildReportSummary(tickets);
    const recommendations = buildReportRecommendations(tickets);

    doc.setFontSize(18);
    doc.text(title, 40, 50);
    doc.setFontSize(10);
    doc.text(`Fecha: ${now}`, 40, 70);
    doc.text(`Tickets totales: ${tickets.length}`, 40, 85);
    doc.text(`Abiertos: ${dashboard.abiertos}`, 40, 100);
    doc.text(`En progreso/pendientes: ${dashboard.enTrabajo}`, 40, 115);
    doc.text(`Resueltos: ${dashboard.resueltos}`, 40, 130);

    doc.setFontSize(12);
    doc.text('Resumen generado por IA', 40, 160);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(summary, 520);
    doc.text(summaryLines, 40, 176);

    let nextY = 176 + summaryLines.length * 14 + 20;
    doc.setFontSize(12);
    doc.text('Recomendaciones', 40, nextY);
    doc.setFontSize(10);
    nextY += 16;
    recommendations.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, 520);
      doc.text(lines, 40, nextY);
      nextY += lines.length * 14 + 4;
    });

    nextY += 20;
    doc.setFontSize(12);
    doc.text('Detalle de tickets', 40, nextY);
    nextY += 18;

    const headers = ['ID', 'Titulo', 'Categoria', 'Estado', 'Prioridad', 'Aula', 'Edificio', 'Usuario', 'Tecnico', 'Fecha'];
    const columnWidths = [50, 130, 60, 52, 50, 50, 50, 70, 70, 50];
    const startX = 40;
    const rowHeight = 14;
    const tableTop = nextY;

    function addTableHeader(y) {
      let x = startX;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      headers.forEach((header, index) => {
        doc.text(header, x, y);
        x += columnWidths[index];
      });
      doc.setFont('helvetica', 'normal');
    }

    function addTableRow(row, y) {
      let x = startX;
      row.forEach((cell, index) => {
        const lines = doc.splitTextToSize(String(cell || ''), columnWidths[index] - 4);
        doc.text(lines, x, y);
        x += columnWidths[index];
      });
    }

    addTableHeader(nextY);
    nextY += rowHeight;

    tickets.forEach((ticket, index) => {
      const row = [
        ticket.id,
        ticket.titulo,
        ticket.categoria,
        statusLabel(ticket.estado),
        ticket.prioridad,
        ticket.aula,
        ticket.edificio,
        ticket.usuario,
        ticket.tecnico,
        ticket.fecha,
      ];
      const rowLines = row.map((cell, colIndex) => doc.splitTextToSize(String(cell || ''), columnWidths[colIndex] - 4).length);
      const height = Math.max(...rowLines) * 10 + 4;
      if (nextY + height > 800) {
        doc.addPage();
        nextY = 40;
        addTableHeader(nextY);
        nextY += rowHeight;
      }
      addTableRow(row, nextY);
      nextY += height;
    });

    doc.save('reporte-mesa-ayuda.pdf');
  }

  async function syncTicketsToSheet(ticketList, options = {}) {
    if (!options.automatic && role !== 'jefe') {
      setSyncStatus('Permiso denegado: solo el rol Jefe puede sincronizar con Google Sheets.');
      return;
    }
    const unsyncedTickets = ticketList.filter((t) => !t.sincronizado);
    if (!unsyncedTickets.length) {
      setSyncStatus('No hay tickets pendientes de sincronizar.');
      return;
    }
    if (!options.automatic) {
      setSyncLoading(true);
      setSyncStatus('Sincronizando con Google Sheets...');
    }
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: unsyncedTickets }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al sincronizar tickets');
      setTickets((prev) => prev.map((ticket) => (unsyncedTickets.some((u) => u.id === ticket.id) ? { ...ticket, sincronizado: true } : ticket)));
      if (!options.automatic) setSyncStatus('Tickets sincronizados con Google Sheets.');
    } catch (error) {
      if (!options.automatic) setSyncStatus(`Error al sincronizar: ${error.message}`);
    } finally {
      if (!options.automatic) setSyncLoading(false);
    }
  }

  if (!role) {
    return (
      <div className="app-shell centered">
        <div className="role-select-card">
          <div className="role-select-header">
            <div className="role-badge">🎓</div>
            <span className="role-title">Universidad de Piura</span>
          </div>
          <h1>Mesa de Ayuda Conversacional</h1>
          <p>Solo existen los roles Usuario Final, Técnico y Jefe.</p>
        </div>

        {loginRole ? (
          <div className="login-card">
            <h2>Acceso para {ROLES[loginRole].label}</h2>
            <p>Ingresa tu correo y contraseña institucional.</p>
            <label>Correo institucional</label>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="usuario@udep.pe" />
            <label>Contraseña</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Contraseña" />
            {authError && <div className="auth-error">{authError}</div>}
            <div className="login-actions">
              <button type="button" className="primary-button" onClick={handleLoginSubmit} disabled={loading}>Ingresar</button>
              <button type="button" className="secondary-button" onClick={() => { setLoginRole(null); setAuthError(''); }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="role-grid">
            {Object.entries(ROLES).map(([key, r]) => (
              <button key={key} type="button" className="role-card" onClick={() => startLogin(key)}>
                <div className="role-card-icon">{r.icon}</div>
                <div className="role-card-label">{r.label}</div>
                <div className="role-card-subtitle">{r.subtitle}</div>
                <div className="role-card-tools">
                  {r.tools.slice(0, 3).map((tool) => <span key={tool} className="tool-chip">{TOOLS_META[tool]?.label}</span>)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <div className="brand-icon">🎓</div>
          <div>
            <div className="brand-name">UDEP · Mesa de Ayuda</div>
            <div className="brand-subtitle">{currentUser?.email}</div>
          </div>
        </div>
        <div className="role-pill">
          <span className="role-pill-badge">{roleData.icon} {roleData.label}</span>
          <button className="text-button" type="button" onClick={() => { setRole(null); setCurrentUser(null); setPanel(null); }}>Cambiar rol</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <p className="sidebar-title">Herramientas</p>
          {roleData.tools.map((tool) => {
            const meta = TOOLS_META[tool];
            const active = panel === tool;
            return (
              <button key={tool} type="button" className={`tool-button ${active ? 'active' : ''}`} onClick={() => setPanel(active ? null : tool)}>
                <span className="tool-icon">{meta?.icon}</span>
                <div>
                  <div className="tool-label">{meta?.label}</div>
                  <div className="tool-desc">{meta?.desc}</div>
                </div>
              </button>
            );
          })}
        </aside>

        <main className="main-area">
          {panel && (
            <section className="panel-card">
              <div className="panel-header">
                <span className="panel-title">{TOOLS_META[panel]?.icon} {TOOLS_META[panel]?.label}</span>
                <button className="text-button" type="button" onClick={() => setPanel(null)}>✕</button>
              </div>

              {['mis_tickets', 'tickets_asignados', 'pendientes', 'todos_tickets'].includes(panel) && (
                <TicketTable
                  tickets={panel === 'pendientes' ? visibleTickets.filter((t) => t.estado !== 'resuelto') : visibleTickets}
                  role={role}
                  onPng={createTicketPng}
                  onCsv={downloadTicketsCsv}
                />
              )}

              {panel === 'dashboard' && <Dashboard dashboard={dashboard} tickets={tickets} />}
              {panel === 'asignar_tecnico' && <HelpText text="Usa el chat: asignar TKT-001 a tecnico@udep.pe" />}
              {panel === 'sincronizar_sheets' && (
                <PanelAction
                  text={syncStatus || 'Sincroniza todos los tickets no sincronizados con Google Sheets.'}
                  button={syncLoading ? 'Sincronizando...' : 'Sincronizar'}
                  onClick={() => syncTicketsToSheet(tickets)}
                  disabled={syncLoading || !tickets.some((ticket) => !ticket.sincronizado)}
                />
              )}
              {panel === 'base_conocimiento' && <KnowledgeBase />}
            </section>
          )}

          <section className="chat-section">
            <div className="chat-body">
              {messages.map((message, index) => (
                <div key={index} className={`chat-row ${message.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                  {message.role === 'assistant' && <div className="chat-avatar">🤖</div>}
                  <div className={`chat-bubble ${message.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>{message.text}</div>
                </div>
              ))}
              {loading && (
                <div className="chat-row chat-assistant">
                  <div className="chat-avatar">🤖</div>
                  <div className="chat-bubble assistant-bubble"><TypingDots /></div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {messages.length <= 1 && (
              <div className="suggested-prompts">
                {(role === 'usuario'
                  ? ['Reportar incidencia', 'Mis tickets', 'Recomendación para WiFi']
                  : role === 'tecnico'
                    ? ['Tickets asignados', 'Pendientes', 'estado TKT-001 a en_proceso']
                    : ['Dashboard', 'Todos los tickets', 'asignar TKT-001 a tecnico@udep.pe']
                ).map((prompt) => (
                  <button key={prompt} type="button" className="prompt-chip" onClick={() => setInput(prompt)}>{prompt}</button>
                ))}
              </div>
            )}

            <div className="chat-input-row">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={`Escribe una tarea de mesa de ayuda... (${roleData.label})`} />
              <button type="button" className="primary-button" onClick={sendMessage} disabled={!input.trim() || loading}>Enviar</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function getVisibleTickets(tickets, role, currentUser) {
  if (!currentUser || !ALLOWED_ROLES.includes(role)) return [];
  if (role === 'usuario') return tickets.filter((ticket) => ticket.usuarioId === currentUser.id);
  if (role === 'tecnico') return tickets.filter((ticket) => ticket.tecnicoId === currentUser.id);
  if (role === 'jefe') return tickets;
  return [];
}

function getImplicitTicketId(ticketList, text) {
  if (!ticketList.length) return '';
  if (ticketList.length === 1) return ticketList[0].id;

  const q = lower(text);
  if (['mi ticket', 'el ticket', 'este ticket', 'ese ticket', 'ultimo ticket', 'último ticket', 'reciente'].some((phrase) => q.includes(phrase))) {
    return ticketList[0].id;
  }

  return '';
}

function extractTicketData(text) {
  const raw = normalize(text);
  const q = lower(raw);
  const category = inferCategory(raw);
  const aula = inferAula(raw);
  const edificio = inferEdificio(raw);
  const priority = inferPriority(raw);
  const title = buildTicketTitle({ categoria: category, descripcion: raw, aula });

  return {
    titulo: title,
    categoria: category,
    descripcion: raw,
    prioridad: priority,
    aula,
    edificio,
    estado: q.includes('resuelto') ? 'resuelto' : '',
  };
}

function inferCategory(text) {
  const q = lower(text);
  const match = KNOWLEDGE_BASE.find((item) => item.keywords.some((keyword) => q.includes(keyword)));
  if (match) return match.category;
  if (['laptop', 'pc', 'computadora', 'equipo', 'impresora', 'teclado', 'mouse', 'proyector', 'pantalla', 'hdmi', 'cable', 'adaptador', 'audio', 'parlante', 'microfono', 'micrófono', 'camara', 'cámara'].some((word) => q.includes(word))) return 'Hardware';
  if (['software', 'programa', 'aplicacion', 'aplicación', 'sistema', 'moodle', 'aula virtual', 'campus virtual', 'zoom', 'teams', 'office', 'excel', 'word', 'navegador', 'licencia'].some((word) => q.includes(word))) return 'Software';
  if (['usuario', 'permiso', 'acceso', 'cuenta', 'contraseña', 'password', 'clave', 'correo', 'bloqueada', 'login', 'inicio de sesion', 'inicio de sesión'].some((word) => q.includes(word))) return 'Accesos';
  if (['wifi', 'wi-fi', 'internet', 'red', 'conexion', 'conexión', 'vpn', 'dns', 'cable de red', 'ethernet', 'sin señal'].some((word) => q.includes(word))) return 'Red';
  return 'Otro';
}

function inferAula(text) {
  const q = normalize(text).replace(/\s+/g, ' ');
  const aulaMatch = q.match(/\b(aula|salon|salón|laboratorio|lab|oficina|ambiente)\s+([a-z0-9-]+(?:\s+[a-z0-9-]+)?)/i);
  if (aulaMatch) return `${capitalize(aulaMatch[1])} ${aulaMatch[2].toUpperCase()}`;
  const simpleRoomMatch = q.match(/\b([A-Z]?\d{2,3}[A-Z]?|[A-Z]-\d{2,3})\b/);
  return simpleRoomMatch ? `Aula ${simpleRoomMatch[1]}` : '';
}

function inferEdificio(text) {
  const q = normalize(text).replace(/\s+/g, ' ');
  const explicit = q.match(/\b(edificio|bloque|pabellon|pabellón)\s+([a-z0-9-]+(?:\s+[a-z0-9-]+)?)/i);
  if (explicit) return `${capitalize(explicit[1])} ${explicit[2].toUpperCase()}`;
  const block = q.match(/\b(?:bloque)\s*([a-z])\b/i);
  return block ? `Bloque ${block[1].toUpperCase()}` : '';
}

function inferPriority(text) {
  const q = lower(text);
  const explicit = normalizePriority(q);
  if (explicit) return explicit;
  if (['urgente', 'critico', 'crítico', 'grave', 'no hay internet', 'sin internet', 'sin red', 'toda el aula', 'toda la aula', 'toda la clase', 'todos los alumnos', 'varios usuarios', 'clase en curso', 'examen', 'evaluacion', 'evaluación', 'sustentacion', 'sustentación', 'laboratorio completo', 'servicio caido', 'servicio caído', 'caido', 'caído', 'paralizado'].some((word) => q.includes(word))) return 'alta';
  if (['no puedo', 'bloqueado', 'bloqueada', 'no funciona', 'falla', 'error', 'intermitente', 'lento', 'no carga', 'no conecta', 'sin acceso'].some((word) => q.includes(word))) return 'media';
  return 'baja';
}

function normalizePriority(text) {
  const q = lower(text);
  if (['alta', 'alto', 'urgente', 'critica', 'crítica', 'critico', 'crítico', 'grave'].some((word) => q.includes(word))) return 'alta';
  if (['media', 'medio', 'moderada', 'moderado', 'intermedia', 'intermedio'].some((word) => q.includes(word))) return 'media';
  if (['baja', 'bajo', 'menor', 'leve'].some((word) => q.includes(word))) return 'baja';
  return '';
}

function normalizeCategory(text) {
  const raw = normalize(text);
  const q = lower(raw);
  const direct = CATEGORIES.find((category) => lower(category) === q);
  if (direct) return direct;
  const inferred = inferCategory(raw);
  return inferred || '';
}

function normalizeTicketField(text) {
  const q = lower(text)
    .replace(/[¿?.,:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (['prioridad', 'urgencia', 'impacto', 'severidad'].some((word) => q.includes(word))) return 'prioridad';
  if (['categoria', 'categoría', 'tipo'].some((word) => q.includes(word))) return 'categoria';
  if (['descripcion', 'descripción', 'detalle', 'problema'].some((word) => q.includes(word))) return 'descripcion';
  if (['titulo', 'título', 'asunto'].some((word) => q.includes(word))) return 'titulo';
  if (['aula', 'salon', 'salón', 'laboratorio', 'lab', 'oficina', 'ambiente', 'lugar'].some((word) => q.includes(word))) return 'aula';
  if (['edificio', 'bloque', 'pabellon', 'pabellón'].some((word) => q.includes(word))) return 'edificio';
  return '';
}

function normalizeFieldValue(field, rawValue) {
  const value = normalize(rawValue).replace(/[.。]+$/, '').trim();
  if (field === 'prioridad') return normalizePriority(value);
  if (field === 'categoria') return normalizeCategory(value);
  if (field === 'aula') return inferAula(value) || capitalize(value);
  if (field === 'edificio') return inferEdificio(value) || capitalize(value);
  return value;
}

function parseTicketFieldUpdate(text, fallbackTicketId = '') {
  const ticketMatch = text.match(/\bTKT-\d+\b/i);
  const ticketId = ticketMatch?.[0]?.toUpperCase() || fallbackTicketId;
  if (!ticketId) return null;

  const directPriority = text.match(/\bTKT-\d+\b.*?(?:prioridad|urgencia|impacto|severidad)\s+(?:a|por|como|=)?\s*(alta|media|baja|urgente|critica|crítica|critico|crítico|grave|moderada|moderado|leve)\b/i);
  if (directPriority) {
    return { ticketId, field: 'prioridad', value: directPriority[1] };
  }

  const implicitPriority = fallbackTicketId && text.match(/(?:prioridad|urgencia|impacto|severidad)\s+(?:a|por|como|=)?\s*(alta|media|baja|urgente|critica|crítica|critico|crítico|grave|moderada|moderado|leve)\b/i);
  if (implicitPriority) {
    return { ticketId, field: 'prioridad', value: implicitPriority[1] };
  }

  if (!/(?:modificar|cambiar|actualizar|corregir|editar|poner|pon|subir|bajar|establecer)/i.test(text)) return null;

  const patterns = [
    /(?:modificar|cambiar|actualizar|corregir|editar|poner|pon|establecer)\s+(?:el|la)?\s*([a-záéíóúñ_ ]+?)\s+(?:del|de|en)?\s*(TKT-\d+)\s+(?:a|por|como|=)\s+(.+)/i,
    /(?:modificar|cambiar|actualizar|corregir|editar)\s+(TKT-\d+)\s+([a-záéíóúñ_ ]+?)\s+(?:a|por|como|=)\s+(.+)/i,
    /(?:modificar|cambiar|actualizar|corregir|editar|poner|pon|establecer)\s+(?:el|la)?\s*([a-záéíóúñ_ ]+?)\s+(?:a|por|como|=)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const firstTicketIndex = match.findIndex((part) => /^TKT-\d+$/i.test(part || ''));
    const rawField = firstTicketIndex === 1 ? match[2] : match[1];
    const rawValue = firstTicketIndex === 1 || firstTicketIndex === 2 ? match[3] : match[2];
    const field = normalizeTicketField(rawField || 'prioridad');
    if (!field || !TICKET_FIELDS.includes(field)) continue;
    return { ticketId, field, value: rawValue };
  }

  const field = normalizeTicketField(text);
  if (!field || !TICKET_FIELDS.includes(field)) return null;
  const afterTicket = ticketMatch ? text.slice(ticketMatch.index + ticketMatch[0].length) : text;
  const valueMatch = afterTicket.match(/(?:a|por|como|=)\s+(.+)/i);
  return valueMatch ? { ticketId, field, value: valueMatch[1] } : null;
}

function normalizeState(text) {
  const q = lower(text);
  if (['en progreso', 'en proceso', 'en atencion', 'en atención', 'atendiendo', 'iniciado'].some((state) => q.includes(state))) return 'en_proceso';
  if (q.includes('resuelto') || q.includes('cerrado') || q.includes('solucionado') || q.includes('atendido')) return 'resuelto';
  if (q.includes('pendiente')) return 'pendiente';
  if (q.includes('abierto')) return 'abierto';
  return q.replace(/\s+/g, '_');
}

function buildTicketTitle(data) {
  const category = data.categoria || inferCategory(data.descripcion);
  const location = data.aula ? ` en ${data.aula}` : '';
  const q = lower(data.descripcion);
  if (category === 'Red') return `Problema de WiFi o conectividad${location}`;
  if (category === 'Accesos') return `Problema de acceso a cuenta o servicio${location}`;
  if (category === 'Hardware') {
    if (q.includes('proyector')) return `Problema con proyector${location}`;
    return `Problema de hardware${location}`;
  }
  if (category === 'Software') return `Problema de software o plataforma${location}`;
  return `Incidente de soporte TI${location}`;
}

function summarizeDescription(text) {
  const value = normalize(text);
  if (!value) return 'El usuario reportó un incidente de soporte TI sin mayor detalle.';
  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

function capitalize(text) {
  const value = normalize(text);
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '';
}

function buildDashboard(tickets) {
  const abiertos = tickets.filter((ticket) => ticket.estado === 'abierto').length;
  const enTrabajo = tickets.filter((ticket) => ['en_proceso', 'pendiente'].includes(ticket.estado)).length;
  const resueltos = tickets.filter((ticket) => ticket.estado === 'resuelto').length;
  const sinAsignar = tickets.filter((ticket) => !ticket.tecnicoId).length;
  return { total: tickets.length, abiertos, enTrabajo, resueltos, sinAsignar };
}

function dashboardText(dashboard) {
  return `Dashboard de Mesa de Ayuda:
Total: ${dashboard.total}
Abiertos: ${dashboard.abiertos}
En trabajo: ${dashboard.enTrabajo}
Resueltos: ${dashboard.resueltos}
Sin asignar: ${dashboard.sinAsignar}`;
}

function summarizeTickets(ticketList, title) {
  if (!ticketList.length) return `${title}: no hay tickets para mostrar.`;
  return `${title}:\n${ticketList.map((ticket) => `${ticket.id} | ${statusLabel(ticket.estado)} | ${ticket.prioridad} | ${ticket.titulo} | Técnico: ${ticket.tecnico}`).join('\n')}`;
}

function isTicketCreationIntent(q) {
  return ['reportar', 'crear ticket', 'nuevo ticket', 'incidencia', 'problema', 'falla', 'no puedo', 'no funciona'].some((word) => q.includes(word));
}

function isOutOfScope(q) {
  return ['chiste', 'poema', 'receta', 'pelicula', 'historia', 'cancion', 'canción'].some((word) => q.includes(word));
}

function outOfScopeMessage() {
  return 'No es mi función atender esa solicitud. Solo puedo responder tareas de Mesa de Ayuda: tickets, estados, asignaciones, reportes, dashboard, exportaciones y recomendaciones técnicas.';
}

function drawWrappedFields(ctx, ticket) {
  const fields = [
    ['Categoria', ticket.categoria],
    ['Estado', statusLabel(ticket.estado)],
    ['Prioridad', ticket.prioridad],
    ['Usuario', ticket.usuario],
    ['Tecnico', ticket.tecnico],
    ['Ubicacion', `${ticket.aula || 'No especificado'} / ${ticket.edificio || 'No especificado'}`],
    ['Fecha', ticket.fecha],
    ['Descripcion', ticket.descripcion],
  ];
  let y = 126;
  ctx.font = '16px sans-serif';
  fields.forEach(([label, value]) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${label}:`, 32, y);
    ctx.fillStyle = '#475569';
    const text = String(value || 'Sin dato');
    const words = text.split(' ');
    let line = '';
    words.forEach((word) => {
      const next = `${line}${word} `;
      if (ctx.measureText(next).width > 690) {
        ctx.fillText(line.trim(), 160, y);
        line = `${word} `;
        y += 24;
      } else {
        line = next;
      }
    });
    ctx.fillText(line.trim(), 160, y);
    y += 34;
  });
}

function drawTimeSeries(ctx, tickets, x, y, width, height) {
  ctx.fillStyle = '#0f172a';
  ctx.font = '17px sans-serif';
  ctx.fillText('Serie temporal por fecha', x, y - 24);
  const counts = tickets.reduce((acc, ticket) => {
    const key = ticket.fecha || 'Sin fecha';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const labels = Object.keys(counts).sort();
  const values = labels.map((label) => counts[label]);
  const max = Math.max(...values, 1);
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.stroke();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((value, index) => {
    const px = x + (labels.length <= 1 ? width / 2 : (index / (labels.length - 1)) * width);
    const py = y + height - (value / max) * (height - 24);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = '12px sans-serif';
  labels.slice(0, 6).forEach((label, index) => ctx.fillText(label, x + index * 90, y + height + 22));
}

  function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  }

  function TicketTable({ tickets, role, onPng, onCsv }) {
  return (
    <>
      <div className="ticket-actions-row">
        <button type="button" className="secondary-button" onClick={() => onCsv(tickets)} disabled={!tickets.length}>Exportar CSV</button>
      </div>
      <div className="ticket-table-wrapper">
        <table className="ticket-table">
          <thead>
            <tr>
              {['ID', 'Titulo', 'Categoria', 'Estado', 'Prioridad', 'Aula', 'Edificio', 'Usuario', 'Tecnico', 'Sync', 'Acciones'].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tickets.length ? tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="mono-cell">{ticket.id}</td>
                <td>
                  <div>{ticket.titulo}</div>
                  {ticket.descripcion && <div className="ticket-description">{ticket.descripcion.length > 80 ? `${ticket.descripcion.slice(0, 80)}...` : ticket.descripcion}</div>}
                </td>
                <td>{ticket.categoria}</td>
                <td><TicketBadge estado={ticket.estado} /></td>
                <td><PrioridadDot p={ticket.prioridad} /><span className="priority-label">{ticket.prioridad}</span></td>
                <td>{ticket.aula}</td>
                <td>{ticket.edificio}</td>
                <td>{ticket.usuario}</td>
                <td>{ticket.tecnico}</td>
                <td>{ticket.sincronizado ? 'Si' : 'No'}</td>
                <td><button type="button" className="secondary-button small-button" onClick={() => onPng(ticket)}>{role === 'usuario' ? 'Mi PNG' : 'PNG'}</button></td>
              </tr>
            )) : (
              <tr><td colSpan="11">No hay tickets disponibles para este rol.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dashboard({ dashboard, tickets }) {
  const temporalRef = useRef(null);
  const circularRef = useRef(null);

  useEffect(() => {
    const temporalCanvas = temporalRef.current;
    const circularCanvas = circularRef.current;
    if (temporalCanvas) {
      const ctx = temporalCanvas.getContext('2d');
      ctx.clearRect(0, 0, temporalCanvas.width, temporalCanvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, temporalCanvas.width, temporalCanvas.height);
      drawTimeSeries(ctx, tickets, 20, 40, temporalCanvas.width - 60, 180);
    }
    if (circularCanvas) {
      const ctx = circularCanvas.getContext('2d');
      ctx.clearRect(0, 0, circularCanvas.width, circularCanvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, circularCanvas.width, circularCanvas.height);
      drawCircularChart(ctx, tickets, circularCanvas.width / 2, 200, 110, 'estado');
    }
  }, [tickets]);

  const alerts = [];
  if (dashboard.abiertos > 3) {
    alerts.push(`Alerta: ${dashboard.abiertos} tickets aún están abiertos. Prioriza su atención.`);
  }
  if (dashboard.sinAsignar > 0) {
    alerts.push(`Alerta: ${dashboard.sinAsignar} ticket(s) sin asignar a técnico.`);
  }
  if (dashboard.total === 0) {
    alerts.push('No se han registrado tickets aún. El sistema está limpio.');
  }

  const cards = [
    ['Total', dashboard.total, '#2563eb'],
    ['Abiertos', dashboard.abiertos, '#dc2626'],
    ['En trabajo', dashboard.enTrabajo, '#d97706'],
    ['Resueltos', dashboard.resueltos, '#16a34a'],
    ['Sin asignar', dashboard.sinAsignar, '#7c3aed'],
  ];

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {cards.map(([label, value, color]) => (
          <div key={label} style={{ border: `1px solid ${color}`, borderRadius: 16, padding: 20, background: '#f8fafc' }}>
            <div style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 16, padding: 18 }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>Alertas</strong>
          {alerts.map((alert, index) => (
            <div key={index} style={{ color: '#334155', marginBottom: 6 }}>{alert}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '18px' }}>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 16, padding: 16, background: '#ffffff' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Evolución temporal</div>
          <canvas ref={temporalRef} width={660} height={260} style={{ width: '100%', borderRadius: 12, background: '#ffffff' }} />
        </div>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 16, padding: 16, background: '#ffffff' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Distribución por estado</div>
          <canvas ref={circularRef} width={320} height={280} style={{ width: '100%', borderRadius: 12, background: '#ffffff' }} />
        </div>
      </div>
    </div>
  );
}

function PanelAction({ text, button, onClick, disabled }) {
  return (
    <div className="report-card">
      <p>{text}</p>
      <button type="button" className="primary-button" onClick={onClick} disabled={disabled}>{button}</button>
    </div>
  );
}

function HelpText({ text }) {
  return <div className="placeholder-panel"><div className="placeholder-title">{text}</div></div>;
}

function KnowledgeBase() {
  return (
    <div>
      {KNOWLEDGE_BASE.map((item) => (
        <div key={item.text} className="kb-card">
          <div className="kb-card-header"><span>{item.keywords.join(', ')}</span></div>
          <div className="kb-body">{item.text}</div>
        </div>
      ))}
    </div>
  );
}
