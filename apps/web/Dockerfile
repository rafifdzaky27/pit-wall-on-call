FROM node:22-alpine AS build
RUN npm install -g pnpm@10.12.2
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
ARG GIT_SHA=dev
ENV VITE_GIT_SHA=$GIT_SHA
# Empty means analytics off (the tracker script is never loaded).
ARG UMAMI_WEBSITE_ID=
ENV VITE_UMAMI_WEBSITE_ID=$UMAMI_WEBSITE_ID
RUN pnpm --filter @pitwall/web build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
