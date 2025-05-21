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
    # Add sed for script processing
    sed

# Set environment variables for Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
# Make Playwright environment variables available at runtime
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Install missing PostCSS dependencies
RUN npm install --save-dev postcss@^8.4.35 autoprefixer@^10.4.18 postcss-import@^16.0.1

# Make the import fix script executable and run it
RUN chmod +x fix-imports.sh && ./fix-imports.sh

# Build the Next.js application
RUN npm run build

# For standalone output - copy necessary files
RUN cp -R public .next/standalone/
RUN cp -R .next/static .next/standalone/.next/

# Expose the port the app runs on
EXPOSE 3000

# Make the startup script executable
RUN echo '#!/bin/sh\nexport PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1\nexport PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser\nexec node .next/standalone/server.js' > /app/start.sh
RUN chmod +x /app/start.sh

# Command to run the application
CMD ["/app/start.sh"] 