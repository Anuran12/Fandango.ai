FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set working directory
WORKDIR /app

# Add node and npm to path
ENV PATH /usr/local/node/bin:$PATH

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies and Next.js
RUN npm ci 

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose the port the server listens on
EXPOSE 10000
ENV PORT=10000

# Use Next.js's standalone mode
CMD ["node", ".next/standalone/server.js"] 