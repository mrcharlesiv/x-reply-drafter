/**
 * LLM client — supports OpenAI, Anthropic, and any OpenAI-compatible API.
 */

export interface LLMRequest {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// --- OpenAI-compatible (covers OpenAI + custom) ---

async function callOpenAICompatible(req: LLMRequest): Promise<LLMResponse> {
  const baseUrl = req.baseUrl || 'https://api.openai.com/v1';
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      max_tokens: req.maxTokens || 280,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return {
    text: data.choices[0].message.content.trim(),
    model: data.model,
    usage: data.usage,
  };
}

// --- Anthropic ---

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: req.maxTokens || 280,
      system: req.systemPrompt,
      messages: [
        { role: 'user', content: req.userPrompt },
      ],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json() as any;
  return {
    text: data.content[0].text.trim(),
    model: data.model,
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
    },
  };
}

// --- Fetch available models ---

export async function fetchModels(
  provider: 'openai' | 'anthropic' | 'custom',
  apiKey: string,
  baseUrl?: string
): Promise<string[]> {
  try {
    if (provider === 'anthropic') {
      // Anthropic doesn't have a models endpoint, return known models
      return [
        'claude-sonnet-4-20250514',
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307',
      ];
    }

    const base = baseUrl || 'https://api.openai.com/v1';
    const res = await fetch(`${base.replace(/\/$/, '')}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    const models = (data.data || [])
      .map((m: any) => m.id as string)
      .filter((id: string) => id.includes('gpt') || id.includes('claude') || id.includes('llama') || id.includes('mistral'))
      .sort();

    return models.length > 0 ? models : (data.data || []).map((m: any) => m.id).sort();
  } catch {
    return [];
  }
}

// --- Main entry ---

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  switch (req.provider) {
    case 'anthropic':
      return callAnthropic(req);
    case 'openai':
    case 'custom':
      return callOpenAICompatible(req);
    default:
      throw new Error(`Unknown provider: ${req.provider}`);
  }
}
