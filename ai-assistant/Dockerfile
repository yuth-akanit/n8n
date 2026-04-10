# Step 1: Base builder image
FROM node:18-alpine AS builder

WORKDIR /app

# Enable corepack for fast npm/pnpm/yarn (or we can just use npm)
# COPY package.json and lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy remaining source code
COPY . .

# Build the project (requires standalone next.config.mjs)
RUN npm run build

# Step 2: Production runtime image
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# IMPORTANT: Provide proper env variables at runtime via docker-compose

CMD ["node", "server.js"]
