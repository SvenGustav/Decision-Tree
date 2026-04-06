export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LmStudioConfig {
  baseUrl: string
  /** Empty string = use whatever model is loaded in LM Studio */
  model: string
  /** Use JSON Schema structured output — forces the model to return {message, action_type, tree?, changes?} */
  structuredOutput: boolean
}

export const DEFAULT_CONFIG: LmStudioConfig = {
  baseUrl: 'http://localhost:1234',
  model: '',
  structuredOutput: false,
}

/**
 * JSON Schema sent as response_format when structuredOutput is enabled.
 * The model will always return {message, action_type, tree?, changes?}.
 */
const nodeProps = {
  label: { type: 'string' },
  kind: { type: 'string', enum: ['decision', 'chance', 'terminal'] },
  payoff: { type: 'number' },
  edgeLabel: { type: 'string' },
  edgeProbability: { type: 'number' },
  edgePayoff: { type: 'number' },
}

export const RISKTREE_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'risktree_response',
    strict: false,
    schema: {
      type: 'object',
      required: ['message', 'action_type'],
      properties: {
        message: {
          type: 'string',
          description: 'Plain text response to the user. No asterisks, no pound signs, no markdown.',
        },
        action_type: {
          type: 'string',
          enum: ['none', 'build_tree', 'update_tree'],
          description: 'Which tree action to perform, or "none" if no change is needed.',
        },
        tree: {
          type: 'object',
          description: 'Root node for build_tree. Required when action_type is "build_tree".',
          required: ['label', 'kind'],
          properties: {
            ...nodeProps,
            children: {
              type: 'array',
              items: {
                type: 'object',
                required: ['label', 'kind'],
                properties: {
                  ...nodeProps,
                  children: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['label', 'kind'],
                      properties: {
                        ...nodeProps,
                        children: {
                          type: 'array',
                          items: {
                            type: 'object',
                            required: ['label', 'kind'],
                            properties: {
                              ...nodeProps,
                              children: { type: 'array', items: { type: 'object' } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        changes: {
          type: 'array',
          description: 'List of value changes for update_tree. Required when action_type is "update_tree".',
          items: {
            type: 'object',
            required: ['type', 'id'],
            properties: {
              type: { type: 'string', enum: ['updateEdge', 'updateNode'] },
              id: { type: 'string' },
              probability: { type: 'number' },
              payoff: { type: 'number' },
              label: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const

const STORAGE_KEY = 'risktree_lmstudio_config'

export function loadConfig(): LmStudioConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG }
}

export function saveConfig(config: LmStudioConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

/**
 * Streams chat completions from LM Studio's OpenAI-compatible API.
 * Yields text delta strings as they arrive.
 * When config.structuredOutput is true, adds response_format with the RiskTree JSON Schema.
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: LmStudioConfig,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`

  const body: Record<string, unknown> = {
    model: config.model || 'local-model',
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  }

  if (config.structuredOutput) {
    body.response_format = RISKTREE_JSON_SCHEMA
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(body),
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    throw new Error(
      `Cannot reach LM Studio at ${config.baseUrl}. Make sure the server is running and "Enable CORS" is checked in LM Studio settings.`,
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`LM Studio returned ${response.status}: ${text || 'unknown error'}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body from LM Studio')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) yield delta
        } catch {
          // malformed SSE chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Fetch available model IDs from LM Studio. Returns [] if server is unreachable. */
export async function fetchModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data?: { id: string }[] }
    return (data.data ?? []).map((m) => m.id)
  } catch {
    return []
  }
}

/** Quick connectivity check — resolves true if the server responds at all. */
export async function pingServer(baseUrl: string): Promise<boolean> {
  const models = await fetchModels(baseUrl)
  return models.length >= 0 // even an empty list means the server is up
}
