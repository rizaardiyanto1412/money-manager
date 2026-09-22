import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  dotenvConfig({ quiet: true });
}

const envSchema = z.object({
  MONEY_MANAGER_API_URL: z.string().url().default('http://localhost:8787'),
  // required only for stdio transport — HTTP forwards the caller's key per request
  MONEY_MANAGER_API_KEY: z.string().min(1).optional(),
  MCP_PORT: z.coerce.number().int().min(1).max(65535).default(8788),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  loadEnv();
  return envSchema.parse(process.env);
}
