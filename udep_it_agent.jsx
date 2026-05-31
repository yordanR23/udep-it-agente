import { useState, useRef, useEffect } from "react";

const ROLES = {
  usuario: {
    label: "Usuario Final",
    subtitle: "Docente / Alumno / Administrativo",
    icon: "👤",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    tools: ["reportar_incidencia", "consultar_estado", "base_conocimiento", "solicitar_acceso", "buscar_web"],
    welcome: "Hola, soy tu asistente de soporte TI de la UDEP. Puedo ayudarte a reportar incidencias, consultar el estado de tus tickets o resolver dudas técnicas.",
  },
  tecnico: {
    label: "Técnico de Soporte",
    subtitle: "Helpdesk / Soporte en campo",
    icon: "🔧",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    tools: ["ver_tickets", "actualizar_ticket", "diagnostico_red", "buscar_usuario", "base_conocimiento", "buscar_web", "escalar_ticket"],
    welcome: "Panel técnico activo. Tienes acceso a la cola de incidencias, herramientas de diagnóstico y búsqueda de usuarios.",
  },
  admin: {
    label: "Administrador de Sistemas",
    subtitle: "Infraestructura y servidores",
    icon: "⚙️",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    tools: ["ver_tickets", "actualizar_ticket", "diagnostico_red", "gestionar_usuarios", "reportes", "base_conocimiento", "buscar_web", "escalar_ticket", "logs_sistema", "inventario"],
    welcome: "Modo administrador. Acceso completo a diagnósticos de red, gestión de usuarios, logs y reportes del sistema.",
  },
  jefe: {
    label: "Jefe / Coordinador TI",
    subtitle: "Gestión y supervisión",
    icon: "📊",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    tools: ["dashboard", "reportes", "ver_tickets", "gestionar_usuarios", "inventario", "buscar_web", "estadisticas", "asignar_tecnico"],
    welcome: "Panel de coordinación. Acceso a dashboard ejecutivo, reportes de rendimiento, estadísticas y asignación de recursos.",
  },
};

const TOOLS_META = {
  reportar_incidencia: { icon: "🚨", label: "Reportar incidencia", desc: "Crear nuevo ticket" },
  consultar_estado: { icon: "🔍", label: "Consultar estado", desc: "Ver mis tickets" },
  base_conocimiento: { icon: "📚", label: "Base de conocimiento", desc: "Guías y soluciones" },
  solicitar_acceso: { icon: "🔑", label: "Solicitar acceso", desc: "Credenciales y permisos" },
  buscar_web: { icon: "🌐", label: "Búsqueda web", desc: "Documentación externa" },
  ver_tickets: { icon: "📋", label: "Cola de tickets", desc: "Todas las incidencias" },
  actualizar_ticket: { icon: "✏️", label: "Actualizar ticket", desc: "Modificar estado" },
  diagnostico_red: { icon: "📡", label: "Diagnóstico de red", desc: "Análisis conectividad" },
  buscar_usuario: { icon: "👥", label: "Buscar usuario", desc: "Directorio UDEP" },
  escalar_ticket: { icon: "⬆️", label: "Escalar ticket", desc: "Subir prioridad" },
  gestionar_usuarios: { icon: "🛡️", label: "Gestionar usuarios", desc: "Cuentas y accesos" },
  reportes: { icon: "📈", label: "Reportes", desc: "Informes del área" },
  logs_sistema: { icon: "🖥️", label: "Logs del sistema", desc: "Eventos y errores" },
  inventario: { icon: "🗃️", label: "Inventario", desc: "Equipos y activos" },
  dashboard: { icon: "📊", label: "Dashboard", desc: "Vista ejecutiva" },
  estadisticas: { icon: "📉", label: "Estadísticas", desc: "KPIs del área" },
  asignar_tecnico: { icon: "👨‍💼", label: "Asignar técnico", desc: "Distribuir carga" },
};

const MOCK_TICKETS = [
  { id: "TKT-001", titulo: "Sin acceso a WiFi en Lab B-201", estado: "abierto", prioridad: "alta", usuario: "a.garcia@udep.pe", tecnico: "—", categoria: "Red", fecha: "2025-05-30" },
  { id: "TKT-002", titulo: "Proyector dañado en aula 3F", estado: "en_proceso", prioridad: "media", usuario: "j.lopez@udep.pe", tecnico: "M. Torres", categoria: "Hardware", fecha: "2025-05-29" },
  { id: "TKT-003", titulo: "Contraseña de correo institucional bloqueada", estado: "resuelto", prioridad: "media", usuario: "c.ruiz@udep.pe", tecnico: "L. Soto", categoria: "Accesos", fecha: "2025-05-28" },
  { id: "TKT-004", titulo: "No carga el aula virtual (Moodle)", estado: "abierto", prioridad: "alta", usuario: "m.flores@udep.pe", tecnico: "—", categoria: "Software", fecha: "2025-05-31" },
  { id: "TKT-005", titulo: "Solicitud cuenta VPN para trabajo remoto", estado: "pendiente", prioridad: "baja", usuario: "r.santos@udep.pe", tecnico: "L. Soto", categoria: "Accesos", fecha: "2025-05-27" },
];

const KNOWLEDGE_BASE = [
  { titulo: "Cómo conectarse al WiFi institucional UDEP", cat: "Red", pasos: "1. Selecciona 'UDEP-Seguro'\n2. Ingresa tu código de estudiante/empleado\n3. Contraseña: igual que tu correo institucional\n4. Acepta el certificado de seguridad" },
  { titulo: "Resetear contraseña del correo institucional", cat: "Accesos", pasos: "1. Visita portal.udep.pe/reset\n2. Ingresa tu DNI\n3. Recibirás un enlace a tu correo alternativo\n4. Si no tienes acceso, acércate a TI con tu DNI" },
  { titulo: "Acceso a Moodle (Aula Virtual)", cat: "Software", pasos: "1. Ingresa a aulavirtual.udep.pe\n2. Usuario: código institucional\n3. Contraseña: misma que el correo\n4. Si falla, limpiar caché del navegador (Ctrl+Shift+Del)" },
  { titulo: "Solicitar instalación de software", cat: "Software", pasos: "1. Reportar incidencia con categoría 'Software'\n2. Especificar nombre del programa y justificación\n3. Requiere aprobación de jefe de área\n4. Tiempo estimado: 2-3 días hábiles" },
];

const STATS = [
  { label: "Tickets abiertos", value: "12", trend: "+3 hoy", color: "#ef4444" },
  { label: "En proceso", value: "8", trend: "=", color: "#f59e0b" },
  { label: "Resueltos hoy", value: "5", trend: "+5", color: "#10b981" },
  { label: "Tiempo prom.", value: "2.4h", trend: "-0.3h", color: "#6366f1" },
];

const systemPrompts = {
  usuario: `Eres un asistente de soporte TI de la Universidad de Piura (UDEP). Hablas con un USUARIO FINAL (docente, alumno o administrativo). 
Tu tono es amable, claro y sin tecnicismos. 
Herramientas disponibles: reportar incidencias, consultar estado de tickets, base de conocimiento, solicitar accesos.
Cuando el usuario reporte un problema, estructura la información: categoría (Red/Hardware/Software/Accesos), descripción, urgencia.
Si no puedes resolver algo, indícale que escalarás el ticket a un técnico.
Responde siempre en español. Sé conciso (máx 3-4 párrafos).`,

  tecnico: `Eres un asistente de soporte TI de la UDEP para un TÉCNICO DE HELPDESK.
Tu tono es técnico pero directo. Ayudas a gestionar la cola de tickets, diagnosticar problemas de red y consultar usuarios.
Herramientas: ver y actualizar tickets, diagnóstico de red, buscar usuarios en directorio, escalar tickets, base de conocimiento.
Cuando analices un ticket, sugiere pasos concretos de diagnóstico y posibles soluciones.
Responde siempre en español. Incluye comandos o pasos técnicos cuando sea relevante.`,

  admin: `Eres un asistente TI de la UDEP para un ADMINISTRADOR DE SISTEMAS.
Tienes acceso completo: tickets, diagnóstico avanzado de red, gestión de usuarios/cuentas, logs del sistema, inventario.
Tu tono es técnico y preciso. Proporciona información detallada de infraestructura cuando se requiera.
Cuando analices logs o diagnostiques red, sé específico con IPs, protocolos, tiempos de respuesta.
Responde siempre en español. Usa terminología técnica apropiada.`,

  jefe: `Eres un asistente TI de la UDEP para el JEFE/COORDINADOR del área de TI.
Tu tono es ejecutivo y orientado a métricas. Tienes acceso a dashboard, reportes, estadísticas y asignación de técnicos.
Cuando presentes datos, resume los KPIs más importantes. Destaca tendencias y problemas críticos.
Herramientas: dashboard ejecutivo, reportes de rendimiento, estadísticas, asignación de recursos, inventario.
Responde siempre en español. Sé conciso y orientado a decisiones.`,
};

async function callClaude(messages, role) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompts[role],
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "Error al conectar con el agente.";
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#94a3b8",
          display: "inline-block",
          animation: "bounce 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

function TicketBadge({ estado }) {
  const map = {
    abierto: { bg: "#fef2f2", color: "#dc2626", label: "Abierto" },
    en_proceso: { bg: "#fffbeb", color: "#d97706", label: "En proceso" },
    resuelto: { bg: "#f0fdf4", color: "#16a34a", label: "Resuelto" },
    pendiente: { bg: "#f0f9ff", color: "#0284c7", label: "Pendiente" },
  };
  const s = map[estado] || map.abierto;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: s.bg, color: s.color }}>{s.label}</span>;
}

function PrioridadDot({ p }) {
  const c = { alta: "#ef4444", media: "#f59e0b", baja: "#10b981" };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c[p] || "#94a3b8", display: "inline-block", marginRight: 4 }} />;
}

export default function UDEPAgent() {
  const [role, setRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState(null);
  const [reportForm, setReportForm] = useState({ titulo: "", categoria: "Red", descripcion: "", urgencia: "media" });
  const [reportSent, setReportSent] = useState(false);
  const [kbSearch, setKbSearch] = useState("");
  const [kbOpen, setKbOpen] = useState(null);
  const messagesEnd = useRef(null);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function selectRole(r) {
    setRole(r);
    setMessages([{ role: "assistant", text: ROLES[r].welcome }]);
    setPanel(null);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", text: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    const apiHistory = newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
    const reply = await callClaude(apiHistory, role);
    setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    setLoading(false);
  }

  function submitReport() {
    const newId = "TKT-" + String(MOCK_TICKETS.length + 1).padStart(3, "0");
    setReportSent(newId);
    setTimeout(() => { setReportSent(false); setReportForm({ titulo: "", categoria: "Red", descripcion: "", urgencia: "media" }); setPanel(null); }, 3000);
  }

  const roleData = role ? ROLES[role] : null;
  const filteredKB = KNOWLEDGE_BASE.filter(k => k.titulo.toLowerCase().includes(kbSearch.toLowerCase()) || k.cat.toLowerCase().includes(kbSearch.toLowerCase()));

  if (!role) {
    return (
      <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap'); @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎓</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>Universidad de Piura</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>Agente de Soporte TI</h1>
          <p style={{ fontSize: 15, color: "#64748b", margin: 0 }}>Selecciona tu rol para acceder a las herramientas correspondientes</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, width: "100%", maxWidth: 780 }}>
          {Object.entries(ROLES).map(([key, r]) => (
            <button key={key} onClick={() => selectRole(key)} style={{ background: "#fff", border: `1.5px solid ${r.border}`, borderRadius: 14, padding: "1.25rem 1rem", cursor: "pointer", textAlign: "left", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.1)`; e.currentTarget.style.borderColor = r.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = r.border; e.currentTarget.style.transform = "none"; }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{r.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>{r.subtitle}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {r.tools.slice(0, 3).map(t => (
                  <span key={t} style={{ fontSize: 10, background: r.bg, color: r.color, padding: "2px 7px", borderRadius: 8, fontWeight: 500 }}>{TOOLS_META[t]?.label}</span>
                ))}
                {r.tools.length > 3 && <span style={{ fontSize: 10, color: "#94a3b8" }}>+{r.tools.length - 3} más</span>}
              </div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#cbd5e1", marginTop: "2rem" }}>UDEP Campus Piura · Área de Tecnologías de la Información</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap'); @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} } @keyframes fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }`}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 1.25rem", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎓</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", lineHeight: 1.2 }}>UDEP · Soporte TI</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Campus Piura</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ background: roleData.bg, color: roleData.color, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: `1px solid ${roleData.border}` }}>{roleData.icon} {roleData.label}</span>
          <button onClick={() => setRole(null)} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>Cambiar rol</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar tools */}
        <div style={{ width: 200, background: "#fff", borderRight: "1px solid #e2e8f0", padding: "1rem 0.75rem", overflowY: "auto", flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 8px 4px" }}>Herramientas</p>
          {roleData.tools.map(t => {
            const meta = TOOLS_META[t];
            const active = panel === t;
            return (
              <button key={t} onClick={() => setPanel(active ? null : t)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 2, background: active ? roleData.bg : "transparent", transition: "background 0.1s", textAlign: "left" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ fontSize: 15 }}>{meta?.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: active ? roleData.color : "#374151", lineHeight: 1.2 }}>{meta?.label}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{meta?.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Panel overlay */}
          {panel && (
            <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "1rem 1.25rem", maxHeight: 340, overflowY: "auto", animation: "fadein 0.15s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{TOOLS_META[panel]?.icon} {TOOLS_META[panel]?.label}</span>
                <button onClick={() => setPanel(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8" }}>✕</button>
              </div>

              {/* PANEL: ver tickets / cola */}
              {(panel === "ver_tickets" || panel === "consultar_estado") && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        {["ID", "Título", "Categoría", "Estado", "Prioridad", "Técnico"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "4px 10px", color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_TICKETS.map(t => (
                        <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "7px 10px", fontFamily: "DM Mono, monospace", color: "#6366f1", fontSize: 11 }}>{t.id}</td>
                          <td style={{ padding: "7px 10px", color: "#0f172a", maxWidth: 180 }}>{t.titulo}</td>
                          <td style={{ padding: "7px 10px", color: "#64748b" }}>{t.categoria}</td>
                          <td style={{ padding: "7px 10px" }}><TicketBadge estado={t.estado} /></td>
                          <td style={{ padding: "7px 10px" }}><PrioridadDot p={t.prioridad} /><span style={{ color: "#64748b" }}>{t.prioridad}</span></td>
                          <td style={{ padding: "7px 10px", color: "#64748b" }}>{t.tecnico}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* PANEL: Reportar incidencia */}
              {panel === "reportar_incidencia" && (
                reportSent ? (
                  <div style={{ textAlign: "center", padding: "1.5rem", color: "#16a34a" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 600 }}>Ticket {reportSent} creado exitosamente</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Un técnico se comunicará contigo pronto</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Título del problema *</label>
                      <input value={reportForm.titulo} onChange={e => setReportForm({ ...reportForm, titulo: e.target.value })} placeholder="Ej: Sin acceso a WiFi en Lab B-201" style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Categoría</label>
                      <select value={reportForm.categoria} onChange={e => setReportForm({ ...reportForm, categoria: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}>
                        {["Red", "Hardware", "Software", "Accesos", "Otro"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Urgencia</label>
                      <select value={reportForm.urgencia} onChange={e => setReportForm({ ...reportForm, urgencia: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Descripción</label>
                      <textarea value={reportForm.descripcion} onChange={e => setReportForm({ ...reportForm, descripcion: e.target.value })} rows={3} placeholder="Describe el problema con detalle..." style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <button onClick={submitReport} disabled={!reportForm.titulo} style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: reportForm.titulo ? 1 : 0.5 }}>Crear ticket</button>
                    </div>
                  </div>
                )
              )}

              {/* PANEL: Base de conocimiento */}
              {panel === "base_conocimiento" && (
                <div>
                  <input value={kbSearch} onChange={e => setKbSearch(e.target.value)} placeholder="Buscar en guías..." style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
                  {filteredKB.map((k, i) => (
                    <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 6, overflow: "hidden" }}>
                      <button onClick={() => setKbOpen(kbOpen === i ? null : i)} style={{ width: "100%", padding: "10px 12px", background: "#f8fafc", border: "none", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{k.titulo}</span>
                        <span style={{ fontSize: 10, background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 10 }}>{k.cat}</span>
                      </button>
                      {kbOpen === i && <div style={{ padding: "10px 12px", fontSize: 12, color: "#475569", whiteSpace: "pre-line", borderTop: "1px solid #e2e8f0" }}>{k.pasos}</div>}
                    </div>
                  ))}
                </div>
              )}

              {/* PANEL: Dashboard stats */}
              {(panel === "dashboard" || panel === "estadisticas") && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 12 }}>
                    {STATS.map(s => (
                      <div key={s.label} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.trend}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", padding: "10px 12px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Distribución por categoría</div>
                    {[{ cat: "Red / Conectividad", pct: 38, color: "#6366f1" }, { cat: "Software / Apps", pct: 32, color: "#0ea5e9" }, { cat: "Accesos / Cuentas", pct: 22, color: "#10b981" }, { cat: "Hardware", pct: 8, color: "#f59e0b" }].map(b => (
                      <div key={b.cat} style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 2 }}><span>{b.cat}</span><span>{b.pct}%</span></div>
                        <div style={{ height: 6, borderRadius: 3, background: "#e2e8f0", overflow: "hidden" }}><div style={{ height: "100%", width: `${b.pct}%`, background: b.color, borderRadius: 3 }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PANEL: Diagnóstico red */}
              {panel === "diagnostico_red" && (
                <div style={{ fontSize: 12, color: "#475569" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {[
                      { label: "Gateway principal", val: "10.0.0.1", ok: true },
                      { label: "DNS Primario", val: "8.8.8.8", ok: true },
                      { label: "Servidor Moodle", val: "192.168.1.10", ok: true },
                      { label: "WiFi UDEP-Seguro", val: "2.4GHz / 5GHz", ok: true },
                      { label: "VPN Server", val: "vpn.udep.pe", ok: false },
                      { label: "Correo SMTP", val: "mail.udep.pe", ok: true },
                    ].map(r => (
                      <div key={r.label} style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontWeight: 500, color: "#0f172a" }}>{r.label}</div><div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#94a3b8" }}>{r.val}</div></div>
                        <span style={{ fontSize: 14 }}>{r.ok ? "🟢" : "🔴"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#92400e" }}>⚠️ VPN Server con latencia elevada (420ms). Revisar configuración de túnel.</div>
                </div>
              )}

              {/* Otros panels - placeholder */}
              {!["ver_tickets", "consultar_estado", "reportar_incidencia", "base_conocimiento", "dashboard", "estadisticas", "diagnostico_red"].includes(panel) && (
                <div style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{TOOLS_META[panel]?.icon}</div>
                  <div>Módulo <strong>{TOOLS_META[panel]?.label}</strong> disponible.</div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>Pregúntale al agente o describe lo que necesitas hacer.</div>
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", animation: "fadein 0.2s ease" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>🤖</div>
                )}
                <div style={{
                  maxWidth: "72%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? "#1d4ed8" : "#fff",
                  color: m.role === "user" ? "#fff" : "#0f172a",
                  border: m.role === "user" ? "none" : "1px solid #e2e8f0",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap"
                }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🤖</div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px 16px 16px 4px", padding: "12px 16px" }}><TypingDots /></div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Suggested prompts */}
          {messages.length <= 1 && (
            <div style={{ padding: "0 1.25rem 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {role === "usuario" && ["Tengo problema con el WiFi", "No puedo entrar a Moodle", "Olvidé mi contraseña"].map(s => (
                <button key={s} onClick={() => { setInput(s); }} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}>{s}</button>
              ))}
              {role === "tecnico" && ["Ver tickets pendientes", "Diagnosticar red del Lab B", "Buscar usuario garcia@udep"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}>{s}</button>
              ))}
              {role === "admin" && ["Revisar logs del servidor", "Estado de la infraestructura", "Gestionar cuenta bloqueada"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}>{s}</button>
              ))}
              {role === "jefe" && ["Resumen de incidencias del mes", "Rendimiento del equipo TI", "Tickets críticos sin resolver"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 20, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "0.75rem 1.25rem", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={`Escribe tu consulta... (${roleData.label})`}
              style={{ flex: 1, padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", color: "#0f172a" }} />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              style={{ background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", cursor: "pointer", fontWeight: 500, fontSize: 13, opacity: input.trim() && !loading ? 1 : 0.5, transition: "opacity 0.15s" }}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
