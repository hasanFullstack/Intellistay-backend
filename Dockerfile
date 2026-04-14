FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY package.json package-lock*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]

# # Use a specific version of Node on Alpine for a tiny footprint
# FROM node:20-alpine AS base

# # 1. Install dependencies only when needed
# FROM base AS deps
# RUN apk add --no-cache libc6-compat
# WORKDIR /app
# The asterisk (*) makes the lock file optional
# COPY package.json package-lock*.json ./
# RUN npm install

# # 2. Rebuild the source code only when needed
# FROM base AS builder
# WORKDIR /app
# COPY --from=deps /app/node_modules 
# COPY . .
# # If you have a build step (like TypeScript), uncomment the line below:
# # RUN npm run build

# # 3. Production image, copy all the files and run next
# FROM base AS runner
# WORKDIR /app

# ENV NODE_ENV=production

# # Create a non-privileged user for security
# RUN addgroup --system --gid 1001 nodejs
# RUN adduser --system --uid 1001 nodejsuser

# # Copy only necessary files
# COPY --from=builder /app ./

# USER nodejsuser

# EXPOSE 3000

# # Update this if your main entry point is different
# CMD ["node", "server.js"]
