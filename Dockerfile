# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: Build Next.js and bundle server
FROM node:22-alpine AS builder
WORKDIR /app

# Build-time environment variables for Next.js
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npx esbuild src/server/index.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/index.js --minify --sourcemap \
    --external:next --external:sharp --external:lightningcss --external:isomorphic-dompurify
RUN npx esbuild ./scripts/migrate.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/migrate.mjs --format=esm --minify \
    --external:postgres --external:drizzle-orm
RUN npx esbuild ./scripts/demo-seed.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/demo-seed.mjs --format=esm --minify \
    --external:postgres --external:drizzle-orm
RUN npx esbuild ./scripts/reset-demo.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/reset-demo.mjs --format=esm --minify \
    --external:postgres --external:drizzle-orm

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create uploads directory structure for volume mount
# These directories will be populated when the uploads_data volume is mounted
RUN mkdir -p ./public/uploads/attachments \
             ./public/uploads/avatars \
             ./public/uploads/emoji

# Copy bundled server
COPY --from=builder /app/dist-server ./

# Copy migration files
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Copy next module for custom server
COPY --from=builder /app/node_modules/next ./node_modules/next

# Copy modules for migrations
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

# Copy isomorphic-dompurify and dependencies (external to esbuild)
COPY --from=builder /app/node_modules/isomorphic-dompurify ./node_modules/isomorphic-dompurify
COPY --from=builder /app/node_modules/dompurify ./node_modules/dompurify


# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["node", "index.js"]
