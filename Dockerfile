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

# Skip browser download and use system Chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Create directory for Playwright to look for browsers
RUN mkdir -p /ms-playwright/chromium-1169 \
    && ln -s /usr/bin/chromium-browser /ms-playwright/chromium-1169/chrome

# Set environment variable for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Expose the port the app runs on
EXPOSE 10000
ENV PORT=10000

# Use standalone server mode
CMD ["node", ".next/standalone/server.js"] 