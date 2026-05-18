import { z } from "zod";
import { RestClient } from "../rest-client.js";

export const getGroupsSchema = z.object({});

export async function getGroups(client: RestClient) {
  return client.get("/admin/groups/query");
}

export const getGroupSchema = z.object({
  groupId: z.number().describe("Group unique identifier"),
});

export async function getGroup(
  client: RestClient,
  params: z.infer<typeof getGroupSchema>
) {
  return client.get(`/admin/groups/get/${params.groupId}`);
}

export const getClientsSchema = z.object({});

export async function getClients(client: RestClient) {
  return client.get("/admin/clients/query");
}

export const getOrderRoutingSchema = z.object({});

export async function getOrderRouting(client: RestClient) {
  return client.get("/admin/routing/query");
}

export const setOrderRoutingSchema = z.object({
  version: z.number().describe("Current routing config version (get from get_order_routing)"),
  routing: z
    .array(
      z.object({
        a: z.array(z.record(z.unknown())).describe("Actions array (e.g. [{type:'Execute',connectorId:1}])"),
        f: z.array(z.record(z.unknown())).optional().describe("Filters array (optional)"),
      })
    )
    .describe("Array of routing rules"),
});

export async function setOrderRouting(
  client: RestClient,
  params: z.infer<typeof setOrderRoutingSchema>
) {
  return client.post("/admin/routing/edit", {
    version: params.version,
    routing: params.routing,
  });
}

export const addRoutingRuleSchema = z.object({
  actions: z.array(z.record(z.unknown())).describe("Actions array (e.g. [{type:'Execute',connectorId:1}])"),
  filters: z.array(z.record(z.unknown())).optional().describe("Filters array (optional, e.g. [{type:'Symbol',value:'EURUSD'}])"),
});

export async function addRoutingRule(
  client: RestClient,
  params: z.infer<typeof addRoutingRuleSchema>
) {
  // Get current routing
  const current = (await client.get("/admin/routing/query")) as {
    version: number;
    routing: Array<{ a: unknown[]; f?: unknown[] }>;
  };

  const newRule: { a: unknown[]; f?: unknown[] } = { a: params.actions };
  if (params.filters) newRule.f = params.filters;

  const updatedRouting = [...(current.routing || []), newRule];

  return client.post("/admin/routing/edit", {
    version: current.version,
    routing: updatedRouting,
  });
}

export const removeRoutingRuleSchema = z.object({
  index: z.number().describe("Zero-based index of the routing rule to remove (use get_order_routing to see current rules)"),
});

export async function removeRoutingRule(
  client: RestClient,
  params: z.infer<typeof removeRoutingRuleSchema>
) {
  // Get current routing
  const current = (await client.get("/admin/routing/query")) as {
    version: number;
    routing: Array<{ a: unknown[]; f?: unknown[] }>;
  };

  const routing = current.routing || [];
  if (params.index < 0 || params.index >= routing.length) {
    throw new Error(`Invalid index ${params.index}. Current routing has ${routing.length} rules (0-${routing.length - 1}).`);
  }

  const removed = routing[params.index];
  const updatedRouting = routing.filter((_, i) => i !== params.index);

  await client.post("/admin/routing/edit", {
    version: current.version,
    routing: updatedRouting,
  });

  return { removed, remainingRules: updatedRouting.length };
}

export const getLiquidityConnectorsSchema = z.object({});

export async function getLiquidityConnectors(client: RestClient) {
  return client.get("/admin/liquidity/query");
}

export const getSymbolDetailsSchema = z.object({
  symbolId: z.number().describe("Symbol unique identifier"),
});

export async function getSymbolDetails(
  client: RestClient,
  params: z.infer<typeof getSymbolDetailsSchema>
) {
  return client.get(`/admin/symbols/get/${params.symbolId}`);
}

export const healthCheckSchema = z.object({});

export async function healthCheck(client: RestClient) {
  return client.get("/now");
}
