export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const AGENT_API_URL = process.env.AGENT_API_URL;
  const AGENT_API_KEY = process.env.AGENT_API_KEY;
  const AGENT_MODEL = process.env.AGENT_MODEL || 'gpt-4o-mini';
  const AGENT_API_PROVIDER = (process.env.AGENT_API_PROVIDER || 'openrouter').toLowerCase();

  if (!AGENT_API_URL || !AGENT_API_KEY) {
    return res.status(500).json({ error: 'AGENT_API_URL y AGENT_API_KEY deben estar definidas.' });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'El cuerpo debe contener un arreglo `messages`.' });
  }

  let headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${AGENT_API_KEY}`,
  };

  const body = {
    model: AGENT_MODEL,
    messages: messages.map((message) => ({ role: message.role, content: message.text })),
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

    let assistantMessage;
    if (AGENT_API_PROVIDER === 'openrouter' || AGENT_API_PROVIDER === 'openai' || AGENT_API_URL.includes('openrouter.ai') || AGENT_API_URL.includes('openai.com')) {
      assistantMessage = data.choices?.[0]?.message?.content || JSON.stringify(data);
    } else {
      assistantMessage = data.output?.[0]?.content?.[0]?.text || data.content?.[0]?.text || JSON.stringify(data);
    }

    return res.json({ content: assistantMessage });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
