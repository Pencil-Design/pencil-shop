# --- build stage ---
    FROM node:20-bookworm-slim AS build
    WORKDIR /app
    
    # Install deps
    COPY package*.json ./
    RUN npm ci
    
    # Generate Prisma client before copying the rest (needs prisma in deps/devDeps)
    COPY prisma ./prisma
    RUN npx prisma generate
    
    # Copy the rest and build
    COPY . .
    RUN npm run build
    
    # --- runtime stage ---
    FROM node:20-bookworm-slim
    WORKDIR /app
    ENV NODE_ENV=production
    
    # Minimal OS deps
    RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*
    
    # Copy built app + node_modules + prisma
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/prisma ./prisma
    COPY --from=build /app ./
    
    # Run migrations safely, then start your app
    # (Make sure prisma CLI is available: either in deps, or keep it in devDeps and this will use npx from node_modules/.bin)
    COPY <<'EOF' /app/entrypoint.sh
    #!/usr/bin/env bash
    set -e
    echo "Running Prisma migrate deploy..."
    npx prisma migrate deploy
    echo "Starting app..."
    exec npm run docker-start
    EOF
    RUN chmod +x /app/entrypoint.sh
    
    # Your app listens on 3000; tell App Runner this port later
    ENV PORT=3000
    EXPOSE 3000
    
    CMD ["/app/entrypoint.sh"]
    