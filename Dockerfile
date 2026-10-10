# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
# (skipped: VITE_SUPABASE_ANON_KEY is the public client key, shipped to every browser)

# GlasApp production image: one Express process that serves the API and the built client.
# Build:  docker build -t glasapp --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... .
# Run:    needs DATABASE_URL, SUPABASE_URL and SUPABASE_ANON_KEY at runtime. See docs/deploy.md.

# ---- build: full dependencies, client bundle (dist/public) and server bundle (dist/index.js)
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Vite bakes these into the client bundle at build time. The anon key is public by design.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY . .
RUN npm run build

# ---- runtime: production dependencies only
FROM node:20-slim AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/dist ./dist
# public/assets (GeoJSON) is served from this path relative to the working directory.
COPY public ./public

# public/uploads holds profile pictures. Mount a volume here; creating it owned by `node`
# means a fresh named volume starts out writable by the non-root user.
RUN mkdir -p public/uploads && chown node:node public/uploads

ENV NODE_ENV=production \
    PORT=5000
USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
