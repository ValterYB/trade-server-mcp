# Trade Server MCP

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI assistants (GitHub Copilot, Claude, Cursor, etc.) direct access to the **YourBourse Trading Platform Admin API**. Instead of copy-pasting API responses or writing scripts, you can ask your AI assistant to check account balances, place trades, stream live quotes, or configure order routing — and it will call the Trade Server directly.

## What can it do?

> "Show me open positions on account 12345"
> "Place a 0.1 lot EURUSD buy market order on account 12345"
> "What's the current EURUSD bid/ask spread?"
> "Get GBPUSD daily candles for the last 30 days"
> "Show me the order routing configuration"

The server exposes **26 tools** across four categories:

### Trading (9 tools)
| Tool | Description |
|---|---|
| `place_order` | Place Market, Limit, Stop, StopLimit, or CloseBy orders |
| `cancel_order` | Cancel a working order |
| `modify_order` | Modify order price or quantity |
| `get_working_orders` | List active/pending orders |
| `get_open_positions` | List open positions with current P/L |
| `close_position` | Close a position (full or partial) |
| `modify_position_sltp` | Set or modify stop loss / take profit |
| `get_trade_history` | Get closed trade execution history |
| `get_order_history` | Get historical orders |

### Account (6 tools)
| Tool | Description |
|---|---|
| `get_account_state` | Balance, equity, margin, P/L, free margin |
| `get_account_info` | Account details (group, client, leverage, settings) |
| `get_all_accounts` | List all trading accounts |
| `cash_transfer` | Make a cash deposit or withdrawal |
| `get_transfer_history` | Get transfer history |
| `get_balances` | Get balances for multiple accounts at once |

### Market Data (4 tools)
| Tool | Description |
|---|---|
| `get_quote` | Live bid/ask quote via WebSocket |
| `get_market_depth` | Order book / market depth via WebSocket |
| `get_symbols` | List and filter available symbols |
| `get_candles` | OHLC chart candles (M1 to Monthly) |

### Configuration (7 tools)
| Tool | Description |
|---|---|
| `get_groups` | List all trading groups |
| `get_group` | Get detailed group configuration |
| `get_clients` | List all clients |
| `get_order_routing` | Get current order routing rules |
| `set_order_routing` | Update order routing rules |
| `get_liquidity_connectors` | List liquidity connector configurations |
| `get_symbol_details` | Get full symbol configuration by ID |
| `health_check` | Check if Trade Server is running |

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
