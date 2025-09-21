# Bun + Prisma app container
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install deps first (better layer caching)
COPY package.json bun.lockb* ./
RUN bun install

# Copy source
COPY . .

# Entrypoint script to auto-run prisma migrate deploy and start app
COPY ./scripts/entrypoint.sh /usr/src/app/scripts/entrypoint.sh
RUN chmod +x /usr/src/app/scripts/entrypoint.sh

# Generate Prisma client
RUN bunx prisma generate

# Expose ports
EXPOSE 3001 5173

ENTRYPOINT ["/usr/src/app/scripts/entrypoint.sh"]
