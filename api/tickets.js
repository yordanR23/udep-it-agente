import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Tickets';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const HEADERS = ['ID', 'Titulo', 'Categoria', 'Descripción', 'Estado', 'Prioridad', 'Tecnico', 'Fecha', 'Aula', 'Edificio', 'FechaModificion', 'Usuario'];

function getSheetsClient() {
  if (!SERVICE_EMAIL || !PRIVATE_KEY || !SHEET_ID) {
    throw new Error('Google Sheets no está configurado. Revisa las variables de entorno.');
  }

  const auth = new google.auth.JWT({
    email: SERVICE_EMAIL,
    key: PRIVATE_KEY,
    scopes: SCOPES,
  });

  return google.sheets({ version: 'v4', auth });
}

function mapTicketRow(ticket) {
  return [
    ticket.id || '',
    ticket.titulo || '',
    ticket.categoria || '',
    ticket.descripcion || '',
    ticket.estado || '',
    ticket.prioridad || '',
    ticket.tecnico || '',
    ticket.fecha || '',
    ticket.aula || '',
    ticket.edificio || '',
    ticket.fechaModificacion || '',
    ticket.usuario || '',
  ];
}

function mapRowToTicket(row) {
  return {
    id: row[0] || '',
    titulo: row[1] || '',
    categoria: row[2] || '',
    descripcion: row[3] || '',
    estado: row[4] || '',
    prioridad: row[5] || '',
    tecnico: row[6] || '',
    fecha: row[7] || '',
    aula: row[8] || '',
    edificio: row[9] || '',
    fechaModificacion: row[10] || '',
    usuario: row[11] || '',
  };
}

async function ensureHeader(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:L1`,
  });

  const [currentHeader = []] = response.data.values || [];
  if (HEADERS.every((header, index) => currentHeader[index] === header)) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:L1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADERS] },
  });
}

export default async function handler(req, res) {
  try {
    const sheets = getSheetsClient();

    if (req.method === 'POST') {
      const { tickets } = req.body || {};
      if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json({ error: 'El cuerpo debe contener un arreglo `tickets`.' });
      }

      await ensureHeader(sheets);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2:L`,
      });

      const rows = response.data.values || [];
      const idToRowNumber = new Map(rows.map((row, index) => [row[0], index + 2]));
      let updated = 0;
      let inserted = 0;

      for (const ticket of tickets) {
        const values = [mapTicketRow(ticket)];
        const existingRowNumber = idToRowNumber.get(ticket.id);
        if (existingRowNumber) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!A${existingRowNumber}:L${existingRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
          });
          updated += 1;
        } else {
          await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_NAME}!A:L`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values },
          });
          inserted += 1;
        }
      }

      return res.status(200).json({ success: true, count: tickets.length, updated, inserted });
    }

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:L`,
      });

      const rows = response.data.values || [];
      const dataRows = rows.slice(1);
      const tickets = dataRows.map(mapRowToTicket);

      return res.status(200).json({ tickets });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Error interno en Google Sheets.' });
  }
}
