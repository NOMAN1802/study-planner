import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Direct (session-mode, port 5432) connection for migrations only.
    url: env("DIRECT_URL"),
  },
});
