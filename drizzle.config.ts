// Plain object export (no `drizzle-kit` import) so the config loads even when
// drizzle-kit runs via npx before project dependencies are installed.
export default {
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
};
