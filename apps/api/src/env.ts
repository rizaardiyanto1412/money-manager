import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

let loaded = false;
export function loadEnv() {
  if (loaded) return;
  loaded = true;
  dotenvConfig({ quiet: true });
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  loadEnv();
  return envSchema.parse(process.env);
}
