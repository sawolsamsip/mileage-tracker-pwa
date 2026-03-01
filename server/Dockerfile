FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY index.js ./
ENV PORT=3131
EXPOSE 3131
VOLUME /app/data
ENV DATA_DIR=/app/data
CMD ["node", "index.js"]
