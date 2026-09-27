import postgres from "postgres";

export function createDb(databaseUrl: string) {
  const sql = postgres(databaseUrl, { max: 5, connect_timeout: 5 });
  return {
    sql,
    ping: async () => {
      await sql`select 1`;
    },
  };
}
