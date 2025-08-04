# Use Node.js base image
FROM node:18-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY pnpm-lock.yaml ./
COPY package.json ./
RUN pnpm install

# Copy the rest of the app
COPY . .

# Build the app
RUN pnpm build

# Expose NestJS default port
EXPOSE 3000

# Start the app (for prod)
CMD ["pnpm", "start"]