#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AuthConfig } from "./auth.js";
import { RestClient } from "./rest-client.js";
import { WsClient } from "./ws-client.js";

// Tool imports
import {
  placeOrderSchema, placeOrder,
  cancelOrderSchema, cancelOrder,
  modifyOrderSchema, modifyOrder,
  getWorkingOrdersSchema, getWorkingOrders,
  getOpenPositionsSchema, getOpenPositions,
  closePositionSchema, closePosition,
  modifyPositionSltpSchema, modifyPositionSltp,
  getTradeHistorySchema, getTradeHistory,
  getOrderHistorySchema, getOrderHistory,
} from "./tools/trading.js";

import {
  getAccountStateSchema, getAccountState,
  getAccountInfoSchema, getAccountInfo,
  getAllAccountsSchema, getAllAccounts,
  cashTransferSchema, cashTransfer,
  getTransferHistorySchema, getTransferHistory,
  getBalancesSchema, getBalances,
} from "./tools/account.js";

import {
  getQuoteSchema, getQuote,
  getMarketDepthSchema, getMarketDepth,
  getSymbolsSchema, getSymbols,
  getCandlesSchema, getCandles,
} from "./tools/market-data.js";

import {
  getGroupsSchema, getGroups,
  getGroupSchema, getGroup,
  getClientsSchema, getClients,
  getOrderRoutingSchema, getOrderRouting,
  setOrderRoutingSchema, setOrderRouting,
  getLiquidityConnectorsSchema, getLiquidityConnectors,
  getSymbolDetailsSchema, getSymbolDetails,
  healthCheckSchema, healthCheck,
} from "./tools/config.js";

// Read config from environment variables
function getConfig(): AuthConfig {
  const apiKey = process.env.YB_API_KEY;
  const secretKey = process.env.YB_SECRET_KEY;
  const baseUrl = process.env.YB_BASE_URL;

  if (!apiKey || !secretKey || !baseUrl) {
    throw new Error(
      "Missing environment variables. Set YB_API_KEY, YB_SECRET_KEY, and YB_BASE_URL"
    );
  }

  return { apiKey, secretKey, baseUrl };
}

// Helper to wrap tool handlers with error handling per MCP best practices
function toolHandler<T>(
  fn: (params: T) => Promise<unknown>
): (params: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  return async (params: T) => {
    try {
      const result = await fn(params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err);
      // Undici "fetch failed" hides real cause — extract it
      if (err instanceof Error && err.cause) {
        const cause = err.cause instanceof Error ? err.cause.message : String(err.cause);
        message = `${message} (cause: ${cause})`;
      }
      console.error(`Tool error: ${message}`);
      return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
    }
  };
}

async function main() {
  const config = getConfig();
  const restClient = new RestClient(config);
  const wsClient = new WsClient(config);

  const server = new McpServer({
    name: "trade-server",
    version: "1.0.0",
  });

  // Graceful shutdown
  const cleanup = () => {
    wsClient.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // === TRADING TOOLS ===

  server.tool(
    "place_order",
    "Place a new order (Market, Limit, Stop, StopLimit, CloseBy)",
    placeOrderSchema.shape,
    toolHandler((params) => placeOrder(restClient, params))
  );

  server.tool(
    "cancel_order",
    "Cancel a working order",
    cancelOrderSchema.shape,
    toolHandler((params) => cancelOrder(restClient, params))
  );

  server.tool(
    "modify_order",
    "Modify a working order (price, quantity)",
    modifyOrderSchema.shape,
    toolHandler((params) => modifyOrder(restClient, params))
  );

  server.tool(
    "get_working_orders",
    "Get active/working orders",
    getWorkingOrdersSchema.shape,
    toolHandler((params) => getWorkingOrders(restClient, params))
  );

  server.tool(
    "get_open_positions",
    "Get open positions with current P/L",
    getOpenPositionsSchema.shape,
    toolHandler((params) => getOpenPositions(restClient, params))
  );

  server.tool(
    "close_position",
    "Close an open position (full or partial)",
    closePositionSchema.shape,
    toolHandler((params) => closePosition(restClient, params))
  );

  server.tool(
    "modify_position_sltp",
    "Set or modify stop loss and/or take profit on a position",
    modifyPositionSltpSchema.shape,
    toolHandler((params) => modifyPositionSltp(restClient, params))
  );

  server.tool(
    "get_trade_history",
    "Get trade execution history",
    getTradeHistorySchema.shape,
    toolHandler((params) => getTradeHistory(restClient, params))
  );

  server.tool(
    "get_order_history",
    "Get historical orders",
    getOrderHistorySchema.shape,
    toolHandler((params) => getOrderHistory(restClient, params))
  );

  // === ACCOUNT TOOLS ===

  server.tool(
    "get_account_state",
    "Get account state (balance, equity, margin, P/L, free margin)",
    getAccountStateSchema.shape,
    toolHandler((params) => getAccountState(restClient, params))
  );

  server.tool(
    "get_account_info",
    "Get trading account details (group, client, leverage, settings)",
    getAccountInfoSchema.shape,
    toolHandler((params) => getAccountInfo(restClient, params))
  );

  server.tool(
    "get_all_accounts",
    "List all trading accounts",
    getAllAccountsSchema.shape,
    toolHandler(() => getAllAccounts(restClient))
  );

  server.tool(
    "cash_transfer",
    "Make a cash deposit or withdrawal",
    cashTransferSchema.shape,
    toolHandler((params) => cashTransfer(restClient, params))
  );

  server.tool(
    "get_transfer_history",
    "Get cash transfer history",
    getTransferHistorySchema.shape,
    toolHandler((params) => getTransferHistory(restClient, params))
  );

  server.tool(
    "get_balances",
    "Get account balances, equity, margin, P/L for all accounts",
    getBalancesSchema.shape,
    toolHandler(() => getBalances(restClient))
  );

  // === MARKET DATA TOOLS ===

  server.tool(
    "get_quote",
    "Get current bid/ask quote for a symbol (via WebSocket)",
    getQuoteSchema.shape,
    toolHandler((params) => getQuote(wsClient, params))
  );

  server.tool(
    "get_market_depth",
    "Get order book / market depth for a symbol (via WebSocket)",
    getMarketDepthSchema.shape,
    toolHandler((params) => getMarketDepth(wsClient, params))
  );

  server.tool(
    "get_symbols",
    "List available symbols (optionally filter by pattern like EUR*)",
    getSymbolsSchema.shape,
    toolHandler((params) => getSymbols(restClient, params))
  );

  server.tool(
    "get_candles",
    "Get OHLC chart candles for a symbol",
    getCandlesSchema.shape,
    toolHandler((params) => getCandles(restClient, params))
  );

  // === CONFIGURATION TOOLS ===

  server.tool(
    "get_groups",
    "List all trading groups",
    getGroupsSchema.shape,
    toolHandler(() => getGroups(restClient))
  );

  server.tool(
    "get_group",
    "Get detailed group configuration",
    getGroupSchema.shape,
    toolHandler((params) => getGroup(restClient, params))
  );

  server.tool(
    "get_clients",
    "List all clients",
    getClientsSchema.shape,
    toolHandler(() => getClients(restClient))
  );

  server.tool(
    "get_order_routing",
    "Get current order routing rules",
    getOrderRoutingSchema.shape,
    toolHandler(() => getOrderRouting(restClient))
  );

  server.tool(
    "set_order_routing",
    "Set order routing rules (replaces all existing rules)",
    setOrderRoutingSchema.shape,
    toolHandler((params) => setOrderRouting(restClient, params))
  );

  server.tool(
    "get_liquidity_connectors",
    "List all liquidity connector configurations",
    getLiquidityConnectorsSchema.shape,
    toolHandler(() => getLiquidityConnectors(restClient))
  );

  server.tool(
    "get_symbol_details",
    "Get full symbol configuration by ID",
    getSymbolDetailsSchema.shape,
    toolHandler((params) => getSymbolDetails(restClient, params))
  );

  server.tool(
    "health_check",
    "Check if Trade Server is running (returns server time)",
    healthCheckSchema.shape,
    toolHandler(() => healthCheck(restClient))
  );

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Trade Server MCP running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
