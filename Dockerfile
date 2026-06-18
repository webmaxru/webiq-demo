# syntax=docker/dockerfile:1

# ---- Build stage: build both workspaces (web SPA + server) ----
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) using the workspace manifests for cacheable layers
COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci

# Copy sources and build (root script builds server then web)
COPY server ./server
COPY web ./web
RUN npm run build

# ---- Runtime stage: server only, serving the API + built SPA ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

# Install production dependencies only
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev && npm cache clean --force

# Bring in compiled server and the static SPA bundle.
# server/src/index.ts resolves the SPA at <serverDist>/../../web/dist => /app/web/dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

# Run as the built-in non-root node user
USER node

EXPOSE 8080
CMD ["node", "server/dist/index.js"]
