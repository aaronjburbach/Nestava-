import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

export const sql = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(sql, { schema });

// Run a unit of work scoped to one tenant. Sets a transaction-local GUC that the
// RLS policies in sql/rls.sql read via current_setting('app.org_id'). This is what
// makes cross-tenant data leakage impossible at the database layer.
export async function withTenant<T>(orgId: string, fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return await fn(tx as unknown as typeof db);
  });
}
