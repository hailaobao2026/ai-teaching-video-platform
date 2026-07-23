# Base image can be overridden: --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm
ARG NODE_IMAGE=node:22-bookworm
FROM ${NODE_IMAGE}

# system deps for rendering / media
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv ffmpeg \
    # Chrome/headless-shell runtime libs required by HyperFrames
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libx11-6 \
    libxext6 libxcb1 libx11-xcb1 fonts-noto-cjk ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && python3 -m pip install --no-cache-dir --break-system-packages \
         "edge-tts>=6.1.0" \
    && python3 -c "import edge_tts; print('edge-tts ok')"

WORKDIR /app

# Install root + server deps first (better layer cache). Do NOT copy host node_modules.
COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/

# hyperframes postinstall (onnxruntime) is flaky; install with ignore-scripts then ensure bin exists.
RUN npm install --omit=dev --ignore-scripts || true \
 && npm --prefix server install --omit=dev --ignore-scripts \
 && npm --prefix server rebuild --ignore-scripts || true

# App source only (context excludes node_modules/uploads via .dockerignore)
COPY . .

# Ensure runtime dirs exist inside image; uploads are usually mounted as volumes.
RUN mkdir -p server/uploads/videos server/uploads/artifacts server/uploads/covers server/data/jobs \
 && rm -rf server/node_modules/hyperframes 2>/dev/null || true

# If hyperframes ended up as a broken host symlink in any residual path, force reinstall package only.
RUN if [ ! -f server/node_modules/hyperframes/package.json ]; then \
      npm --prefix server install hyperframes@0.7.64 --omit=dev --ignore-scripts ; \
    fi \
 && test -e server/node_modules/.bin/hyperframes || \
      ln -sf ../hyperframes/bin/hyperframes.mjs server/node_modules/.bin/hyperframes \
 && chmod +x server/node_modules/hyperframes/bin/hyperframes.mjs server/node_modules/.bin/hyperframes 2>/dev/null || true

ENV NODE_ENV=production \
    PORT=3002 \
    USE_MYSQL=true \
    PYTHONUNBUFFERED=1

EXPOSE 3002
CMD ["node", "server/index.js"]