import { z } from "zod";
import { RestClient } from "../../rest-client.js";

export const getAccountStateSchema = z.object({});

export async function getAccountState(client: RestClient) {
  // The server accepts /account/state ONLY with a completely empty request
  // body — even {} is rejected with 400 (verified live). No body argument.
  return client.post("/account/state");
}

export const getBalancesSchema = z.object({});

export async function getBalances(client: RestClient) {
  return client.get("/account/balances");
}

export const getLimitsSchema = z.object({});

export async function getLimits(client: RestClient) {
  return client.get("/limits");
}

export const getTransferHistorySchema = z.object({
  from: z.number().optional().describe("Start time (microseconds since epoch)"),
  to: z.number().optional().describe("End time (microseconds since epoch)"),
  limit: z.number().optional().describe("Max results"),
});

export async function getTransferHistory(
  client: RestClient,
  params: z.infer<typeof getTransferHistorySchema>,
) {
  const body: Record<string, unknown> = {};
  if (params.from !== undefined) body.from = params.from;
  if (params.to !== undefined) body.to = params.to;
  if (params.limit !== undefined) body.maxResults = params.limit;
  return client.post("/transfers", body);
}

export const getAccountSummarySchema = z.object({});

export async function getAccountSummary(client: RestClient) {
  const [state, positions, orders] = await Promise.all([
    // /account/state requires a completely empty body — see getAccountState.
    client.post("/account/state"),
    // Explicit large page size — avoid server default page limits silently
    // truncating a trader's open positions or working orders in the summary.
    client.post("/positions", { maxResults: 1000 }),
    client.post("/orders/open", { maxResults: 1000 }),
  ]);
  return { state, positions, orders };
}
