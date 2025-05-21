#!/usr/bin/env bash
# Script for Render.com build

# Print commands before execution and exit on error
set -ex

# Install necessary dependencies
echo "Installing Chromium and dependencies..."
apt-get update
apt-get install -y chromium-browser fonts-noto-color-emoji fonts-freefont-ttf

# Set environment variables
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Build the Next.js application
echo "Building the Next.js application..."
npm ci
npm run build

# Create directories for screenshots
mkdir -p public/screenshots 