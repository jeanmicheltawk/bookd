FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["sh", "-c", "node migrations/run.js && node seeds/run.js && node src/server.js"]
