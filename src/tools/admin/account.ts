import { z } from "zod";
import { RestClient } from "../../rest-client.js";

export const getAccountStateSchema = z.object({
  accountId: z.number().describe("Trading account ID (login)"),
});

export async function getAccountState(
  client: RestClient,
  params: z.infer<typeof getAccountStateSchema>,
) {
  const states = await client.post("/admin/accounts/states/query", {
    A: [params.accountId],
  });
  return states;
}

export const getAccountInfoSchema = z.object({
  accountId: z.number().describe("Trading account ID (login)"),
});

export async function getAccountInfo(
  client: RestClient,
  params: z.infer<typeof getAccountInfoSchema>,
) {
  return client.get(`/admin/accounts/get/${params.accountId}`);
}

export const getAllAccountsSchema = z.object({});

export async function getAllAccounts(client: RestClient) {
  return client.get("/admin/accounts/query");
}

export const cashTransferSchema = z.object({
  accountId: z.number().describe("Trading account ID"),
  amount: z.number().describe("Transfer amount"),
  type: z
    .enum([
      "Balance",
      "Credit",
      "Fee",
      "Adjustment",
      "Bonus",
      "CreditBonus",
      "Commission",
      "Interest",
      "Dividend",
      "Tax",
    ])
    .describe("Transfer type (Balance = deposit/withdrawal, use negative amount for withdrawal)"),
  currency: z.string().optional().default("USD").describe("Currency or asset name"),
  comment: z.string().optional().describe("Transfer comment"),
});

export async function cashTransfer(client: RestClient, params: z.infer<typeof cashTransferSchema>) {
  const body: Record<string, unknown> = {
    A: params.accountId,
    a: params.amount,
    T: params.type,
    c: params.currency || "USD",
    t: Date.now() * 1000, // microseconds
  };
  if (params.comment) body.ct = params.comment;

  return client.post("/admin/transfers/edit", body);
}

export const getTransferHistorySchema = z.object({
  accountId: z.number().optional().describe("Filter by account ID"),
  from: z.number().optional().describe("Start time (microseconds since epoch)"),
  to: z.number().optional().describe("End time (microseconds since epoch)"),
  limit: z.number().optional().describe("Max results"),
});

export async function getTransferHistory(
  client: RestClient,
  params: z.infer<typeof getTransferHistorySchema>,
) {
  const body: Record<string, unknown> = {};
  if (params.accountId !== undefined) body.A = params.accountId;
  if (params.from !== undefined) body.from = params.from;
  if (params.to !== undefined) body.to = params.to;
  if (params.limit !== undefined) body.limit = params.limit;

  return client.post("/admin/transfers/query", body);
}

export const getBalancesSchema = z.object({});

export async function getBalances(client: RestClient) {
  // Get all accounts
  const result = (await client.get("/admin/accounts/query")) as {
    accounts?: Array<{ id?: number }>;
  };
  const accounts = result.accounts ?? [];

  // Extract account IDs
  const ids: number[] = [];
  for (const acc of accounts) {
    if (acc.id !== undefined) ids.push(acc.id);
  }

  if (ids.length === 0) return { accounts, note: "No account IDs found" };

  // Query states for all accounts at once
  const states = await client.post("/admin/accounts/states/query", { A: ids });
  return states;
}
