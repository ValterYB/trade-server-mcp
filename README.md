# Trade Server MCP

MCP server for Your Bourse Trade Server Admin API.

## Tools (26 total)

### Trading (9)
- `place_order` — Place Market/Limit/Stop/StopLimit/CloseBy orders
- `cancel_order` — Cancel a working order
- `modify_order` — Modify order price/quantity
- `get_working_orders` — List active orders
- `get_open_positions` — List positions with P/L
- `close_position` — Close position (full or partial)
- `modify_position_sltp` — Set/modify SL/TP
- `get_trade_history` — Closed trade history
- `get_order_history` — Order history

### Account (6)
- `get_account_state` — Balance, equity, margin, free margin
- `get_account_info` — Account details
- `get_all_accounts` — List all accounts
- `cash_transfer` — Deposit/withdraw
- `get_transfer_history` — Transfer history
- `get_balances` — Multi-account balances

### Market Data (4)
- `get_quote` — Live bid/ask (WebSocket)
- `get_market_depth` — Order book (WebSocket)
- `get_symbols` — List/filter symbols
- `get_candles` — OHLC chart data

### Configuration (7)
- `get_groups` — List groups
- `get_group` — Group details
- `get_clients` — List clients
- `get_order_routing` — Current routing rules
- `set_order_routing` — Update routing rules
- `get_liquidity_connectors` — LP configs
- `get_symbol_details` — Full symbol config
- `health_check` — Server health

## Setup

1. Set environment variables:
   - `YB_API_KEY` — Public API token
   - `YB_SECRET_KEY` — Private/secret key for HMAC signing
   - `YB_BASE_URL` — Trade Server URL (e.g. `https://qa2.yourbourse.trade`)

2. Add to VS Code MCP settings (`.vscode/mcp.json` or user settings):
```json
{
  "servers": {
    "trade-server": {
      "command": "node",
      "args": ["C:\\Users\\paata\\trade-server-mcp\\dist\\index.js"],
      "env": {
        "YB_API_KEY": "your-public-key",
        "YB_SECRET_KEY": "your-secret-key",
        "YB_BASE_URL": "https://qa2.yourbourse.trade"
      }
    }
  }
}
```

## Auth

All POST/PUT/DELETE requests are signed with HMAC-SHA256:
- Header: `X-YB-API-Key` (public token)
- Header: `X-YB-Timestamp` (microseconds since epoch)
- Header: `X-YB-Sign` = HMAC-SHA256(secret, `Content=<body>\nTimestamp=<ts>`)

GET requests only need `X-YB-API-Key`.

## Build

```bash
npm install
npm run build
```
