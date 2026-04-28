import { Injectable, Logger } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  readonly defaultModel: string;

  constructor() {
    this.baseUrl = process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1';
    this.apiKey = process.env.AI_API_KEY ?? '';
    this.defaultModel = process.env.AI_MODEL ?? 'google/gemini-2.0-flash-001';
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;

    if (!this.apiKey) {
      this.logger.error('Missing AI_API_KEY for OpenRouter');
      throw new Error('AI API Key is required');
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://increderion.ai', // Optional for OpenRouter
        'X-Title': 'Increderion',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.1,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

