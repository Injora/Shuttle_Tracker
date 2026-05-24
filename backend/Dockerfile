FROM node:20-alpine

WORKDIR /app

# Install build dependencies (needed for bcrypt and other native modules if any)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 5001

CMD ["node", "src/index.js"]
