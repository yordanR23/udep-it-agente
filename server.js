import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { buildSystemPrompt } from './agentPrompt.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const AGENT_API_URL = process.env.AGENT_API_URL;
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const AGENT_MODEL = process.env.AGENT_MODEL || 'claude-sonnet-4-20250514';
const AGENT_API_PROVIDER = (process.env.AGENT_API_PROVIDER || '').toLowerCase();
const PORT = process.env.PORT || 4000;

if (!AGENT_API_URL || !AGENT_API_KEY) {
  console.warn('Advertencia: faltan AGENT_API_URL o AGENT_API_KEY en el entorno. El proxy no funcionará hasta que se configuren.');
}

function buildHeaders() {
  if (['openai', 'openrouter'].includes(AGENT_API_PROVIDER) || AGENT_API_URL.includes('openai.com') || AGENT_API_URL.includes('openrouter.ai')) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AGENT_API_KEY}`,
    };
  }

  return {
    'Content-Type': 'application/json',
    'X-API-Key': AGENT_API_KEY,
  };
}

app.post('/api/chat', async (req, res) => {
  if (!AGENT_API_URL || !AGENT_API_KEY) {
    return res.status(500).json({ error: 'AGENT_API_URL y AGENT_API_KEY deben estar definidas.' });
  }

  const { messages, role, context } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'El cuerpo debe contener un arreglo `messages`.' });
  }

  const headers = buildHeaders();
  const chatMessages = [
    { role: 'system', content: buildSystemPrompt(role, context) },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content || message.text || '',
    })),
  ];
  const body = {
    model: AGENT_MODEL,
    messages: chatMessages,
    temperature: 0.3,
  };

  try {
    const response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText || response.statusText });
    }

    const data = await response.json();

    if (AGENT_API_PROVIDER === 'openai' || AGENT_API_URL.includes('openai.com') || AGENT_API_URL.includes('openrouter.ai')) {
      const assistantMessage = data.choices?.[0]?.message?.content || JSON.stringify(data);
      return res.json({ content: assistantMessage });
    }

    const assistantMessage = data.output?.[0]?.content?.[0]?.text || data.content?.[0]?.text || JSON.stringify(data);
    return res.json({ content: assistantMessage });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use(express.static('dist'));
app.get('*', (req, res) => {
  res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
});

app.listen(PORT, () => {
  console.log(`Backend proxy iniciado en http://localhost:${PORT}`);
});
