FROM node:20-alpine

# Install dependencies required for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget \
    unzip \
    bash \
    fontconfig \
    dbus \
    libc6-compat

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Add Playwright browsers explicitly
RUN npx playwright install chromium --with-deps

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Set Playwright to use installed browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose the port the app runs on
EXPOSE 10000
ENV PORT=10000

# Use standalone server mode
CMD ["node", ".next/standalone/server.js"] 