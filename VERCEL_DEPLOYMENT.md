# Deploying to Vercel with Playwright

This document explains how to deploy the Fandango Movie Explorer to Vercel in a serverless environment.

## Prerequisites

1. A Vercel account
2. A browser service account (options listed below)

## Browser Service Options

Since Vercel functions run in a serverless environment, you need a browser service that provides a WebSocket endpoint. Here are some options:

### 1. Browserless.io

[Browserless](https://www.browserless.io/) provides cloud-based browser instances.

- Sign up for an account
- Get your WebSocket connection string (it looks like: `wss://chrome.browserless.io?token=YOUR-API-KEY`)

### 2. Playwright API Service

[Playwright API Service](https://playwrightapi.xyz/) is another option specifically for Playwright.

### 3. Self-hosted browser service

If you prefer, you can set up your own browser service on a cloud provider like AWS, GCP, or Digital Ocean.

## Setup Instructions

1. **Update Environment Variables**:

   In your Vercel project settings, add the following environment variable:

   - `BROWSER_WS_ENDPOINT`: Your browser service WebSocket URL (e.g., `wss://chrome.browserless.io?token=YOUR-API-KEY`)

2. **Update vercel.json**:

   Make sure the `vercel.json` file contains the correct settings for your deployment:

   ```json
   {
     "version": 2,
     "buildCommand": "npm run build",
     "installCommand": "npm install",
     "outputDirectory": ".next",
     "functions": {
       "api/scraper/route.ts": {
         "memory": 1024,
         "maxDuration": 120
       }
     }
   }
   ```

3. **Deploy to Vercel**:

   ```bash
   vercel
   ```

## Troubleshooting

If you encounter issues with the deployment:

1. Check the Vercel function logs to see if there are any connection errors
2. Make sure your browser service endpoint is accessible from Vercel functions
3. Verify that your API keys are correctly set in the environment variables
4. Try increasing the function memory or timeout if needed

## Local Development

For local development, the scraper will automatically fall back to launching a local browser instance if no `BROWSER_WS_ENDPOINT` environment variable is set.

To test the serverless configuration locally:

1. Create a `.env.local` file with your `BROWSER_WS_ENDPOINT`
2. Run the development server: `npm run dev`
