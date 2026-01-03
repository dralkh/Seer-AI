/**
 * Web Search Provider Abstraction
 * Unified interface for web search providers (Firecrawl, Tavily)
 *
 * Allows switching between providers via preferences without
 * changing tool/consumer code.
 */

import { config } from "../../package.json";
import {
  firecrawlService,
  FirecrawlSearchResult as FirecrawlResult,
} from "./firecrawl";
import { tavilyService, WebSearchResult as TavilyResult } from "./tavily";

// ==================== Types ====================

export type WebSearchProviderType = "firecrawl" | "tavily";

export interface WebSearchResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    statusCode?: number;
  };
}

export interface PdfDiscoveryResult {
  pdfUrl?: string;
  pageUrl?: string;
  source: WebSearchProviderType;
  status: "pdf_found" | "page_found" | "not_found";
}

export interface WebSearchProvider {
  isConfigured(): boolean;
  webSearch(query: string, limit?: number): Promise<WebSearchResult[]>;
  scrapeUrl(url: string): Promise<WebSearchResult | null>;
  researchSearch(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult | null>;
  searchForPdf(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult>;
  getCachedPdfResult(paperId: string): PdfDiscoveryResult | null | undefined;
  setCachedPdfResult(paperId: string, result: PdfDiscoveryResult | null): void;
  clearCache(): void;
  clearPdfCache(): void;
  clearPdfCacheForPaper(title: string, authors?: string[], doi?: string): void;
  getSearchLimit(): number;
}

// ==================== Provider Wrapper ====================

/**
 * Wraps Firecrawl service to conform to WebSearchProvider interface
 */
class FirecrawlProviderWrapper implements WebSearchProvider {
  isConfigured(): boolean {
    return firecrawlService.isConfigured();
  }

  async webSearch(query: string, limit?: number): Promise<WebSearchResult[]> {
    const results = await firecrawlService.webSearch(query, limit);
    return results.map(this.normalizeResult);
  }

  async scrapeUrl(url: string): Promise<WebSearchResult | null> {
    const result = await firecrawlService.scrapeUrl(url);
    return result ? this.normalizeResult(result) : null;
  }

  async researchSearch(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult | null> {
    const result = await firecrawlService.researchSearch(title, authors, doi);
    return result ? { ...result, source: "firecrawl" as const } : null;
  }

  async searchForPdf(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult> {
    const result = await firecrawlService.searchForPdf(title, authors, doi);
    return { ...result, source: "firecrawl" as const };
  }

  getCachedPdfResult(paperId: string): PdfDiscoveryResult | null | undefined {
    const result = firecrawlService.getCachedPdfResult(paperId);
    return result ? { ...result, source: "firecrawl" as const } : result;
  }

  setCachedPdfResult(paperId: string, result: PdfDiscoveryResult | null): void {
    firecrawlService.setCachedPdfResult(
      paperId,
      result ? { ...result, source: "firecrawl" } : null,
    );
  }

  clearCache(): void {
    firecrawlService.clearCache();
  }

  clearPdfCache(): void {
    firecrawlService.clearPdfCache();
  }

  clearPdfCacheForPaper(title: string, authors?: string[], doi?: string): void {
    firecrawlService.clearPdfCacheForPaper(title, authors, doi);
  }

  getSearchLimit(): number {
    return firecrawlService.getSearchLimit();
  }

  private normalizeResult(result: FirecrawlResult): WebSearchResult {
    return {
      url: result.url,
      title: result.title,
      description: result.description,
      markdown: result.markdown,
      links: result.links,
      metadata: result.metadata,
    };
  }
}

/**
 * Wraps Tavily service to conform to WebSearchProvider interface
 */
class TavilyProviderWrapper implements WebSearchProvider {
  isConfigured(): boolean {
    return tavilyService.isConfigured();
  }

  async webSearch(query: string, limit?: number): Promise<WebSearchResult[]> {
    return await tavilyService.webSearch(query, limit);
  }

  async scrapeUrl(url: string): Promise<WebSearchResult | null> {
    return await tavilyService.scrapeUrl(url);
  }

  async researchSearch(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult | null> {
    const result = await tavilyService.researchSearch(title, authors, doi);
    return result ? { ...result, source: "tavily" as const } : null;
  }

  async searchForPdf(
    title: string,
    authors?: string[],
    doi?: string,
  ): Promise<PdfDiscoveryResult> {
    const result = await tavilyService.searchForPdf(title, authors, doi);
    return { ...result, source: "tavily" as const };
  }

  getCachedPdfResult(paperId: string): PdfDiscoveryResult | null | undefined {
    const result = tavilyService.getCachedPdfResult(paperId);
    return result ? { ...result, source: "tavily" as const } : result;
  }

  setCachedPdfResult(paperId: string, result: PdfDiscoveryResult | null): void {
    tavilyService.setCachedPdfResult(
      paperId,
      result ? { ...result, source: "tavily" } : null,
    );
  }

  clearCache(): void {
    tavilyService.clearCache();
  }

  clearPdfCache(): void {
    tavilyService.clearPdfCache();
  }

  clearPdfCacheForPaper(title: string, authors?: string[], doi?: string): void {
    tavilyService.clearPdfCacheForPaper(title, authors, doi);
  }

  getSearchLimit(): number {
    return tavilyService.getSearchLimit();
  }
}

// ==================== Singleton Instances ====================

const firecrawlProvider = new FirecrawlProviderWrapper();
const tavilyProvider = new TavilyProviderWrapper();

// ==================== Provider Selection ====================

/**
 * Get the currently selected web search provider from preferences
 */
export function getActiveProviderType(): WebSearchProviderType {
  const prefPrefix = config.prefsPrefix;
  const provider = Zotero.Prefs.get(
    `${prefPrefix}.webSearchProvider`,
  ) as string;
  return provider === "tavily" ? "tavily" : "firecrawl";
}

/**
 * Get the active web search provider instance
 */
export function getActiveProvider(): WebSearchProvider {
  const providerType = getActiveProviderType();
  return providerType === "tavily" ? tavilyProvider : firecrawlProvider;
}

/**
 * Get a specific provider by type
 */
export function getProvider(type: WebSearchProviderType): WebSearchProvider {
  return type === "tavily" ? tavilyProvider : firecrawlProvider;
}

/**
 * Check if any web search provider is configured
 */
export function isAnyProviderConfigured(): boolean {
  return firecrawlProvider.isConfigured() || tavilyProvider.isConfigured();
}

/**
 * Check if the active provider is configured
 */
export function isActiveProviderConfigured(): boolean {
  return getActiveProvider().isConfigured();
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): WebSearchProviderType[] {
  const providers: WebSearchProviderType[] = [];
  if (firecrawlProvider.isConfigured()) providers.push("firecrawl");
  if (tavilyProvider.isConfigured()) providers.push("tavily");
  return providers;
}

/**
 * Get human-readable name for provider
 */
export function getProviderDisplayName(type: WebSearchProviderType): string {
  switch (type) {
    case "firecrawl":
      return "Firecrawl";
    case "tavily":
      return "Tavily";
    default:
      return type;
  }
}
