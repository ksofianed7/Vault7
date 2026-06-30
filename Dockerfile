# Vault — Docker image
# Node.js + Python 3 + ffmpeg + yt-dlp + deno + BgUtils PO Token provider

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

# Install deno — REQUIRED by yt-dlp for YouTube nsig signature decoding.
RUN curl -fsSL https://deno.land/install.sh | DENO_DIR=/usr/local/deno sh && \
    ln -s /usr/local/deno/bin/deno /usr/local/bin/deno
ENV DENO_DIR=/usr/local/deno
ENV PATH="/usr/local/deno/bin:${PATH}"

# Install yt-dlp (pre-release/dev version has the latest YouTube fixes) +
# curl_cffi (for TikTok/Instagram impersonation) +
# bgutil-ytdlp-pot-provider (PO Token plugin — bypasses YouTube bot detection
# WITHOUT cookies, same approach as Seal/cobalt.tools)
RUN pip3 install --break-system-packages --no-cache-dir --pre \
    "yt-dlp[default]" \
    curl_cffi \
    pycryptodomex \
    bgutil-ytdlp-pot-provider

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
RUN deno install --allow-scripts=npm:canvas --frozen || true

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
