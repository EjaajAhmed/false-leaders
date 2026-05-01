FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN npm install --workspace=apps/backend
COPY apps/backend ./apps/backend
COPY packages ./packages
WORKDIR /app/apps/backend
RUN npx tsc --skipLibCheck || true
EXPOSE 3000
CMD ["node", "dist/index.js"]
