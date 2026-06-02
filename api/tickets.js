import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Tickets';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

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

export default async function handler(req, res) {
  try {
    const sheets = getSheetsClient();

    if (req.method === 'POST') {
      const { tickets } = req.body || {};
      if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
        return res.status(400).json({ error: 'El cuerpo debe contener un arreglo `tickets`.' });
      }

      const values = tickets.map(mapTicketRow);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values },
      });

      return res.status(200).json({ success: true, count: values.length });
    }

    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:I`,
      });

      const rows = response.data.values || [];
      const header = rows[0] || [];
      const dataRows = rows.slice(1);
      const tickets = dataRows.map((row) => ({
        id: row[0] || '',
        titulo: row[1] || '',
        categoria: row[2] || '',
        estado: row[3] || '',
        prioridad: row[4] || '',
        usuario: row[5] || '',
        tecnico: row[6] || '',
        fecha: row[7] || '',
        descripcion: row[8] || '',
      }));

      return res.status(200).json({ tickets });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Error interno en Google Sheets.' });
  }
}
