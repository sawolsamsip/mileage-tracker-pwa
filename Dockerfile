# Stage 1: Build PWA
FROM node:20-alpine AS pwa
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_TESLA_CLIENT_ID
ARG VITE_TESLA_REDIRECT_URI
ENV VITE_TESLA_CLIENT_ID=$VITE_TESLA_CLIENT_ID
ENV VITE_TESLA_REDIRECT_URI=$VITE_TESLA_REDIRECT_URI
RUN npm run build

# Stage 2: Single server (PWA static + midnight sync API)
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev
COPY server/index.js ./
COPY --from=pwa /app/dist ./dist
ENV PORT=3131
ENV STATIC_DIR=/app/dist
ENV DATA_DIR=/app/data
VOLUME /app/data
EXPOSE 3131
CMD ["node", "index.js"]
