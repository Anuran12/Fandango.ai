# Fandango Movie Explorer

A Next.js application for searching movie showtimes on Fandango using natural language queries. This app uses Google's Gemini AI to process natural language queries and extract structured parameters, then scrapes Fandango.com for real-time movie information.

## Features

- Natural language processing for movie queries using Google Gemini API
- Web scraping of Fandango.com for real-time movie information
- Search for movies by title, location, theater, and time
- Visual display of showtimes with screenshots
- Query history tracking

## Technologies Used

- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Google Generative AI (Gemini API)
- Playwright for web scraping
- React hooks for state management

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- Google Gemini API key

### Installation

1. Clone this repository

   ```bash
   git clone <repository-url>
   cd fandango-next
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your Gemini API key:

   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Start the development server

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a natural language query like "Show me showtimes for Dune in Chicago"
2. The app will extract parameters using the Gemini API
3. The extracted parameters will be displayed
4. The app will search Fandango.com for the requested information
5. Results and screenshots will be displayed

## License

This project is open source and available under the MIT License.

## Acknowledgements

- Google Generative AI for natural language processing
- Playwright for web scraping capabilities
- Next.js team for the amazing framework
