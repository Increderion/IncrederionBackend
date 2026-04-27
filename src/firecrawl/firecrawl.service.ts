import { Injectable, Logger } from '@nestjs/common';

export interface ScrapeResult {
  markdown: string;
  url: string;
  rawResponse: unknown;
}

@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://api.firecrawl.dev/v1';

  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async scrapeUrl(url: string): Promise<ScrapeResult> {
    if (!this.isConfigured()) {
      throw new Error('FIRECRAWL_API_KEY is not set.');
    }

    this.logger.debug(`Scraping: ${url}`);

    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 30000,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Firecrawl error ${response.status}: ${text}`);
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: { markdown?: string; metadata?: { sourceURL?: string } };
      markdown?: string;
      metadata?: { sourceURL?: string };
    };

    // Support both v0 and v1 response shapes
    const data = json.data ?? json;
    const markdown: string = (data.markdown as string | undefined) ?? '';
    const resolvedUrl: string =
      (data.metadata as { sourceURL?: string } | undefined)?.sourceURL ?? url;

    return {
      markdown,
      url: resolvedUrl,
      rawResponse: json,
    };
  }
}
