FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install
COPY apps/api apps/api
RUN npm run db:generate && npm run build -w @gallery/api
EXPOSE 3001
CMD ["sh", "-c", "npm run db:deploy -w @gallery/api && npm run start -w @gallery/api"]
