FROM node:20-alpine

WORKDIR /app

# Install build dependencies (needed for bcrypt and other native modules if any)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci

COPY . .

# Generate Prisma Client
ENV DATABASE_URL="mongodb+srv://dummy:dummy@dummy.mongodb.net/dummy"
RUN npx prisma generate

# Create non-root user for production security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# Ensure the appuser owns the working directory
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5001

# Health check — validates the Express server is responsive
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "src/index.js"]
