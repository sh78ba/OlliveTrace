FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Copy package package.jsons
COPY apps/web/package.json ./apps/web/
COPY packages/sdk/package.json ./packages/sdk/

# Install dependencies at monorepo root
RUN npm install

# Copy source code
COPY . .

# Build SDK first, then web
RUN npm run build -w packages/sdk
RUN npm run build -w apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone Next.js server
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
