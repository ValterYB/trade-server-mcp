// Generic read-modify-write (edit) and delete helpers for admin config resources.
//
// Every admin resource (symbols, groups, accounts, clients, liquidity connectors, …) shares one
// write contract, confirmed against the admin SDK:
//   - POST /admin/<res>/edit   — upsert; body = the full verbose object the get/query returns,
//     guarded by If-Match (ETag == the resource version).
//   - POST /admin/<res>/delete — body = { <res>Id, version }, also guarded by If-Match.
// RestClient keys ETags by request path, and the GET path differs from the write path, so the
// captured ETag is bridged onto the write path here (setEtag) before the POST.
//
// These helpers back the per-resource, task-shaped tools (update_<res>_plan/commit,
// delete_<res>_plan/commit) — the tool names, schemas, and descriptions stay hand-written.

import { RestClient } from "../../rest-client.js";
import { issuePlan, takeCommit } from "../../preview/plan-commit.js";

type Rec = Record<string, unknown>;

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// Fields the server assigns itself; echoing them back on an /edit is rejected as "Invalid body"
// (seen live on clients and trading accounts, whose read model carries them).
const SERVER_MANAGED = ["timeCreated", "timeModified"];
export function stripServerManaged(o: Rec): Rec {
  const r = { ...o };
  for (const k of SERVER_MANAGED) delete r[k];
  return r;
}

// Unconditional read: clear any ETag cached for this path first, so a repeated GET of the same
// resource returns 200 with a fresh ETag instead of 304 (RestClient sends If-None-Match and throws
// on 304). The fresh ETag is what the subsequent write sends as If-Match.
export async function readFresh(client: RestClient, path: string): Promise<Rec> {
  client.setEtag(path, "");
  return client.get<Rec>(path);
}

export interface ResourceSpec {
  /** Human label used in messages, e.g. "group", "trading account", "liquidity connector". */
  label: string;
  /** Read-one path for the resource id. */
  getPath: (id: number) => string;
  /** Upsert path. */
  editPath: string;
  /** Delete path. */
  deletePath: string;
  /** Identifier key in the delete body, e.g. "groupId", "accountId", "connectorId". */
  idKey: string;
  /** Optional display field to surface (e.g. "name"); omitted resources just show the id. */
  nameKey?: string;
}

/** Preview an edit: read current, apply a partial overlay, diff, stash for commit. */
export async function planResourceEdit(
  client: RestClient,
  spec: ResourceSpec,
  id: number,
  updates: Rec,
  tool: string,
) {
  const current = await readFresh(client, spec.getPath(id));
  const next: Rec = { ...current, ...updates };

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(updates)) {
    if (!sameValue(current[key], next[key])) changes[key] = { from: current[key], to: next[key] };
  }

  const name = spec.nameKey ? current[spec.nameKey] : undefined;
  if (Object.keys(changes).length === 0) {
    return {
      resource: spec.label,
      id,
      ...(name !== undefined ? { name } : {}),
      noChanges: true,
      message: `The requested values already match the ${spec.label}'s current configuration.`,
    };
  }

  const etag = client.getEtag(spec.getPath(id));
  const commitToken = issuePlan(
    { path: spec.editPath, object: stripServerManaged(next), etag },
    tool,
  );
  return {
    resource: spec.label,
    id,
    ...(name !== undefined ? { name } : {}),
    version: current.version,
    changes,
    commitToken,
    disclosure: `You are confirming a LIVE change to a ${spec.label}'s server-wide configuration via an AI assistant. Review the diff, then call the matching *_commit with this commitToken. Nothing is written until you commit.`,
  };
}

/** Preview a delete: read current (for version + display), stash { idKey, version } for commit. */
export async function planResourceDelete(
  client: RestClient,
  spec: ResourceSpec,
  id: number,
  tool: string,
) {
  const current = await readFresh(client, spec.getPath(id));
  const etag = client.getEtag(spec.getPath(id));
  const body: Rec = { [spec.idKey]: id, version: current.version };
  const commitToken = issuePlan({ path: spec.deletePath, body, etag }, tool);
  return {
    resource: spec.label,
    willDelete: {
      [spec.idKey]: id,
      ...(spec.nameKey ? { name: current[spec.nameKey] } : {}),
      version: current.version,
    },
    commitToken,
    disclosure: `You are confirming the LIVE DELETION of a ${spec.label} via an AI assistant. Review the target, then call the matching *_commit with this commitToken. Nothing is deleted until you commit.`,
  };
}

/**
 * Preview a create: build a new object (cloned from a template id and/or a provided object, with
 * overrides applied) with id/version forced to 0, and stash it for commit. Creates carry NO
 * If-Match (a new resource has no version to match) — commitResourceWrite clears any stale ETag
 * cached on the edit path from a prior update.
 */
export async function planResourceCreate(
  client: RestClient,
  spec: ResourceSpec,
  opts: { fromId?: number; object?: Rec; overrides?: Rec },
  tool: string,
) {
  const base =
    opts.fromId != null ? await readFresh(client, spec.getPath(opts.fromId)) : (opts.object ?? {});
  const next: Rec = { ...base, ...(opts.overrides ?? {}), id: 0, version: 0 };
  const commitToken = issuePlan({ path: spec.editPath, object: stripServerManaged(next) }, tool); // no etag → no If-Match
  return {
    resource: spec.label,
    action: "create",
    willCreate: next,
    commitToken,
    disclosure: `You are confirming the LIVE CREATION of a new ${spec.label} via an AI assistant. Review the object, then call the matching *_commit with this commitToken. Nothing is written until you commit.`,
  };
}

/**
 * Apply an edit, delete, or create previewed above. Single-use token consumption (takeCommit)
 * makes a retried commit unable to re-apply a stale write. For updates/deletes the captured ETag
 * is sent as If-Match; for creates (no ETag) any stale ETag cached on the path is cleared so no
 * If-Match leaks onto the new-resource write.
 */
export async function commitResourceWrite(client: RestClient, commitToken: string, tool: string) {
  const plan = takeCommit(commitToken, tool) as {
    path: string;
    object?: Rec;
    body?: Rec;
    etag?: string;
  };
  client.setEtag(plan.path, plan.etag ?? "");
  return client.post(plan.path, plan.object ?? plan.body ?? {});
}
