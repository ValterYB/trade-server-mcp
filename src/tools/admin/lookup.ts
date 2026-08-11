// Single-record lookup with a query fallback.
//
// The admin API documents `GET /admin/<res>/get/{id}` for positions, trades and transfers, but
// some server builds do not serve those routes (observed live: every id, including a nonexistent
// one, answers 502 — while the same records come back fine from `/admin/<res>/query`). Reading a
// record is the first step of the position/trade maintenance plans, so a tool that only knew the
// get-by-id route would be unusable on those servers.
//
// So: try the documented route first (cheap, exact), and on ANY failure fall back to the query
// endpoint and pick the record out of the collection. Config resources (symbols, groups, clients,
// …) do serve get/{id} and are unaffected — this helper is only for the book records.

import { RestClient } from "../../rest-client.js";

type Rec = Record<string, unknown>;

export interface LookupSpec {
  /** Human label used in the not-found message, e.g. "position". */
  label: string;
  /** Documented single-record path, e.g. `/admin/positions/get/123`. */
  getPath: string;
  /** Collection endpoint used as the fallback, e.g. `/admin/positions/query`. */
  queryPath: string;
  /** Body for the fallback query (narrow it with the account when the caller supplied one). */
  queryBody: Rec;
  /** Key holding the array in the query response, e.g. "positions". */
  collectionKey: string;
}

export async function fetchRecord(client: RestClient, spec: LookupSpec, id: number): Promise<Rec> {
  try {
    return await client.get<Rec>(spec.getPath);
  } catch {
    // fall through to the collection query
  }

  const res = (await client.post(spec.queryPath, spec.queryBody)) as Rec;
  const collection = (res?.[spec.collectionKey] ?? res) as unknown;
  const list: Rec[] = Array.isArray(collection) ? (collection as Rec[]) : [];
  const found = list.find((r) => Number(r.id) === Number(id));
  if (found) return found;

  throw new Error(
    `No ${spec.label} with id ${id} was found. The server did not serve ${spec.getPath}, and it ` +
      `is not in the ${spec.collectionKey} returned by ${spec.queryPath}` +
      (spec.queryBody.A === undefined
        ? " — pass accountId to narrow the search (older records may fall outside the default page)."
        : ` for account ${spec.queryBody.A}.`),
  );
}
