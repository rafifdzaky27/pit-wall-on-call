FROM node:22-alpine AS build
RUN npm install -g pnpm@10.12.2
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm --filter @pitwall/api build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 8787
CMD ["node", "dist/server.js"]
