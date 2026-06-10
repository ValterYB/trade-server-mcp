import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RestClient } from "../rest-client.js";
import { StaticCredentials } from "../auth/admin-auth.js";
import * as a from "../tools/client/account.js";

let captured: { url: string; method: string; body?: string }[] = [];

beforeEach(() => {
  captured = [];
  globalThis.fetch = (async (url: any, init: any) => {
    captured.push({ url: String(url), method: init?.method ?? "GET", body: init?.body });
    return new Response("{}", { status: 200 });
  }) as any;
});

const client = () => new RestClient("http://ts", new StaticCredentials("K", "S"));

test("getAccountState POSTs /account/state with NO body (server rejects any payload)", async () => {
  await a.getAccountState(client());
  assert.equal(captured[0].url, "http://ts/api/v1/account/state");
  assert.equal(captured[0].method, "POST");
  assert.equal(captured[0].body, undefined);
});

test("getBalances GETs /account/balances", async () => {
  await a.getBalances(client());
  assert.equal(captured[0].url, "http://ts/api/v1/account/balances");
  assert.equal(captured[0].method, "GET");
});

test("getLimits GETs /limits", async () => {
  await a.getLimits(client());
  assert.equal(captured[0].url, "http://ts/api/v1/limits");
});

test("getTransferHistory POSTs /transfers with filter", async () => {
  await a.getTransferHistory(client(), { from: 1, limit: 5 });
  assert.equal(captured[0].url, "http://ts/api/v1/transfers");
  assert.deepEqual(JSON.parse(captured[0].body!), { from: 1, maxResults: 5 });
});

test("getAccountSummary fans out to state (no body) + positions + open orders", async () => {
  await a.getAccountSummary(client());
  const calls = captured
    .map((c) => ({ url: c.url, body: c.body === undefined ? undefined : JSON.parse(c.body) }))
    .sort((a, b) => a.url.localeCompare(b.url));
  assert.deepEqual(calls, [
    { url: "http://ts/api/v1/account/state", body: undefined }, // empty body required
    { url: "http://ts/api/v1/orders/open", body: { maxResults: 1000 } },
    { url: "http://ts/api/v1/positions", body: { maxResults: 1000 } },
  ]);
});
