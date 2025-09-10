# Use Node 20 if possible; Node 18 is EOL, but 18 works if you must.
FROM node:20-alpine

# Prisma on Alpine needs OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

# Install deps (keep dev deps so 'prisma' and 'remix-serve' exist at runtime)
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# (Optional) You can drop this; removing it might fail if it's only a dev dep.
# RUN npm remove @shopify/cli || true

# Copy source
COPY . .

# Build app and bake Prisma client for linux-musl
RUN npm run build && npx prisma generate

# App Runner usually routes to $PORT; use 8080 for clarity
ENV PORT=8080
EXPOSE 8080

# Run Prisma prepare (deploy or db push), then start Remix
CMD ["npm", "run", "start:apprunner"]
