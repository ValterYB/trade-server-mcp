# Trade Server MCP

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI assistants (GitHub Copilot, Claude, Cursor, etc.) direct access to the **YourBourse Trading Platform Admin API**. Instead of copy-pasting API responses or writing scripts, you can ask your AI assistant to check account balances, place trades, stream live quotes, analyze markets with technical indicators, or configure order routing — and it will call the Trade Server directly.

## What can it do?

> "Show me open positions on account 2"  
> "Place a 0.1 lot EURUSD buy market order"  
> "What's the current EURUSD bid/ask spread?"  
> "Get the RSI(14) on EURUSD 1H candles"  
> "Cancel all pending orders on account 2"  
> "Show me the order routing configuration"  
> "What's the EUR to USD conversion rate?"

The server exposes **38 tools** and **4 resources** across four categories:

### Trading (16 tools)
| Tool | Description |
|---|---|
| `place_order` | Place Market, Limit, Stop, StopLimit, or CloseBy orders with optional SL/TP |
| `cancel_order` | Cancel a single pending order by ID |
| `cancel_all_orders` | Cancel all working orders on an account (optional symbol filter) |
| `modify_order` | Modify order price or quantity |
| `modify_order_sltp` | Add/modify/remove SL/TP on a pending order |
| `force_delete_order` | Force-remove stuck orders that normal cancel can't handle |
| `get_working_orders` | List active/pending orders |
| `get_open_positions` | List open positions with current P/L |
| `close_position` | Close a position (full or partial) |
| `close_all_positions` | Close all positions on an account (optional symbol filter) |
| `close_by` | Close two opposing hedged positions against each other |
| `modify_position_sltp` | Set/modify/remove stop loss and take profit on a position |
| `get_account_summary` | Complete account snapshot: state + positions + orders in one call |
| `get_trade_history` | Historical trade executions (fills) |
| `get_order_history` | Historical orders (filled, cancelled, rejected) |
| `cash_transfer` | Deposit, withdraw, or adjust balance (supports Balance, Credit, Fee, Bonus, etc.) |

### Account (6 tools)
| Tool | Description |
|---|---|
| `get_account_state` | Balance, equity, margin, free margin, unrealized P/L |
| `get_account_info` | Account config: group, client, leverage, trading permissions |
| `get_all_accounts` | List all trading accounts on the server |
| `get_balances` | Financial state for ALL accounts at once (portfolio view) |
| `get_transfer_history` | Cash transfer history (deposits, withdrawals, adjustments) |
| `health_check` | Verify server connectivity and get version |

### Market Data (7 tools)
| Tool | Description |
|---|---|
| `get_quote` | Live bid/ask quote for a single symbol via WebSocket L1 |
| `get_quotes` | Live quotes for multiple symbols in parallel |
| `get_market_depth` | Level 2 order book with multiple price levels |
| `get_symbols` | List symbols with glob filter (e.g. `EUR*`, `*USD`) |
| `get_candles` | OHLCV candlestick data (1M to Monthly, max 1000 per request) |
| `get_conversion_rate` | Currency conversion rate (e.g. EUR→USD) using group price source |
| `get_indicator` | Technical analysis: RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Stochastic, ADX, VWAP, CCI |

### Configuration (9 tools)
| Tool | Description |
|---|---|
| `get_groups` | List all trading groups |
| `get_group` | Detailed group config: margin, commissions, symbol overrides |
| `get_clients` | List all clients (account owners) |
| `get_symbol_details` | Full symbol config: sessions, swaps, margin rates, tick/lot size |
| `get_liquidity_connectors` | List all LPs with connection params and subscribed symbols |
| `get_order_routing` | Current routing rules + version number |
| `set_order_routing` | Replace all routing rules (requires version) |
| `add_routing_rule` | Safely append a single rule without affecting existing ones |
| `remove_routing_rule` | Remove a rule by index |

### MCP Resources (4)
| URI | Description |
|---|---|
| `trade://symbols` | All available trading symbols |
| `trade://groups` | All trading groups |
| `trade://accounts` | All trading accounts |
| `trade://connectors` | All liquidity connectors |

Resources provide static context that LLMs can reference without making tool calls.

## Architecture

- **Structured error handling** — Errors return `{error, message}` JSON with semantic codes (`BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, etc.) instead of raw stack traces
- **WebSocket auto-reconnect** — Exponential backoff (1s → 16s, max 5 attempts) for market data feeds
- **POST retry** — Automatic retry on connection failure (ECONNREFUSED/ENOTFOUND)
- **Parallel operations** — `get_quotes`, `cancel_all_orders`, `close_all_positions` execute in parallel for efficiency

## Requirements

- Node.js 18 or newer
- A YourBourse Trade Server instance with Admin API enabled
- API key and secret key (generated from Trade Server admin panel)

## Setup

### VS Code / GitHub Copilot

Add to your MCP settings (File → Preferences → Settings → search "mcp", or edit `.vscode/mcp.json`):

```json
{
  "servers": {
    "trade-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:yourbourse/trade-server-mcp"],
      "env": {
        "YB_API_KEY": "your-api-key",
        "YB_SECRET_KEY": "your-secret-key",
        "YB_BASE_URL": "https://your-instance.yourbourse.trade:port"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add trade-server -- npx -y github:yourbourse/trade-server-mcp
```

Set environment variables in `~/.claude/.env`:
```
YB_API_KEY=your-api-key
YB_SECRET_KEY=your-secret-key
YB_BASE_URL=https://your-instance.yourbourse.trade:port
```

### Claude Desktop / Cursor / Other MCP Clients

Add to your MCP client configuration file:

```json
{
  "mcpServers": {
    "trade-server": {
      "command": "npx",
      "args": ["-y", "github:yourbourse/trade-server-mcp"],
      "env": {
        "YB_API_KEY": "your-api-key",
        "YB_SECRET_KEY": "your-secret-key",
        "YB_BASE_URL": "https://your-instance.yourbourse.trade:port"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `YB_API_KEY` | Yes | Public API token from Trade Server admin panel |
| `YB_SECRET_KEY` | Yes | Secret key for HMAC-SHA256 request signing |
| `YB_BASE_URL` | Yes | Trade Server URL including port (e.g. `https://myserver.yourbourse.trade:22236`) |

## How Authentication Works

- **GET** requests: signed with `X-YB-API-Key` header only
- **POST/PUT/DELETE** requests: additionally signed with HMAC-SHA256
  - `X-YB-Timestamp` — microseconds since epoch
  - `X-YB-Sign` — HMAC-SHA256 signature of `Content=<body>\nTimestamp=<ts>`

All authentication is handled automatically by the server — users don't need to worry about it.

## Development

```bash
git clone https://github.com/yourbourse/trade-server-mcp.git
cd trade-server-mcp
npm install
npm run build
```

To run locally instead of via `npx`, point your MCP config to the built file:
```json
{
  "command": "node",
  "args": ["/path/to/trade-server-mcp/dist/index.js"]
}
```
