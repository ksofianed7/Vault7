# Vault — Docker image
# Node.js + Python 3 + ffmpeg + yt-dlp + deno + BgUtils PO Token provider
# Optimized for Render's free tier (512MB build memory limit)

FROM node:22-slim AS base

# Install system deps: ffmpeg, python3, pip, curl, unzip, ca-certificates, git
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    unzip \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Add swap space to handle memory pressure during pip builds (Render free tier = 512MB RAM)
RUN fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile || true

# Install deno — REQUIRED by yt-dlp for YouTube nsig signature decoding.
RUN curl -fsSL https://deno.land/install.sh | DENO_DIR=/usr/local/deno sh && \
    ln -s /usr/local/deno/bin/deno /usr/local/bin/deno
ENV DENO_DIR=/usr/local/deno
ENV PATH="/usr/local/deno/bin:${PATH}"

# Install Python packages ONE BY ONE so we can see which one fails.
# Using stable yt-dlp (not --pre) for reliability on Render.
RUN pip3 install --break-system-packages --no-cache-dir yt-dlp
RUN pip3 install --break-system-packages --no-cache-dir pycryptodomex
RUN pip3 install --break-system-packages --no-cache-dir bgutil-ytdlp-pot-provider
# curl_cffi is the heavy one (C extensions) — install last with minimal deps
RUN pip3 install --break-system-packages --no-cache-dir curl_cffi || \
    echo "curl_cffi install failed — continuing without impersonation (TikTok/IG may not work)"

# Working directory
WORKDIR /app

# Copy package files and install deps
COPY package.json bun.lock* ./
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Generate Prisma client BEFORE building Next.js
# (Next.js build imports @prisma/client, which must exist first)
RUN npx prisma generate

# Build the Next.js app (standalone output — copies static + public automatically)
RUN npm run build

# Copy the Prisma generated client into the standalone output
RUN cp -r node_modules/.prisma .next/standalone/node_modules/.prisma 2>/dev/null || true
RUN cp -r node_modules/@prisma/client .next/standalone/node_modules/@prisma/client 2>/dev/null || true

# Copy the Python pipeline scripts into the standalone output
# (Next.js standalone doesn't include non-public, non-imported files)
RUN cp -r scripts .next/standalone/scripts

# Install deno dependencies for the PO Token provider
# (node_modules is gitignored, so we install it at build time)
WORKDIR /app/.next/standalone/scripts/pot-provider
RUN deno install --allow-scripts=npm:canvas --frozen || \
    echo "deno install failed — PO token script mode may not work, but HTTP mode will still function"

# Create cache directory for media bundles + database
RUN mkdir -p /data/media /data/db
ENV VAULT_CACHE_DIR=/data/media
ENV DATABASE_URL=file:/data/db/vault.db

# Initialize the SQLite database
RUN cd /app && npx prisma db push --skip-generate || true

# Expose port
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Run from the standalone directory so all paths resolve correctly
WORKDIR /app/.next/standalone

# Start the Next.js standalone server (bind to 0.0.0.0 on Railway's PORT)
CMD ["sh", "-c", "node server.js -H 0.0.0.0 -p ${PORT:-3000}"]