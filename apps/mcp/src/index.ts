#!/usr/bin/env node
import { createMcpHandler, type AuthInfo } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildServer } from './server.js';
import { MoneyManagerClient } from './api-client.js';
import { getEnv } from './env.js';

type PackageJson = { version: string };
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as PackageJson;

function clientFor(apiKey: string, baseUrl: string): MoneyManagerClient {
  return new MoneyManagerClient({ baseUrl, apiKey });
}

/** HTTP transport: streamable MCP over a web-standard fetch handler. */
export function startHttp(env: ReturnType<typeof getEnv>) {
  const handler = createMcpHandler(
    (ctx) =>
      buildServer({
        client: clientFor(
          (ctx.authInfo as { token?: string } | undefined)?.token ?? env.MONEY_MANAGER_API_KEY ?? '',
          env.MONEY_MANAGER_API_URL,
        ),
        version: packageJson.version,
      }),
    { legacy: 'stateless' },
  );

  const app = new Hono();
  app.get('/health', (c) => c.json({ ok: true, service: 'money-manager-mcp' }));
  app.all('/mcp', async (c) => {
    const bearer = c.req.header('authorization');
    const token = bearer?.startsWith('Bearer ')
      ? bearer.slice(7)
      : c.req.header('x-api-key');
    if (!token) {
      return c.json({ error: 'Missing API key — send Authorization: Bearer <mm_live_...>' }, 401);
    }
    return handler.fetch(c.req.raw, {
      authInfo: { token, clientId: 'api-key', scopes: [] } as AuthInfo,
    });
  });

  serve({ fetch: app.fetch, port: env.MCP_PORT }, (info) => {
    console.log(`money-manager-mcp listening on :${info.port} (POST /mcp)`);
  });
}

function startStdio(env: ReturnType<typeof getEnv>) {
  if (!env.MONEY_MANAGER_API_KEY) {
    console.error('MONEY_MANAGER_API_KEY is required for stdio transport');
    process.exit(1);
  }
  serveStdio(() =>
    buildServer({
      client: clientFor(env.MONEY_MANAGER_API_KEY!, env.MONEY_MANAGER_API_URL),
      version: packageJson.version,
    }),
  );
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);

if (isDirectRun) {
  const env = getEnv();
  if (process.env.MCP_TRANSPORT === 'stdio' || process.argv.includes('--stdio')) {
    startStdio(env);
  } else {
    startHttp(env);
  }
}
