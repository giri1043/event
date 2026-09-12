# Step 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies for building
RUN npm ci

# Copy full application code
COPY . .

# Run production build (compiles Vite frontend & esbuild server)
RUN npm run build

# Step 2: Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

# Ensure persistence directories exist
RUN mkdir -p data uploads

# Expose port 3000
EXPOSE 3000

# Run production server
CMD ["node", "dist/server.cjs"]
