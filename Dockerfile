# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Stage 2: Build Next.js and bundle server
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npx esbuild src/server/index.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/index.js --minify --sourcemap \
    --external:next --external:sharp --external:lightningcss
RUN npx esbuild ./scripts/migrate.ts --bundle --platform=node --target=node22 \
    --outfile=dist-server/migrate.js --minify

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

# Copy bundled server
COPY --from=builder /app/dist-server ./

# Copy migration files
COPY --from=builder /app/src/db/migrations ./src/db/migrations

# Copy next module for custom server
COPY --from=builder /app/node_modules/next ./node_modules/next

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

CMD ["node", "index.js"]
