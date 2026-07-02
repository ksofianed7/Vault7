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

# Install deno — REQUIRED by yt-dlp for YouTube nsig + PO Token generation.
# Download directly instead of using the install script (more reliable in Docker).
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -o /tmp/deno.zip && \
    unzip /tmp/deno.zip -d /tmp && \
    mv /tmp/deno /usr/local/bin/deno && \
    chmod +x /usr/local/bin/deno && \
    rm /tmp/deno.zip
ENV DENO_DIR=/usr/local/deno
ENV PATH="/usr/local/bin:${PATH}"

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
# This MUST succeed — without it, YouTube downloads fail entirely
WORKDIR /app/.next/standalone/scripts/pot-provider
RUN deno install --allow-scripts=npm:canvas --frozen

# Verify deno is accessible
RUN deno --version

# Create cache directory for media bundles + database
RUN mkdir -p /data/media /data/db
ENV VAULT_CACHE_DIR=/data/media
ENV DATABASE_URL=file:/data/db/vault.db
ENV HOSTNAME=0.0.0.0

# Operator-side Instagram cookies (base64-encoded cookies.txt).
# Set this at runtime via your host's env var panel, NOT in the Dockerfile.
# Only needed for Instagram — YouTube and TikTok use the PO Token provider.
# Example: VAULT_COOKIES_B64=$(base64 -w0 cookies.txt)
ENV VAULT_COOKIES_B64=""

# Initialize the SQLite database
RUN cd /app && npx prisma db push --skip-generate || true

# Expose port (Railway/Render/Fly inject PORT automatically)
ENV PORT=3000
EXPOSE 3000

# Run from the standalone directory so all paths resolve correctly
WORKDIR /app/.next/standalone

# Start the Next.js standalone server — bind to 0.0.0.0 so the host proxy can reach it
CMD ["sh", "-c", "node server.js -H 0.0.0.0 -p ${PORT:-3000}"]
