# Getting Started

Trade Server MCP connects Claude (or any MCP-compatible AI client) to a YourBourse Trade
Server, so you can monitor accounts, pull market data, and trade — by talking to your AI.
This guide takes you from a fresh machine to your first successful tool call.

## Prerequisites

- **Node.js 18 or newer** — check with `node --version`.
- **git** — to clone the repository.
- **A YourBourse Trade Server with API access**, and credentials for it (see
  [Choose your mode](#choose-your-mode) below for which credentials you need).

> **Server version note:** trader (client) mode uses the server's public client API, which
> requires a current Trade Server version. If sign-in is rejected even though your
> credentials are correct, your server may predate the public client API — see
> [Troubleshooting](./TROUBLESHOOTING.md) and ask your broker to confirm.

## Install

The server is distributed as source — clone, install, build:

```bash
git clone https://github.com/yourbourse/trade-server-mcp.git
cd trade-server-mcp
npm ci
npm run build
```

This produces `dist/index.js`, which is the file your MCP client will run. There is nothing to
install globally and no package to download from a registry — installing from source with a
committed lockfile is a deliberate choice (see [Security](./SECURITY.md)).

To verify the build, you can run the test suite with `npm test`.

## Choose your mode

The server runs in one of two modes, matching two kinds of users:

**Broker administrator (admin mode).** You operate the Trade Server itself: you can see and
manage every account, review and edit order routing, transfer cash, inspect liquidity
connectors, and use the full market-data toolset — 38 tools with server-wide scope. You need an
**admin API key pair** (`YB_API_KEY` + `YB_SECRET_KEY`), which comes from your YourBourse server
administration setup. If you manage the server, you (or your team) issue these keys.

**Trader (client mode).** You trade your own account: place and manage orders, set stop loss
and take profit, close positions, check balances, and pull quotes and candles — 26 tools, all
scoped to your single account. You need either your **account login and password**
(`YB_LOGIN` + `YB_PASSWORD`), or a **public API token pair** if your broker has issued you one.
Both come from your broker. Client mode is the right choice for almost everyone who isn't
running the server themselves.

For a deeper look at each persona, see [Admin Mode](./ADMIN_MODE.md) and
[Client Mode](./CLIENT_MODE.md).

## First connection

1. **Add the server to your MCP client's configuration**, pointing it at `dist/index.js` with
   the environment variables for your mode. [Configuration](./CONFIGURATION.md) has complete
   copy-paste examples for Claude Desktop, Claude Code, and generic MCP clients, for all three
   credential setups.

2. **Restart your MCP client** (for Claude Desktop, fully quit and reopen the app) so it picks
   up the new server.

3. **Check the startup line.** The server logs to stderr on startup. In client mode with
   login/password you should see:

   ```
   Trade Server MCP: client mode, signed in as account <login>
   ```

   followed by `Trade Server MCP running on stdio`. Admin mode logs
   `Trade Server MCP: admin mode (server-wide tools)` instead. The full set of startup lines
   (including what a failed sign-in looks like) is listed in
   [Configuration](./CONFIGURATION.md#startup-log-lines).

4. **Run the smoke test.** Ask your AI something like *"Run a health check on the trade
   server."* — it should call the `health_check` tool and report that the server is reachable.
   From there, try *"What's my account state?"* and you're trading.

## Where next

- [Configuration](./CONFIGURATION.md) — every environment variable, all config examples, every
  startup message
- [Tools Reference](./TOOLS_REFERENCE.md) — all 26 client tools and 38 admin tools in detail
- [Admin Mode](./ADMIN_MODE.md) — the broker administrator's guide
- [Client Mode](./CLIENT_MODE.md) — the trader's guide
- [Usage Examples](./USAGE_EXAMPLES.md) — realistic conversation patterns
- [Troubleshooting](./TROUBLESHOOTING.md) — when something doesn't work
- [FAQ](./FAQ.md) — common questions
