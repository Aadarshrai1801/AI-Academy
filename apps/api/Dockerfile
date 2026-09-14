# Multi-stage build for the API (+ BullMQ worker).
# The final image includes ffmpeg because the video-render worker shells out to it.
#
#   docker build -t ai-academy-api ./apps/api
#   docker run --env-file apps/api/.env -p 4000:4000 ai-academy-api
#
# Worker mode (all queues: question-gen + video-render + call-timers):
#   docker run --env-file apps/api/.env ai-academy-api node dist/worker.js

# ── Stage 1: dependencies (incl. dev, needed to compile TypeScript) ─────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ── Stage 3: production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runtime
# ffmpeg for the explainer-video pipeline (video worker runs in this image).
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run unprivileged; storage/ is the local video fallback directory.
RUN mkdir -p storage/videos storage/tmp && chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
