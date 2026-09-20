# syntax=docker/dockerfile:1

# ---- Build stage: compile the API server only ----
# The React frontend is built separately and hosted by Azure Static Web Apps.
FROM node:22-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) using the workspace manifests for cacheable layers
COPY package.json package-lock.json tsconfig.base.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci

# Copy and build only the backend workspace.
COPY server ./server
RUN npm run build:server

# ---- Runtime stage: API server only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080

# Install production dependencies only
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev && npm cache clean --force

# Bring in the compiled API server. No frontend assets are included in the ACA image.
COPY --from=build /app/server/dist ./server/dist

# Run as the built-in non-root node user
USER node

EXPOSE 8080
CMD ["node", "server/dist/index.js"]
