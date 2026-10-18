# Contexto de build: la RAÍZ del repositorio (railway.json apunta a este archivo).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
# npm ci exige el package.json de todos los workspaces del lockfile, aunque solo se construya el backend.
COPY frontend/package.json frontend/
RUN npm ci
COPY tsconfig.base.json ./
COPY shared shared
COPY backend backend
RUN npm run build -w backend

FROM node:22-alpine AS run
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend
COPY --from=build /app/backend/dist backend/dist
USER node
EXPOSE 3000
# Railway inyecta PORT; el servidor lo lee desde la configuración.
CMD ["node", "backend/dist/server.js"]
