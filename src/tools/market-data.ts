import { z } from "zod";
import { RestClient } from "../rest-client.js";
import { WsClient } from "../ws-client.js";

export const getQuoteSchema = z.object({
  symbol: z.string().describe("Symbol name, e.g. EURUSD"),
  groupId: z.number().optional().describe("Group ID (default 1)"),
});

export async function getQuote(wsClient: WsClient, params: z.infer<typeof getQuoteSchema>) {
  if (!wsClient.isConnected) {
    await wsClient.connect();
  }

  const data = await wsClient.getSnapshot("L1", {
    s: params.symbol,
    g: params.groupId ?? 1,
    streaming: true,
  }, { timeoutMs: 3000 });

  // Extract quote data from updates
  const quotes: unknown[] = [];
  for (const msg of data) {
    const m = msg as { d?: unknown[] };
    if (m.d) quotes.push(...m.d);
  }
  return quotes.length > 0 ? quotes : data;
}

export const getMarketDepthSchema = z.object({
  symbol: z.string().describe("Symbol name, e.g. EURUSD"),
  groupId: z.number().optional().describe("Group ID (default 1)"),
  priceLevel: z.number().optional().describe("Number of price levels (default 10)"),
});

export async function getMarketDepth(
  wsClient: WsClient,
  params: z.infer<typeof getMarketDepthSchema>
) {
  if (!wsClient.isConnected) {
    await wsClient.connect();
  }

  const data = await wsClient.getSnapshot("L2", {
    s: params.symbol,
    g: params.groupId ?? 1,
    d: params.priceLevel ?? 10,
    streaming: true,
  }, { timeoutMs: 3000 });

  // Extract book data from updates
  const books: unknown[] = [];
  for (const msg of data) {
    const m = msg as { d?: unknown[] };
    if (m.d) books.push(...m.d);
  }
  return books.length > 0 ? books : data;
}

export const getSymbolsSchema = z.object({
  filter: z.string().optional().describe("Symbol name filter pattern (e.g. EUR*)"),
});

export async function getSymbols(
  client: RestClient,
  params: z.infer<typeof getSymbolsSchema>
) {
  const resp = await client.get<{ symbols: Array<{ name?: string }> }>("/admin/symbols/query");
  const symbols = resp.symbols || [];
  if (params.filter) {
    const regex = new RegExp(
      "^" + params.filter.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      "i"
    );
    return symbols.filter((s) => regex.test(s.name || ""));
  }
  return symbols;
}

export const getCandlesSchema = z.object({
  symbolId: z.number().optional().describe("Symbol ID (use this or symbolName+groupId)"),
  symbolName: z.string().optional().describe("Symbol name (requires groupId)"),
  groupId: z.number().optional().describe("Group ID (required with symbolName)"),
  interval: z
    .enum(["1M", "5M", "15M", "30M", "1H", "4H", "D", "W", "M"])
    .describe("Candle interval"),
  from: z.number().optional().describe("Start time (microseconds since epoch)"),
  to: z.number().optional().describe("End time (microseconds since epoch)"),
  maxResults: z.number().optional().describe("Max candles to return (1-1000, default 1000)"),
});

export async function getCandles(
  client: RestClient,
  params: z.infer<typeof getCandlesSchema>
) {
  const symbolSelector = params.symbolId !== undefined
    ? { symbolId: params.symbolId }
    : { symbolName: params.symbolName, groupId: params.groupId };

  const body: Record<string, unknown> = {
    symbolSelector,
    interval: params.interval,
  };
  if (params.from !== undefined) body.from = params.from;
  if (params.to !== undefined) body.to = params.to;
  if (params.maxResults !== undefined) body.maxResults = params.maxResults;

  return client.post("/admin/charts/get", body);
}

// === CONVERSION ===

export const getConversionRateSchema = z.object({
  groupId: z.number().describe("Group ID for conversion context"),
  from: z.string().describe("Source currency code, e.g. EUR"),
  to: z.string().describe("Target currency code, e.g. USD"),
});

export async function getConversionRate(
  client: RestClient,
  params: z.infer<typeof getConversionRateSchema>
) {
  return client.post("/admin/conversion-rate/single", {
    groupId: params.groupId,
    from: params.from,
    to: params.to,
  });
}

// === MULTI-SYMBOL QUOTES ===

export const getQuotesSchema = z.object({
  symbols: z.array(z.string()).min(1).describe("Array of symbol names, e.g. ['EURUSD', 'GBPUSD']"),
  groupId: z.number().optional().describe("Group ID (default 1)"),
});

export async function getQuotes(
  wsClient: WsClient,
  params: z.infer<typeof getQuotesSchema>
) {
  if (!wsClient.isConnected) {
    await wsClient.connect();
  }

  const groupId = params.groupId ?? 1;

  // Subscribe to all symbols in parallel
  const results = await Promise.all(
    params.symbols.map(async (symbol) => {
      try {
        const data = await wsClient.getSnapshot("L1", {
          s: symbol,
          g: groupId,
          streaming: true,
        }, { timeoutMs: 3000 });

        // Extract quote data
        const quotes: unknown[] = [];
        for (const msg of data) {
          const m = msg as { d?: unknown[] };
          if (m.d) quotes.push(...m.d);
        }
        return { symbol, quote: quotes.length > 0 ? quotes[quotes.length - 1] : null };
      } catch (e) {
        return { symbol, quote: null, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  return results;
}
