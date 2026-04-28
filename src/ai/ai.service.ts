import { Injectable, Logger } from '@nestjs/common';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  stream?: false;
  think?: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  readonly defaultModel: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL ?? 'qwen3:32b-q4_K_M';
  }

  async chat(
    messages: ChatMessage[],
    options: ChatOptions = {},
  ): Promise<string> {
    const model = options.model ?? this.defaultModel;

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };

    // qwen3 supports /think tag toggle via options
    if (options.think !== undefined) {
      body.think = options.think;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    return this.stripThinkingBlocks(data.message.content);
  }

  private stripThinkingBlocks(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
