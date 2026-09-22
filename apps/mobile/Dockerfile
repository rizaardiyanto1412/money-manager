# Builds the Expo web bundle and serves it via nginx (SPA fallback).
FROM node:24-bookworm-slim AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm install --legacy-peer-deps

COPY apps/mobile apps/mobile
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
RUN npx expo export --platform web --output-dir apps/mobile/dist -w apps/mobile 2>/dev/null \
  || (cd apps/mobile && npx expo export --platform web)

FROM nginx:alpine
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/mobile/dist /usr/share/nginx/html
EXPOSE 80
