# AFTAB — multi-session WhatsApp bot.
FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=12637

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Session credentials live here so a Heroku restart can still reconnect.
RUN mkdir -p /app/session
VOLUME ["/app/session"]

EXPOSE 12637

CMD ["node", "index.js"]
