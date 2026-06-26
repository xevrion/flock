# Build stage: compile TypeScript to JS
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests so pnpm can resolve deps correctly
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# The server tsconfig extends the root base config, so it must be present.
COPY tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/

# Install production + dev dependencies for the server package
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --filter @xevrion/flock-server...

# Copy source and compile
COPY packages/server ./packages/server
RUN pnpm --filter @xevrion/flock-server build

# Deploy stage: use pnpm deploy to produce a self-contained package with only
# the production dependencies needed at runtime, resolving workspace: references.
FROM node:22-alpine AS deployer

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/server/tsconfig.json ./packages/server/
# core is a workspace devDep; pnpm deploy needs to find it in the workspace.
COPY packages/core/package.json ./packages/core/

# Install all workspace deps so pnpm can resolve cross-package references.
RUN pnpm install --frozen-lockfile --filter @xevrion/flock-server...

# pnpm deploy produces a minimal self-contained bundle with only prod deps.
COPY packages/server/dist ./packages/server/dist
RUN pnpm --filter @xevrion/flock-server deploy --prod --legacy /deploy

# Runtime stage: just the deployed bundle
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deployer /deploy .

EXPOSE 8787

CMD ["node", "dist/cli.js"]
