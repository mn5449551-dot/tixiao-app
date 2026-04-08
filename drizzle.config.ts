import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: "./db/onion.db",
  },
});
