# Stage 1: Build the app
FROM node:20-alpine AS builder

# Explicitly set shell (fixes Coolify build issues)
SHELL ["/bin/sh", "-c"]

# Install CA certificates for HTTPS connections (needed for Supabase)
RUN apk add --no-cache ca-certificates

# Set working directory
WORKDIR /app

# Accept build arguments for environment variables
ARG DATABASE_URL
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY
ARG JWT_SECRET
ARG CRON_SECRET
ARG APP_URL

# Set build-time environment variables (use dummy values if not provided)
ENV DATABASE_URL=${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}
ENV SUPABASE_URL=${SUPABASE_URL:-https://dummy.supabase.co}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-dummy_key}
ENV JWT_SECRET=${JWT_SECRET:-dummy_jwt_secret}
ENV CRON_SECRET=${CRON_SECRET:-dummy_cron_secret}
ENV APP_URL=${APP_URL:-http://localhost:3000}
# Don't set NODE_ENV=production here - we need devDependencies for build!

# Copy package files
COPY package*.json ./

# Install ALL dependencies including devDependencies (needed for build)
RUN npm install --legacy-peer-deps

# Now set NODE_ENV for the build
ENV NODE_ENV=production

# Copy all source files
COPY . .

# Build Next.js app
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

# Explicitly set shell (fixes Coolify build issues)
SHELL ["/bin/sh", "-c"]

# Install CA certificates and curl for HTTPS connections (needed for Supabase)
RUN apk add --no-cache ca-certificates curl

# Set working directory
WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built files and node_modules from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose default Next.js production port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the Next.js app
CMD ["npm", "start"]

