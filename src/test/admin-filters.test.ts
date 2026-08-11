import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RestClient } from "../rest-client.js";
import { StaticCredentials } from "../auth/admin-auth.js";
import * as trd from "../tools/admin/trading.js";
import * as acct from "../tools/admin/account.js";

// Regression guard for a bug found live: these endpoints filter with `accountFilter` /
// `symbolNames`, but the tools used to send a bare `{ A, s }`. The server SILENTLY IGNORED it and
// returned every record on the server, so "positions for account X" answered with everybody's
// positions — and anything acting on that answer hit the wrong records.

let captured: { url: string; body?: string }[] = [];

beforeEach(() => {
  captured = [];
  globalThis.fetch = (async (url: any, init: any) => {
    captured.push({ url: String(url), body: init?.body });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as any;
});

const client = () => new RestClient("http://ts", new StaticCredentials("K", "S"));
const sent = () => JSON.parse(captured[0].body!);

test("account-scoped queries send accountFilter, never a bare A", async () => {
  const c = client();
  const calls: Array<[string, () => Promise<unknown>]> = [
    ["/admin/orders/active", () => trd.getWorkingOrders(c, { accountId: 7 })],
    ["/admin/positions/query", () => trd.getOpenPositions(c, { accountId: 7 })],
    ["/admin/trades/query", () => trd.getTradeHistory(c, { accountId: 7 })],
    ["/admin/orders/history", () => trd.getOrderHistory(c, { accountId: 7 })],
    ["/admin/transfers/query", () => acct.getTransferHistory(c, { accountId: 7 })],
  ];
  for (const [path, run] of calls) {
    captured = [];
    await run();
    assert.equal(captured[0].url, `http://ts/api/v1${path}`);
    assert.deepEqual(
      sent().accountFilter,
      { accounts: [7] },
      `${path} must scope by accountFilter`,
    );
    assert.equal(sent().A, undefined, `${path} must not send the ignored A field`);
  }
});

test("symbol-scoped queries send symbolNames, never a bare s", async () => {
  const c = client();
  await trd.getOpenPositions(c, { symbol: "EURUSD" });
  assert.deepEqual(sent().symbolNames, ["EURUSD"]);
  assert.equal(sent().s, undefined);

  captured = [];
  await trd.getTradeHistory(c, { accountId: 7, symbol: "GBPUSD" });
  assert.deepEqual(sent().symbolNames, ["GBPUSD"]);
  assert.deepEqual(sent().accountFilter, { accounts: [7] });
});

test("account state and balances scope through accountFilter too", async () => {
  const c = client();
  await acct.getAccountState(c, { accountId: 42 });
  assert.equal(captured[0].url, "http://ts/api/v1/admin/accounts/states/query");
  assert.deepEqual(sent().accountFilter, { accounts: [42] });

  captured = [];
  globalThis.fetch = (async (url: any, init: any) => {
    captured.push({ url: String(url), body: init?.body });
    const payload = String(url).includes("/accounts/query")
      ? { accounts: [{ id: 11 }, { id: 12 }] }
      : {};
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as any;
  await acct.getBalances(c);
  const statesCall = captured.find((x) => x.url.includes("/states/query"))!;
  assert.deepEqual(JSON.parse(statesCall.body!).accountFilter, { accounts: [11, 12] });
});

test("no filter supplied means no filter sent (server-wide)", async () => {
  await trd.getOpenPositions(client(), {});
  assert.deepEqual(sent(), {});
});
