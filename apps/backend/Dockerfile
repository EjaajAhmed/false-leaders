FROM node:20-alpine

WORKDIR /app

COPY apps/backend/package*.json ./

RUN npm install

COPY apps/backend/src ./src

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
