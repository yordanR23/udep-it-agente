export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const {
    role,
    email,
    password,
    adminKey,
  } = req.body || {};

  if (!role || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  const credentials = {
    usuario: {
      email: process.env.AGENT_USER_EMAIL,
      password: process.env.AGENT_USER_PASSWORD,
    },
    tecnico: {
      email: process.env.AGENT_TECH_EMAIL,
      password: process.env.AGENT_TECH_PASSWORD,
    },
    admin: {
      email: process.env.AGENT_ADMIN_EMAIL,
      password: process.env.AGENT_ADMIN_PASSWORD,
      extraKey: process.env.AGENT_ADMIN_KEY,
    },
    jefe: {
      email: process.env.AGENT_JEFE_EMAIL,
      password: process.env.AGENT_JEFE_PASSWORD,
    },
  };

  const expected = credentials[role];
  if (!expected || !expected.email || !expected.password) {
    return res.status(403).json({ error: 'Rol no permitido o credenciales no configuradas.' });
  }

  if (email.trim().toLowerCase() !== expected.email.toLowerCase()) {
    return res.status(401).json({ error: 'Correo institucional incorrecto.' });
  }

  if (password !== expected.password) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  if (role === 'admin') {
    if (!adminKey || adminKey !== expected.extraKey) {
      return res.status(401).json({ error: 'Clave adicional de administrador incorrecta.' });
    }
  }

  return res.status(200).json({ role, message: 'Autenticación correcta.' });
}
