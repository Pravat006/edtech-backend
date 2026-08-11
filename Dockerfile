ARG NODE_VERSION=20.14.0

# Builder 
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source
COPY . .

# Generate Prisma client, then compile TS
RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# Production 
FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy only what we need from builder
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/generated     ./generated
COPY --from=builder /app/package.json  ./package.json
COPY --from=builder /app/prisma        ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node -r module-alias/register dist/index.js"]
