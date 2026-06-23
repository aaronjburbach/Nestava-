FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev || npm install
COPY . .
ENV PORT=8787
EXPOSE 8787
CMD ["npx","tsx","src/api/index.ts"]
