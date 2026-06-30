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

# Build the Next.js app (standalone output — copies static + public automatically)
RUN npm run build

# Copy the Python pipeline scripts into the standalone output
# (Next.js standalone doesn't include non-public, non-imported files)
RUN cp -r scripts .next/standalone/scripts

# Install deno dependencies for the PO Token provider
# (node_modules is gitignored, so we install it at build time)
WORKDIR /app/.next/standalone/scripts/pot-provider
RUN deno install --allow-scripts=npm:canvas --frozen || \
    echo "deno install failed — PO token script mode may not work, but HTTP mode will still function"

# Create cache directory for media bundles
RUN mkdir -p /data/media
ENV VAULT_CACHE_DIR=/data/media

# Expose port (Render sets $PORT)
ENV PORT=3000
EXPOSE 3000

# Run from the standalone directory so all paths resolve correctly
WORKDIR /app/.next/standalone

# Start the Next.js standalone server
CMD ["node", "server.js"]
