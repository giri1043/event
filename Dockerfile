# Step 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy full application code
COPY . .

# Run production build (compiles Vite frontend & esbuild server)
RUN npm run build

# Prune devDependencies cleanly without script execution errors
RUN npm prune --omit=dev --ignore-scripts

# Step 2: Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV MONGODB_URI=mongodb://giridha1043_db_user:fKlSyoi5LTc8CVhf@ac-7mjxnjl-shard-00-00.pw6tzia.mongodb.net:27017,ac-7mjxnjl-shard-00-01.pw6tzia.mongodb.net:27017,ac-7mjxnjl-shard-00-02.pw6tzia.mongodb.net:27017/dwrs?ssl=true&authSource=admin&retryWrites=true&w=majority
ENV MONGODB_DB_NAME=event

# Copy package files
COPY package*.json ./

# Copy pre-pruned node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled assets from builder stage
COPY --from=builder /app/dist ./dist

# Ensure persistence directories exist
RUN mkdir -p data uploads

# Expose port 3000
EXPOSE 3000

# Run production server
CMD ["node", "dist/server.cjs"]
