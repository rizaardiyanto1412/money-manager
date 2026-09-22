FROM node:24-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
RUN npm install

FROM deps AS runtime
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /repo/apps/api
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
