# money-manager

Personal money manager — expenses, income, transfers, budgets — with a web/mobile app and a first-class **MCP server** so agents can submit expenses for you. Modeled on the Realbyte *Money Manager Expense & Budget* workflow.

## Layout

| Path | What |
| --- | --- |
| `apps/api` | REST API — Hono + Drizzle + Postgres. Auth (JWT + scoped API keys), CRUD for accounts/categories/transactions/budgets/recurring/bookmarks, stats |
| `apps/mcp` | MCP server — `@modelcontextprotocol/server` v2, stdio + streamable HTTP |
| `apps/mobile` | Expo app — iOS + Android + web from one codebase (expo-router, RN Paper, react-query) |
| `packages/shared` | zod schemas + types shared by api, mcp, mobile |

Money is always integer **minor units** (`amountMinor`) — no floats.

## Quick start

```bash
cp .env.example .env            # set JWT_SECRET
npm install
npm run db:up                   # postgres in docker
npm run db:migrate              # apply migrations
npm run dev:api                 # api on :8787
```

Run the app (web):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8787 npm run web -w apps/mobile
```

`npm run android` / `npm run ios` (workspace `apps/mobile`) for native via Expo Go / dev builds.

Create a user + API key, then run the MCP server:

```bash
curl -X POST localhost:8787/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}'

TOKEN=...                       # accessToken from register/login
curl -X POST localhost:8787/api/api-keys \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"mcp","scopes":["read","write"]}'

MONEY_MANAGER_API_KEY=mm_live_... npm run dev:mcp   # http on :8788
# or stdio for local agents:
MCP_TRANSPORT=stdio MONEY_MANAGER_API_KEY=mm_live_... npm run dev:mcp
```

## MCP tools

`add_expense`, `add_income`, `add_transfer`, `list_transactions`, `get_summary`, `get_budget_status`, `list_accounts`, `list_categories`.

Write tools take **account/category names or UUIDs** — an agent can say `add_expense { amountMinor: 45000, account: "Cash", category: "Food", date: "2026-09-22", memo: "lunch" }` and names resolve server-side.

Remote endpoint: `POST http://<host>:8788/mcp` with `Authorization: Bearer mm_live_...`. Add to any MCP client as a streamable-HTTP server.

## Deploy

`docker compose up -d` runs postgres + api + mcp. Put them behind your TLS reverse proxy; expose `/mcp` only to your agents.

## Scripts

`npm run typecheck`, `npm run lint`, `npm test` (per workspace). Integration tests need `DATABASE_URL` (start postgres first). The mobile app typechecks via `tsc`; run it with `expo start`.
