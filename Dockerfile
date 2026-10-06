# AFTAB — multi-session WhatsApp bot.
FROM node:22-slim

ENV NODE_ENV=production
# Fallback port for local runs only. On Heroku the platform injects $PORT and
# this value is ignored.
ENV PORT=12637

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Session credentials live here. Heroku runs containers as a non-root user and
# does not support VOLUME, so make the folder writable for that user instead.
RUN mkdir -p /app/session && chmod 777 /app/session

# EXPOSE is not supported by Heroku's container runtime; the process reads $PORT.
# It is kept only as documentation for local `docker run -p`.

CMD ["node", "index.js"]
