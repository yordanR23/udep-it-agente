import { useState, useRef, useEffect } from 'react';

const ROLES = {
  usuario: {
    label: 'Usuario Final',
    subtitle: 'Docente / Alumno / Administrativo',
    icon: '👤',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    tools: ['reportar_incidencia', 'consultar_estado', 'base_conocimiento', 'solicitar_acceso', 'buscar_web'],
    welcome: 'Hola, soy tu asistente de soporte TI de la UDEP. Puedo ayudarte a reportar incidencias, consultar el estado de tus tickets o resolver dudas técnicas.',
  },
  tecnico: {
    label: 'Técnico de Soporte',
    subtitle: 'Helpdesk / Soporte en campo',
    icon: '🔧',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    tools: ['ver_tickets', 'actualizar_ticket', 'diagnostico_red', 'buscar_usuario', 'base_conocimiento', 'buscar_web', 'escalar_ticket'],
    welcome: 'Panel técnico activo. Tienes acceso a la cola de incidencias, herramientas de diagnóstico y búsqueda de usuarios.',
  },
  admin: {
    label: 'Administrador de Sistemas',
    subtitle: 'Infraestructura y servidores',
    icon: '⚙️',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    tools: ['ver_tickets', 'actualizar_ticket', 'diagnostico_red', 'gestionar_usuarios', 'reportes', 'base_conocimiento', 'buscar_web', 'escalar_ticket', 'logs_sistema', 'inventario'],
    welcome: 'Modo administrador. Acceso completo a diagnósticos de red, gestión de usuarios, logs y reportes del sistema.',
  },
  jefe: {
    label: 'Jefe / Coordinador TI',
    subtitle: 'Gestión y supervisión',
    icon: '📊',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    tools: ['dashboard', 'reportes', 'ver_tickets', 'gestionar_usuarios', 'inventario', 'buscar_web', 'estadisticas', 'asignar_tecnico'],
    welcome: 'Panel de coordinación. Acceso a dashboard ejecutivo, reportes de rendimiento, estadísticas y asignación de recursos.',
  },
};

const TOOLS_META = {
  reportar_incidencia: { icon: '🚨', label: 'Reportar incidencia', desc: 'Crear nuevo ticket' },
  consultar_estado: { icon: '🔍', label: 'Consultar estado', desc: 'Ver mis tickets' },
  base_conocimiento: { icon: '📚', label: 'Base de conocimiento', desc: 'Guías y soluciones' },
  solicitar_acceso: { icon: '🔑', label: 'Solicitar acceso', desc: 'Credenciales y permisos' },
  buscar_web: { icon: '🌐', label: 'Búsqueda web', desc: 'Documentación externa' },
  ver_tickets: { icon: '📋', label: 'Cola de tickets', desc: 'Todas las incidencias' },
  actualizar_ticket: { icon: '✏️', label: 'Actualizar ticket', desc: 'Modificar estado' },
  diagnostico_red: { icon: '📡', label: 'Diagnóstico de red', desc: 'Análisis conectividad' },
  buscar_usuario: { icon: '👥', label: 'Buscar usuario', desc: 'Directorio UDEP' },
  escalar_ticket: { icon: '⬆️', label: 'Escalar ticket', desc: 'Subir prioridad' },
  gestionar_usuarios: { icon: '🛡️', label: 'Gestionar usuarios', desc: 'Cuentas y accesos' },
  reportes: { icon: '📈', label: 'Reportes', desc: 'Informes del área' },
  logs_sistema: { icon: '🖥️', label: 'Logs del sistema', desc: 'Eventos y errores' },
  inventario: { icon: '🗃️', label: 'Inventario', desc: 'Equipos y activos' },
  dashboard: { icon: '📊', label: 'Dashboard', desc: 'Vista ejecutiva' },
  estadisticas: { icon: '📉', label: 'Estadísticas', desc: 'KPIs del área' },
  asignar_tecnico: { icon: '👨‍💼', label: 'Asignar técnico', desc: 'Distribuir carga' },
};

const DEFAULT_TICKETS = [
  { id: 'TKT-001', titulo: 'Sin acceso a WiFi en Lab B-201', estado: 'abierto', prioridad: 'alta', usuario: 'a.garcia@udep.pe', tecnico: '—', categoria: 'Red', fecha: '2025-05-30' },
  { id: 'TKT-002', titulo: 'Proyector dañado en aula 3F', estado: 'en_proceso', prioridad: 'media', usuario: 'j.lopez@udep.pe', tecnico: 'M. Torres', categoria: 'Hardware', fecha: '2025-05-29' },
  { id: 'TKT-003', titulo: 'Contraseña de correo institucional bloqueada', estado: 'resuelto', prioridad: 'media', usuario: 'c.ruiz@udep.pe', tecnico: 'L. Soto', categoria: 'Accesos', fecha: '2025-05-28' },
  { id: 'TKT-004', titulo: 'No carga el aula virtual (Moodle)', estado: 'abierto', prioridad: 'alta', usuario: 'm.flores@udep.pe', tecnico: '—', categoria: 'Software', fecha: '2025-05-31' },
  { id: 'TKT-005', titulo: 'Solicitud cuenta VPN para trabajo remoto', estado: 'pendiente', prioridad: 'baja', usuario: 'r.santos@udep.pe', tecnico: 'L. Soto', categoria: 'Accesos', fecha: '2025-05-27' },
];

const KNOWLEDGE_BASE = [
  { titulo: 'Cómo conectarse al WiFi institucional UDEP', cat: 'Red', pasos: '1. Selecciona \'UDEP-Seguro\'\n2. Ingresa tu código de estudiante/empleado\n3. Contraseña: igual que tu correo institucional\n4. Acepta el certificado de seguridad' },
  { titulo: 'Resetear contraseña del correo institucional', cat: 'Accesos', pasos: '1. Visita portal.udep.pe/reset\n2. Ingresa tu DNI\n3. Recibirás un enlace a tu correo alternativo\n4. Si no tienes acceso, acércate a TI con tu DNI' },
  { titulo: 'Acceso a Moodle (Aula Virtual)', cat: 'Software', pasos: '1. Ingresa a aulavirtual.udep.pe\n2. Usuario: código institucional\n3. Contraseña: misma que el correo\n4. Si falla, limpiar caché del navegador (Ctrl+Shift+Del)' },
  { titulo: 'Solicitar instalación de software', cat: 'Software', pasos: '1. Reportar incidencia con categoría \'Software\'\n2. Especificar nombre del programa y justificación\n3. Requiere aprobación de jefe de área\n4. Tiempo estimado: 2-3 días hábiles' },
];

const STATS = [
  { label: 'Tickets abiertos', value: '12', trend: '+3 hoy', color: '#ef4444' },
  { label: 'En proceso', value: '8', trend: '=', color: '#f59e0b' },
  { label: 'Resueltos hoy', value: '5', trend: '+5', color: '#10b981' },
  { label: 'Tiempo prom.', value: '2.4h', trend: '-0.3h', color: '#6366f1' },
];

const systemPrompts = {
  usuario: `Eres un asistente de soporte TI de la Universidad de Piura (UDEP). Hablas con un USUARIO FINAL (docente, alumno o administrativo).\nTu tono es amable, claro y sin tecnicismos.\nHerramientas disponibles: reportar incidencias, consultar estado de tickets, base de conocimiento, solicitar accesos.\nCuando el usuario reporte un problema, estructura la información: categoría (Red/Hardware/Software/Accesos), descripción, urgencia.\nSi no puedes resolver algo, indícale que escalarás el ticket a un técnico.\nResponde siempre en español. Sé conciso (máx 3-4 párrafos).`,
  tecnico: `Eres un asistente de soporte TI de la UDEP para un TÉCNICO DE HELPDESK.\nTu tono es técnico pero directo. Ayudas a gestionar la cola de tickets, diagnosticar problemas de red y consultar usuarios.\nHerramientas: ver y actualizar tickets, diagnóstico de red, buscar usuarios en directorio, escalar tickets, base de conocimiento.\nCuando analices un ticket, sugiere pasos concretos de diagnóstico y posibles soluciones.\nResponde siempre en español. Incluye comandos o pasos técnicos cuando sea relevante.`,
  admin: `Eres un asistente TI de la UDEP para un ADMINISTRADOR DE SISTEMAS.\nTienes acceso completo: tickets, diagnóstico avanzado de red, gestión de usuarios/cuentas, logs del sistema, inventario.\nTu tono es técnico y preciso. Proporciona información detallada de infraestructura cuando se requiera.\nCuando analices logs o diagnostiques red, sé específico con IPs, protocolos, tiempos de respuesta.\nResponde siempre en español. Usa terminología técnica apropiada.`,
  jefe: `Eres un asistente TI de la UDEP para el JEFE/COORDINADOR del área de TI.\nTu tono es ejecutivo y orientado a métricas. Tienes acceso a dashboard, reportes, estadísticas y asignación de técnicos.\nCuando presentes datos, resume los KPIs más importantes. Destaca tendencias y problemas críticos.\nHerramientas: dashboard ejecutivo, reportes de rendimiento, estadísticas, asignación de recursos, inventario.\nResponde siempre en español. Sé conciso y orientado a decisiones.`,
};

function TypingDots() {
  return (
    <span className="typing-dots">
      {[0, 1, 2].map((i) => (
        <span key={i} />
      ))}
    </span>
  );
}

function TicketBadge({ estado }) {
  const map = {
    abierto: { bg: '#fef2f2', color: '#dc2626', label: 'Abierto' },
    en_proceso: { bg: '#fffbeb', color: '#d97706', label: 'En proceso' },
    resuelto: { bg: '#f0fdf4', color: '#16a34a', label: 'Resuelto' },
    pendiente: { bg: '#f0f9ff', color: '#0284c7', label: 'Pendiente' },
  };
  const s = map[estado] || map.abierto;
  return <span className="ticket-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
}

function PrioridadDot({ p }) {
  const c = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
  return <span className="prioridad-dot" style={{ background: c[p] || '#94a3b8' }} />;
}

export default function App() {
  const [role, setRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null);
  const [reportForm, setReportForm] = useState({ titulo: '', categoria: 'Red', descripcion: '', urgencia: 'media' });
  const [reportSent, setReportSent] = useState(false);
  const [kbSearch, setKbSearch] = useState('');
  const [kbOpen, setKbOpen] = useState(null);
  const [tickets, setTickets] = useState(() => {
    const saved = localStorage.getItem('udep_tickets');
    return saved ? JSON.parse(saved) : DEFAULT_TICKETS;
  });
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('udep_tickets', JSON.stringify(tickets));
  }, [tickets]);

  function selectRole(r) {
    setRole(r);
    setMessages([{ role: 'assistant', text: ROLES[r].welcome }]);
    setPanel(null);
  }

  async function callAgent(messages) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Error en la API');
    }
    return data.content;
  }

  async function sendMessage() {
    if (!input.trim() || loading || !role) return;
    const userMsg = { role: 'user', text: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = [
        { role: 'system', text: systemPrompts[role] },
        ...newMsgs,
      ];
      const reply = await callAgent(apiMessages);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', text: `Error: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function submitReport() {
    const newId = `TKT-${String(tickets.length + 1).padStart(3, '0')}`;
    const createdTicket = {
      id: newId,
      titulo: reportForm.titulo,
      estado: 'abierto',
      prioridad: reportForm.urgencia,
      usuario: 'cliente.udep@udep.pe',
      tecnico: '—',
      categoria: reportForm.categoria,
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: reportForm.descripcion,
    };
    setTickets((prev) => [createdTicket, ...prev]);
    setReportSent(newId);
    setTimeout(() => {
      setReportSent(false);
      setReportForm({ titulo: '', categoria: 'Red', descripcion: '', urgencia: 'media' });
      setPanel(null);
    }, 3000);
  }

  const roleData = role ? ROLES[role] : null;
  const filteredKB = KNOWLEDGE_BASE.filter((k) => k.titulo.toLowerCase().includes(kbSearch.toLowerCase()) || k.cat.toLowerCase().includes(kbSearch.toLowerCase()));

  if (!role) {
    return (
      <div className="app-shell centered">
        <div className="role-select-card">
          <div className="role-select-header">
            <div className="role-badge">🎓</div>
            <span className="role-title">Universidad de Piura</span>
          </div>
          <h1>Agente de Soporte TI</h1>
          <p>Selecciona tu rol para acceder a las herramientas correspondientes</p>
        </div>
        <div className="role-grid">
          {Object.entries(ROLES).map(([key, r]) => (
            <button key={key} type="button" className="role-card" onClick={() => selectRole(key)}>
              <div className="role-card-icon">{r.icon}</div>
              <div className="role-card-label">{r.label}</div>
              <div className="role-card-subtitle">{r.subtitle}</div>
              <div className="role-card-tools">
                {r.tools.slice(0, 3).map((t) => (
                  <span key={t} className="tool-chip">{TOOLS_META[t]?.label}</span>
                ))}
                {r.tools.length > 3 && <span className="tool-chip more">+{r.tools.length - 3} más</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <div className="brand-icon">🎓</div>
          <div>
            <div className="brand-name">UDEP · Soporte TI</div>
            <div className="brand-subtitle">Campus Piura</div>
          </div>
        </div>
        <div className="role-pill">
          <span className="role-pill-badge">{roleData.icon} {roleData.label}</span>
          <button className="text-button" type="button" onClick={() => setRole(null)}>Cambiar rol</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <p className="sidebar-title">Herramientas</p>
          {roleData.tools.map((t) => {
            const meta = TOOLS_META[t];
            const active = panel === t;
            return (
              <button key={t} type="button" className={`tool-button ${active ? 'active' : ''}`} onClick={() => setPanel(active ? null : t)}>
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

              {(panel === 'ver_tickets' || panel === 'consultar_estado') && (
                <div className="ticket-table-wrapper">
                  <table className="ticket-table">
                    <thead>
                      <tr>
                        {['ID', 'Título', 'Categoría', 'Estado', 'Prioridad', 'Técnico'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t.id}>
                          <td className="mono-cell">{t.id}</td>
                          <td>{t.titulo}</td>
                          <td>{t.categoria}</td>
                          <td><TicketBadge estado={t.estado} /></td>
                          <td><PrioridadDot p={t.prioridad} /><span className="priority-label">{t.prioridad}</span></td>
                          <td>{t.tecnico}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {panel === 'reportar_incidencia' && (
                reportSent ? (
                  <div className="success-panel">
                    <div className="success-icon">✅</div>
                    <div className="success-title">Ticket {reportSent} creado exitosamente</div>
                    <div className="success-text">Un técnico se comunicará contigo pronto.</div>
                  </div>
                ) : (
                  <div className="report-form-grid">
                    <div className="full-width">
                      <label>Título del problema *</label>
                      <input value={reportForm.titulo} onChange={(e) => setReportForm({ ...reportForm, titulo: e.target.value })} placeholder="Ej: Sin acceso a WiFi en Lab B-201" />
                    </div>
                    <div>
                      <label>Categoría</label>
                      <select value={reportForm.categoria} onChange={(e) => setReportForm({ ...reportForm, categoria: e.target.value })}>
                        {['Red', 'Hardware', 'Software', 'Accesos', 'Otro'].map((c) => (<option key={c}>{c}</option>))}
                      </select>
                    </div>
                    <div>
                      <label>Urgencia</label>
                      <select value={reportForm.urgencia} onChange={(e) => setReportForm({ ...reportForm, urgencia: e.target.value })}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                    <div className="full-width">
                      <label>Descripción</label>
                      <textarea value={reportForm.descripcion} onChange={(e) => setReportForm({ ...reportForm, descripcion: e.target.value })} rows={4} placeholder="Describe el problema con detalle..." />
                    </div>
                    <div className="full-width">
                      <button type="button" className="primary-button" onClick={submitReport} disabled={!reportForm.titulo}>Crear ticket</button>
                    </div>
                  </div>
                )
              )}

              {panel === 'base_conocimiento' && (
                <div>
                  <input value={kbSearch} onChange={(e) => setKbSearch(e.target.value)} placeholder="Buscar en guías..." className="kb-search" />
                  {filteredKB.map((k, i) => (
                    <div key={i} className="kb-card">
                      <button className="kb-card-header" type="button" onClick={() => setKbOpen(kbOpen === i ? null : i)}>
                        <span>{k.titulo}</span>
                        <span className="kb-tag">{k.cat}</span>
                      </button>
                      {kbOpen === i && <div className="kb-body">{k.pasos}</div>}
                    </div>
                  ))}
                </div>
              )}

              {(panel === 'dashboard' || panel === 'estadisticas') && (
                <div>
                  <div className="stats-grid">
                    {STATS.map((s) => (
                      <div key={s.label} className="stats-card" style={{ borderColor: s.color }}>
                        <div className="stats-label">{s.label}</div>
                        <div className="stats-value" style={{ color: s.color }}>{s.value}</div>
                        <div className="stats-trend">{s.trend}</div>
                      </div>
                    ))}
                  </div>
                  <div className="distribution-card">
                    <div className="distribution-title">Distribución por categoría</div>
                    {[
                      { cat: 'Red / Conectividad', pct: 38, color: '#6366f1' },
                      { cat: 'Software / Apps', pct: 32, color: '#0ea5e9' },
                      { cat: 'Accesos / Cuentas', pct: 22, color: '#10b981' },
                      { cat: 'Hardware', pct: 8, color: '#f59e0b' },
                    ].map((b) => (
                      <div key={b.cat} className="distribution-row">
                        <div className="distribution-row-label"><span>{b.cat}</span><span>{b.pct}%</span></div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${b.pct}%`, background: b.color }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {panel === 'diagnostico_red' && (
                <div className="network-grid">
                  {[
                    { label: 'Gateway principal', val: '10.0.0.1', ok: true },
                    { label: 'DNS Primario', val: '8.8.8.8', ok: true },
                    { label: 'Servidor Moodle', val: '192.168.1.10', ok: true },
                    { label: 'WiFi UDEP-Seguro', val: '2.4GHz / 5GHz', ok: true },
                    { label: 'VPN Server', val: 'vpn.udep.pe', ok: false },
                    { label: 'Correo SMTP', val: 'mail.udep.pe', ok: true },
                  ].map((r) => (
                    <div key={r.label} className="network-card">
                      <div className="network-card-title">{r.label}</div>
                      <div className="network-card-value">{r.val}</div>
                      <div className="network-card-status">{r.ok ? '🟢' : '🔴'}</div>
                    </div>
                  ))}
                  <div className="network-alert">⚠️ VPN Server con latencia elevada (420ms). Revisar configuración de túnel.</div>
                </div>
              )}

              {!['ver_tickets', 'consultar_estado', 'reportar_incidencia', 'base_conocimiento', 'dashboard', 'estadisticas', 'diagnostico_red'].includes(panel) && (
                <div className="placeholder-panel">
                  <div className="placeholder-icon">{TOOLS_META[panel]?.icon}</div>
                  <div className="placeholder-title">Módulo <strong>{TOOLS_META[panel]?.label}</strong> disponible.</div>
                  <div className="placeholder-text">Pregúntale al agente o describe lo que necesitas hacer.</div>
                </div>
              )}
            </section>
          )}

          <section className="chat-section">
            <div className="chat-body">
              {messages.map((m, i) => (
                <div key={i} className={`chat-row ${m.role === 'user' ? 'chat-user' : 'chat-assistant'}`}>
                  {m.role === 'assistant' && <div className="chat-avatar">🤖</div>}
                  <div className={`chat-bubble ${m.role === 'user' ? 'user-bubble' : 'assistant-bubble'}`}>{m.text}</div>
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
                {(role === 'usuario' ? ['Tengo problema con el WiFi', 'No puedo entrar a Moodle', 'Olvidé mi contraseña'] :
                  role === 'tecnico' ? ['Ver tickets pendientes', 'Diagnosticar red del Lab B', 'Buscar usuario garcia@udep'] :
                  role === 'admin' ? ['Revisar logs del servidor', 'Estado de la infraestructura', 'Gestionar cuenta bloqueada'] :
                  ['Resumen de incidencias del mes', 'Rendimiento del equipo TI', 'Tickets críticos sin resolver']
                ).map((s) => (
                  <button key={s} type="button" className="prompt-chip" onClick={() => setInput(s)}>{s}</button>
                ))}
              </div>
            )}

            <div className="chat-input-row">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder={`Escribe tu consulta... (${roleData.label})`} />
              <button type="button" className="primary-button" onClick={sendMessage} disabled={!input.trim() || loading}>Enviar</button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
