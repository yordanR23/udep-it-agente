import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';

const STORAGE_KEY = 'udep_helpdesk_tickets_v2';
const CLEAN_BOOT_KEY = 'udep_helpdesk_clean_boot_v2';
const ALLOWED_ROLES = ['usuario', 'tecnico', 'jefe'];

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
    tools: ['todos_tickets', 'dashboard', 'reportes', 'graficos', 'asignar_tecnico', 'sincronizar_sheets'],
    welcome: 'Panel de jefatura activo. Puedes consultar todos los tickets, ver indicadores, generar reportes PDF/PNG, asignar técnicos y sincronizar con Google Sheets.',
  },
};

const TOOLS_META = {
  mis_tickets: { icon: '📋', label: 'Mis tickets', desc: 'Tickets reportados' },
  tickets_asignados: { icon: '🧰', label: 'Asignados', desc: 'Solo mis tickets' },
  pendientes: { icon: '⏱️', label: 'Pendientes', desc: 'Abiertos o en proceso' },
  todos_tickets: { icon: '📚', label: 'Todos los tickets', desc: 'Vista global' },
  dashboard: { icon: '📊', label: 'Dashboard', desc: 'Indicadores clave' },
  reportes: { icon: '📄', label: 'Reportes PDF', desc: 'Reporte general' },
  graficos: { icon: '🥧', label: 'Gráficos', desc: 'Temporal y circular' },
  asignar_tecnico: { icon: '👥', label: 'Asignar técnico', desc: 'Asignación manual' },
  sincronizar_sheets: { icon: '🔄', label: 'Google Sheets', desc: 'Sincronizar datos' },
  base_conocimiento: { icon: '💡', label: 'Recomendaciones', desc: 'Ayuda rápida' },
};

const KNOWLEDGE_BASE = [
  { keywords: ['wifi', 'red', 'internet'], text: 'Prueba olvidar la red, conectarte a UDEP-Seguro, validar usuario institucional y reiniciar el adaptador WiFi.' },
  { keywords: ['moodle', 'aula virtual'], text: 'Limpia caché del navegador, prueba modo incógnito y confirma que puedes ingresar al correo institucional.' },
  { keywords: ['contraseña', 'password', 'clave'], text: 'Usa el portal institucional de recuperación. Si no tienes correo alterno, el ticket debe quedar en prioridad media o alta.' },
  { keywords: ['proyector', 'pantalla', 'hdmi'], text: 'Verifica fuente de entrada, cable HDMI y reinicio del proyector antes de escalar a hardware.' },
];

const TICKET_FIELDS = ['titulo', 'categoria', 'descripcion', 'prioridad', 'aula', 'edificio'];
const STATES = ['abierto', 'en_proceso', 'resuelto', 'pendiente'];
const CATEGORIES = ['Red', 'Hardware', 'Software', 'Accesos', 'Otro'];

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
    return match ? `\n\nRecomendación inicial: ${match.text}` : '';
  }

  function startTicketConversation(seedText) {
    const initial = { titulo: '', categoria: '', descripcion: seedText || '', prioridad: '', aula: '', edificio: '' };
    setDraft({ data: initial, step: initial.descripcion ? 'categoria' : 'descripcion' });
    return initial.descripcion
      ? `Crearé un ticket vinculado a ${currentUser.email}. Indica la categoría: Red, Hardware, Software, Accesos u Otro.${getRecommendation(seedText)}`
      : 'Crearé un ticket nuevo por chat. Describe el incidente con el mayor detalle posible.';
  }

  function continueTicketConversation(text) {
    if (!draft) return null;
    const data = { ...draft.data };
    const answer = normalize(text);

    if (draft.step === 'descripcion') {
      data.descripcion = answer;
      setDraft({ data, step: 'categoria' });
      return `Descripción registrada. Indica la categoría: ${CATEGORIES.join(', ')}.${getRecommendation(answer)}`;
    }

    if (draft.step === 'categoria') {
      const category = CATEGORIES.find((c) => lower(c) === lower(answer)) || CATEGORIES.find((c) => lower(answer).includes(lower(c)));
      data.categoria = category || 'Otro';
      setDraft({ data, step: 'prioridad' });
      return 'Categoría registrada. Indica la prioridad: baja, media o alta.';
    }

    if (draft.step === 'prioridad') {
      const priority = ['baja', 'media', 'alta'].find((p) => lower(answer).includes(p)) || 'media';
      data.prioridad = priority;
      setDraft({ data, step: 'ubicacion' });
      return 'Prioridad registrada. Indica aula/lugar y edificio. Ejemplo: Lab B-201, Bloque B.';
    }

    if (draft.step === 'ubicacion') {
      const [aula, edificio] = answer.split(',').map((p) => normalize(p));
      data.aula = aula || 'No especificado';
      data.edificio = edificio || 'No especificado';
      data.titulo = data.descripcion.slice(0, 72) || 'Incidente reportado por chat';
      const today = new Date().toISOString().slice(0, 10);
      const createdTicket = {
        id: makeTicketId(tickets.length),
        ...data,
        estado: 'abierto',
        usuarioId: currentUser.id,
        usuario: currentUser.email,
        tecnicoId: '',
        tecnico: 'Sin asignar',
        comentarios: [],
        fecha: today,
        fechaModificacion: today,
        sincronizado: false,
      };
      addTicket(createdTicket);
      setDraft(null);
      return `Ticket ${createdTicket.id} creado y vinculado a ${currentUser.email}. Ya aparece en "Mis tickets".`;
    }

    return null;
  }

  function handleUsuarioCommand(text) {
    const q = lower(text);
    const ownTickets = getVisibleTickets(tickets, 'usuario', currentUser);

    if (isTicketCreationIntent(q)) return startTicketConversation(text);

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

    const modifyMatch = text.match(/(?:modificar|cambiar|actualizar)\s+(TKT-\d+)\s+([a-záéíóúñ_ ]+?)\s+(?:a|por|=)\s+(.+)/i);
    if (modifyMatch) {
      const [, rawId, rawField, rawValue] = modifyMatch;
      const ticketId = rawId.toUpperCase();
      const field = normalize(rawField).toLowerCase().replace('urgencia', 'prioridad');
      const ticket = ownTickets.find((t) => t.id === ticketId);
      if (!ticket) return 'No puedo modificar ese ticket porque no pertenece a tu usuario o no existe.';
      if (!TICKET_FIELDS.includes(field)) return `Solo puedes modificar estos campos: ${TICKET_FIELDS.join(', ')}.`;
      updateTicket(ticketId, (t) => ({ ...t, [field]: normalize(rawValue), fechaModificacion: new Date().toISOString().slice(0, 10), sincronizado: false }));
      return `Ticket ${ticketId} actualizado: ${field} = ${normalize(rawValue)}.`;
    }

    if (q.includes('recomend')) return getRecommendation(q).replace('\n\n', '') || 'Describe el problema técnico para darte una recomendación inicial.';
    if (isOutOfScope(q)) return outOfScopeMessage();
    return 'Puedo ayudarte con tareas de mesa de ayuda: crear tickets, ver tus tickets, modificar un campo, eliminar un ticket propio o dar recomendaciones técnicas.';
  }

  function handleTecnicoCommand(text) {
    const q = lower(text);
    const assigned = getVisibleTickets(tickets, 'tecnico', currentUser);

    if (q.includes('pendientes')) return summarizeTickets(assigned.filter((t) => t.estado !== 'resuelto'), 'Tus tickets pendientes');
    if (q.includes('tickets') || q.includes('asignados')) return summarizeTickets(assigned, 'Tus tickets asignados');

    const stateMatch = text.match(/(?:estado|cambiar)\s+(TKT-\d+)\s+(?:a\s+)?([a-z_ ]+)/i);
    if (stateMatch) {
      const ticketId = stateMatch[1].toUpperCase();
      const estado = lower(stateMatch[2]).replace('en progreso', 'en_proceso').replace('en proceso', 'en_proceso').replace(/\s+/g, '_');
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

    if (isOutOfScope(q)) return outOfScopeMessage();
    return 'Como técnico solo puedo mostrar tus tickets asignados, listar pendientes, agregar comentarios o cambiar estados.';
  }

  function handleJefeCommand(text) {
    const q = lower(text);

    if (q.includes('dashboard') || q.includes('indicadores')) return dashboardText(dashboard);
    if (q.includes('todos') || q.includes('tickets')) return summarizeTickets(tickets, 'Todos los tickets del sistema');
    if (q.includes('pdf') || q.includes('reporte')) {
      downloadReportPdf();
      return 'Reporte general PDF generado.';
    }
    if (q.includes('png') || q.includes('imagen') || q.includes('grafico') || q.includes('gráfico')) {
      downloadChartsPng();
      return 'Resumen gráfico PNG generado con serie temporal y gráfico circular.';
    }
    if (q.includes('sincron')) {
      syncTicketsToSheet(tickets);
      return 'Sincronización con Google Sheets iniciada.';
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

    if (isOutOfScope(q)) return outOfScopeMessage();
    return 'Como jefe puedo ver todos los tickets, dashboard, reportes PDF, gráficos PNG, asignar técnicos y sincronizar con Google Sheets.';
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
      appendAssistant(reply || outOfScopeMessage());
    } finally {
      setLoading(false);
    }
  }

  function buildCsvText(ticketsToExport) {
    const header = ['ID', 'Titulo', 'Categoria', 'Estado', 'Prioridad', 'Usuario', 'Tecnico', 'Fecha', 'Descripcion'];
    const rows = ticketsToExport.map((ticket) => [ticket.id, ticket.titulo, ticket.categoria, ticket.estado, ticket.prioridad, ticket.usuario, ticket.tecnico, ticket.fecha, ticket.descripcion]);
    return [header, ...rows].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
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
    drawPie(ctx, tickets, 760, 205, 115);
    downloadCanvas(canvas, 'resumen-tickets.png');
  }

  function downloadReportPdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFontSize(18);
    doc.text('Reporte general de Mesa de Ayuda', 40, 50);
    doc.setFontSize(11);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 40, 70);
    doc.text(`Total: ${tickets.length}`, 40, 100);
    doc.text(`Abiertos: ${dashboard.abiertos}`, 40, 118);
    doc.text(`En progreso/pendientes: ${dashboard.enTrabajo}`, 40, 136);
    doc.text(`Resueltos: ${dashboard.resueltos}`, 40, 154);
    let y = 190;
    tickets.slice(0, 18).forEach((ticket) => {
      doc.text(`${ticket.id} | ${statusLabel(ticket.estado)} | ${ticket.prioridad} | ${ticket.titulo}`, 40, y);
      y += 18;
    });
    doc.save('reporte-mesa-ayuda.pdf');
  }

  async function syncTicketsToSheet(ticketList) {
    if (role !== 'jefe') {
      setSyncStatus('Permiso denegado: solo el rol Jefe puede sincronizar con Google Sheets.');
      return;
    }
    const unsyncedTickets = ticketList.filter((t) => !t.sincronizado);
    if (!unsyncedTickets.length) {
      setSyncStatus('No hay tickets pendientes de sincronizar.');
      return;
    }
    setSyncLoading(true);
    setSyncStatus('Sincronizando con Google Sheets...');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets: unsyncedTickets }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al sincronizar tickets');
      setTickets((prev) => prev.map((ticket) => (unsyncedTickets.some((u) => u.id === ticket.id) ? { ...ticket, sincronizado: true } : ticket)));
      setSyncStatus('Tickets sincronizados con Google Sheets.');
    } catch (error) {
      setSyncStatus(`Error al sincronizar: ${error.message}`);
    } finally {
      setSyncLoading(false);
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

              {panel === 'dashboard' && <Dashboard dashboard={dashboard} />}
              {panel === 'reportes' && <PanelAction text="Genera un reporte general en PDF con todos los tickets." button="Descargar PDF" onClick={downloadReportPdf} disabled={!tickets.length} />}
              {panel === 'graficos' && <PanelAction text="Exporta un resumen PNG con serie temporal y gráfico circular." button="Descargar PNG" onClick={downloadChartsPng} disabled={!tickets.length} />}
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

function drawPie(ctx, tickets, cx, cy, radius) {
  ctx.fillStyle = '#0f172a';
  ctx.font = '17px sans-serif';
  ctx.fillText('Tickets por estado', cx - 80, cy - radius - 36);
  const colors = ['#dc2626', '#d97706', '#16a34a', '#2563eb'];
  const counts = STATES.map((state) => tickets.filter((ticket) => ticket.estado === state).length);
  const total = Math.max(counts.reduce((sum, count) => sum + count, 0), 1);
  let start = -Math.PI / 2;
  counts.forEach((count, index) => {
    const angle = (count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    start += angle;
  });
  ctx.font = '12px sans-serif';
  STATES.forEach((state, index) => {
    ctx.fillStyle = colors[index];
    ctx.fillRect(cx - 90, cy + radius + 28 + index * 20, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.fillText(`${statusLabel(state)}: ${counts[index]}`, cx - 70, cy + radius + 39 + index * 20);
  });
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
              {['ID', 'Titulo', 'Categoria', 'Estado', 'Prioridad', 'Usuario', 'Tecnico', 'Sync', 'Acciones'].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tickets.length ? tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="mono-cell">{ticket.id}</td>
                <td>{ticket.titulo}</td>
                <td>{ticket.categoria}</td>
                <td><TicketBadge estado={ticket.estado} /></td>
                <td><PrioridadDot p={ticket.prioridad} /><span className="priority-label">{ticket.prioridad}</span></td>
                <td>{ticket.usuario}</td>
                <td>{ticket.tecnico}</td>
                <td>{ticket.sincronizado ? 'Si' : 'No'}</td>
                <td><button type="button" className="secondary-button small-button" onClick={() => onPng(ticket)}>{role === 'usuario' ? 'Mi PNG' : 'PNG'}</button></td>
              </tr>
            )) : (
              <tr><td colSpan="9">No hay tickets disponibles para este rol.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dashboard({ dashboard }) {
  const cards = [
    ['Total', dashboard.total, '#2563eb'],
    ['Abiertos', dashboard.abiertos, '#dc2626'],
    ['En trabajo', dashboard.enTrabajo, '#d97706'],
    ['Resueltos', dashboard.resueltos, '#16a34a'],
    ['Sin asignar', dashboard.sinAsignar, '#7c3aed'],
  ];
  return (
    <div className="stats-grid">
      {cards.map(([label, value, color]) => (
        <div key={label} className="stats-card" style={{ borderColor: color }}>
          <div className="stats-label">{label}</div>
          <div className="stats-value" style={{ color }}>{value}</div>
        </div>
      ))}
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
