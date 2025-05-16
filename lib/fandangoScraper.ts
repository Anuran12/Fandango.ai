import { Browser, Page, chromium } from "playwright-core";
import path from "path";
import fs from "fs";

interface TimeRange {
  start?: string;
  end?: string;
}

// Define return types for methods to include error property
interface ScraperResult {
  success?: boolean;
  message?: string;
  error?: string;
  screenshots?: string[];
}

interface ScraperQuery {
  movie?: string;
  location?: string;
  theater?: string;
  time_range?: TimeRange;
  specific_times?: string[];
  aisle_required?: boolean;
}

class FandangoScraper {
  private browser: Browser | null = null;
  private context: any = null;
  private page: Page | null = null;
  private sessions: any[] = [];
  private screenshotDir: string;

  constructor(
    private headless: boolean = true,
    private timeout: number = 60000
  ) {
    this.screenshotDir = path.join(process.cwd(), "public", "screenshots");

    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({ headless: this.headless });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      });
      this.page = await this.context.newPage();
      // Fix null check issue
      if (this.page) {
        await this.page.setDefaultTimeout(this.timeout);
      }
      return true;
    } catch (error) {
      console.error("Initialization failed:", error);
      return false;
    }
  }

  async close() {
    try {
      // Close all sessions
      for (const session of this.sessions) {
        await session.close();
      }

      // Close main browser
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  async takeScreenshot(
    name: string,
    elementSelector?: string
  ): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");

    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    const relativePath = `/screenshots/${filename}`;

    try {
      if (elementSelector) {
        const element = this.page.locator(elementSelector);
        await element.screenshot({ path: filepath });
      } else {
        await this.page.screenshot({ path: filepath });
      }
      return relativePath;
    } catch (error) {
      console.error(`Error taking screenshot: ${error}`);
      if (elementSelector) {
        await this.page.screenshot({ path: filepath });
      }
      return relativePath;
    }
  }

  async waitForNavigation(timeout = 30000) {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.page.waitForLoadState("networkidle", { timeout });
    } catch (error) {
      console.log("Navigation timeout occurred, but continuing...");
      // Remove navigation timeout screenshot
    }
  }

  async navigateToFandango() {
    if (!this.page) throw new Error("Page not initialized");

    try {
      console.log("Navigating to Fandango.com...");
      await this.page.goto("https://www.fandango.com/");

      // Wait for the page to be fully loaded
      await this.page.waitForLoadState("load");

      // Wait a moment for any overlays or pop-ups
      await this.page.waitForTimeout(2000);

      // Check for and handle any cookie/privacy notices or popups
      try {
        const acceptButtons = this.page.locator(
          "button:has-text('Accept'), button:has-text('Accept All'), button:has-text('I Accept')"
        );
        if ((await acceptButtons.count()) > 0) {
          await acceptButtons.first().click();
          await this.page.waitForTimeout(1000);
        }
      } catch (error) {
        console.log(
          `Note: No accept button found or error clicking it: ${error}`
        );
      }

      return "";
    } catch (error) {
      console.error(`Error during navigation to Fandango: ${error}`);
      return "";
    }
  }

  async performSearch(searchText: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      console.log(`Searching for: ${searchText}`);

      // Look for the search box with multiple possible selectors
      const searchSelectors = [
        "#global-header-search-input",
        "input[placeholder*='Search']",
        "input[id*='search']",
        "input[id*='Search']",
        "input[class*='search']",
        "input[class*='Search']",
      ];

      let searchBox = null;
      for (const selector of searchSelectors) {
        const searchElement = this.page.locator(selector);
        if ((await searchElement.count()) > 0) {
          searchBox = searchElement;
          console.log(`Found search box with selector: ${selector}`);
          break;
        }
      }

      if (!searchBox) {
        console.error("ERROR: Could not find search box");
        return { error: "Could not find search box" };
      }

      // Clear the search box and type the search text
      await searchBox.click();
      await searchBox.fill(""); // Clear first
      await searchBox.fill(searchText);

      // Try different methods to submit the search
      try {
        // Method 1: Submit using Enter key
        await searchBox.press("Enter");
        console.log("Submitted search using Enter key");
      } catch (error) {
        console.error(`Enter key submission failed: ${error}`);

        try {
          // Method 2: Click search button
          const searchButtonSelectors = [
            "#global-header-go-btn",
            "button[id*='search']",
            "button[id*='Search']",
            "button[type='submit']",
            "button.nav-bar__go-btn",
          ];

          let buttonClicked = false;
          for (const btnSelector of searchButtonSelectors) {
            const button = this.page.locator(btnSelector);
            if ((await button.count()) > 0) {
              await button.click();
              console.log(`Clicked search button: ${btnSelector}`);
              buttonClicked = true;
              break;
            }
          }

          if (!buttonClicked) {
            // Method 3: Try submitting the form directly
            try {
              await this.page.evaluate(() => {
                const forms = document.querySelectorAll("form");
                for (let form of forms) {
                  if (form.querySelector('input[type="text"]')) {
                    form.submit();
                    return;
                  }
                }
              });
              console.log("Submitted search using form submit");
            } catch (error) {
              console.error(`Form submission failed: ${error}`);
              return { error: "Could not submit search" };
            }
          }
        } catch (error) {
          console.error(`Button click failed: ${error}`);
          return { error: "Could not submit search" };
        }
      }

      // Wait for search results to load
      console.log("Waiting for search results...");
      await this.page.waitForLoadState("load");
      await this.page.waitForTimeout(3000); // Give extra time for results to appear

      return { success: true };
    } catch (error) {
      console.error(`Error during search: ${error}`);
      return { error: `Search error: ${error}` };
    }
  }

  async searchCity(city: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Searching for city: ${city}`);

    // Perform general search for the city
    const searchResult = await this.performSearch(city);
    if (searchResult.error) {
      return searchResult;
    }

    // Look for cities section in search results
    const citiesSection = this.page.locator("#search-results-cities");
    if ((await citiesSection.count()) > 0) {
      console.log("Found cities results section");

      // Try to find and click on the city
      const cityLinks = this.page.locator(
        `#search-results-cities a:has-text('${city}')`
      );
      if ((await cityLinks.count()) > 0) {
        console.log(`Found link for city: ${city}`);
        await cityLinks.first().click();
        await this.waitForNavigation();
        return {
          success: true,
          message: `Successfully navigated to city: ${city}`,
        };
      } else {
        console.log(`City link not found for: ${city}`);
        return {
          error: `City link not found for: ${city}`,
        };
      }
    } else {
      console.log("No cities section found in search results");
      return {
        error: "No cities section found in search results",
      };
    }
  }

  async searchTheater(theater: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Searching for theater: ${theater}`);

    // Perform general search for the theater
    const searchResult = await this.performSearch(theater);
    if (searchResult.error) {
      return searchResult;
    }

    // Look for theaters section in search results
    const theatersSection = this.page.locator("#search-results-theaters");
    if ((await theatersSection.count()) > 0) {
      console.log("Found theaters results section");

      // Try to find and click on the theater
      const theaterLinks = this.page.locator(
        `#search-results-theaters .heading-size-m:has-text('${theater}')`
      );
      if ((await theaterLinks.count()) > 0) {
        console.log(`Found link for theater: ${theater}`);
        await theaterLinks.first().click();
        await this.waitForNavigation();
        return {
          success: true,
          message: `Successfully navigated to theater: ${theater}`,
        };
      } else {
        console.log(`Theater link not found for: ${theater}`);
        return {
          error: `Theater link not found for: ${theater}`,
        };
      }
    } else {
      console.log("No theaters section found in search results");
      return {
        error: "No theaters section found in search results",
      };
    }
  }

  async searchMovie(movie: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Searching for movie: ${movie}`);

    // Perform general search for the movie
    const searchResult = await this.performSearch(movie);
    if (searchResult.error) {
      return searchResult;
    }

    // Look for movies section in search results
    const moviesSection = this.page.locator("#search-results-movies");
    if ((await moviesSection.count()) > 0) {
      console.log("Found movies results section");

      // Try to find and click on the movie
      let movieFound = false;

      // Strategy 1: Look for specific movie title
      const movieLinks = this.page.locator(
        `#search-results-movies .search__movie-title:has-text('${movie}')`
      );
      if ((await movieLinks.count()) > 0) {
        console.log(`Found link for movie: ${movie}`);
        await movieLinks.first().click();
        movieFound = true;
      } else {
        // Strategy 2: More generic search
        const generalMovieLinks = this.page.locator(
          `#search-results-movies a:has-text('${movie}')`
        );
        if ((await generalMovieLinks.count()) > 0) {
          console.log(`Found general link for movie: ${movie}`);
          await generalMovieLinks.first().click();
          movieFound = true;
        }
      }

      if (movieFound) {
        await this.waitForNavigation();

        // Try to click Buy Tickets if available
        const buyTicketsSelectors = [
          "a.btn:has-text('Buy Tickets')",
          "a:has-text('Buy Tickets')",
          "button:has-text('Buy Tickets')",
        ];

        for (const btnSelector of buyTicketsSelectors) {
          const btn = this.page.locator(btnSelector);
          if ((await btn.count()) > 0) {
            await btn.click();
            console.log("Clicked Buy Tickets button");
            await this.waitForNavigation();
            break;
          }
        }

        return {
          success: true,
          message: `Successfully navigated to movie: ${movie}`,
        };
      } else {
        console.log(`Movie link not found for: ${movie}`);
        return {
          error: `Movie link not found for: ${movie}`,
        };
      }
    } else {
      console.log("No movies section found in search results");
      return {
        error: "No movies section found in search results",
      };
    }
  }

  async findMovieOnTheaterPage(
    movie: string,
    timeFilter?: TimeRange,
    specificTimes?: string[]
  ): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Looking for movie '${movie}' on theater page`);
    console.log(`Time filter: ${JSON.stringify(timeFilter)}`);
    console.log(`Specific times: ${JSON.stringify(specificTimes)}`);

    const screenshots: string[] = [];

    try {
      // Wait for movie listings to load
      await this.page.waitForTimeout(3000);

      // Look for the movie listings section
      const movieSection = this.page.locator(
        "#lazyload-movie-times, .thtr-mv-list, .fd-panel"
      );
      if ((await movieSection.count()) === 0) {
        console.log("Movie listings section not found");
        return {
          error: "Movie listings section not found on theater page",
          screenshots,
        };
      }

      // Try multiple selectors to find the movie element
      let movieElement = null;

      // First, try looking for elements with the movie title in common movie containers
      const selectors = [
        `li[id*='movie'] h2:has-text('${movie}')`, // Movie list items with h2 titles
        `.thtr-mv-list__detail-title:has-text('${movie}')`, // Movie title elements
        `.thtr-mv-list__detail-link:has-text('${movie}')`, // Movie title links
        `h2:has-text('${movie}')`, // Any h2 with the movie name
        `a[href*='${movie.toLowerCase().replace(/ /g, "-")}']`, // Links with movie name in URL
        `a:has-text('${movie}')`, // Any link with movie name
      ];

      for (const selector of selectors) {
        const elements = this.page.locator(selector);
        if ((await elements.count()) > 0) {
          // Found the movie element
          movieElement = elements.first();
          console.log(`Found movie '${movie}' using selector: ${selector}`);
          break;
        }
      }

      if (!movieElement) {
        // If we couldn't find with exact match, try a more flexible approach
        console.log(
          `Exact match for '${movie}' not found, trying partial match`
        );

        // Get all movie titles on the page
        const allMovieTitles = await this.page.evaluate(() => {
          const movieElements = document.querySelectorAll(
            ".thtr-mv-list__detail-title, h2"
          );
          return Array.from(movieElements).map((el) => ({
            // Use type assertion to handle innerText property
            text: (el as HTMLElement).innerText,
            id: el.closest("li, div.thtr-mv-list__panel")?.id || "",
          }));
        });

        // Look for a partial match
        let bestMatch = null;
        for (const titleInfo of allMovieTitles) {
          const titleText = titleInfo.text || "";
          if (titleText.toLowerCase().includes(movie.toLowerCase())) {
            bestMatch = titleInfo;
            break;
          }
        }

        if (bestMatch && bestMatch.id) {
          movieElement = this.page.locator(`#${bestMatch.id}`);
          console.log(
            `Found movie via partial match: ${bestMatch.text} (ID: ${bestMatch.id})`
          );
        }
      }

      if (!movieElement || (await movieElement.count()) === 0) {
        console.log(`Movie '${movie}' not found on theater page`);
        return {
          error: `Movie '${movie}' not found on theater page`,
          screenshots,
        };
      }

      // Get the full movie container
      const movieContainer = await this.page.evaluate((element) => {
        if (!element) return null;

        // If this is not directly the li/panel element, get the parent container
        const container =
          element.closest("li.thtr-mv-list__panel") ||
          element.closest("li") ||
          element.closest("div.thtr-mv-list__panel") ||
          element.closest(".fd-panel");

        if (container) {
          // Return the container ID so we can locate it
          return container.id || null;
        }
        return null;
      }, await movieElement.elementHandle());

      if (movieContainer) {
        // Locate the container element using the ID
        const containerElement = this.page.locator(`#${movieContainer}`);
        if ((await containerElement.count()) > 0) {
          // Scroll to the movie container to ensure it's visible
          await containerElement.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(1000);

          // Add a red border to the movie container
          await this.page.evaluate((element) => {
            if (element) {
              element.style.border = "4px solid red";
              element.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
            }
          }, await containerElement.elementHandle());

          // Skip the first screenshot without filtered times

          // Apply time filters and highlighting
          if (timeFilter || specificTimes) {
            if (timeFilter) {
              const startTime = timeFilter.start?.replace(":", "") || "";
              const endTime = timeFilter.end?.replace(":", "") || "";

              console.log(
                `Highlighting showtimes between ${startTime || "00:00"} and ${
                  endTime || "23:59"
                }`
              );
            }

            if (specificTimes && specificTimes.length > 0) {
              console.log(
                `Also highlighting specific times: ${specificTimes.join(", ")}`
              );
            }

            // Highlight showtimes within the filter range
            await this.page.evaluate(
              ({ element, startTime, endTime, specificTimes }) => {
                if (!element) return;

                console.log(
                  `In evaluate: Highlighting times with startTime=${startTime}, endTime=${endTime}`
                );
                console.log(
                  `In evaluate: Specific times: ${JSON.stringify(
                    specificTimes
                  )}`
                );

                // Function to parse time strings in various formats
                const parseTime = (timeStr: string) => {
                  if (!timeStr) return 0;

                  console.log(`Parsing time: ${timeStr}`);

                  let hours = 0;
                  let minutes = 0;
                  let isPM = false;

                  // Clean up the time string
                  timeStr = timeStr.trim();

                  // Check for 'a' or 'p' suffix format
                  if (timeStr.endsWith("a")) {
                    timeStr = timeStr.slice(0, -1);
                  } else if (timeStr.endsWith("p")) {
                    timeStr = timeStr.slice(0, -1);
                    isPM = true;
                  }
                  // Check if the time includes AM/PM indicators
                  else if (timeStr.toLowerCase().includes("am")) {
                    timeStr = timeStr.toLowerCase().replace("am", "").trim();
                  } else if (timeStr.toLowerCase().includes("pm")) {
                    timeStr = timeStr.toLowerCase().replace("pm", "").trim();
                    isPM = true;
                  }

                  // Check if it has a colon
                  if (timeStr.includes(":")) {
                    const parts = timeStr.split(":");
                    hours = parseInt(parts[0], 10);
                    minutes = parseInt(parts[1], 10);
                  }
                  // Check if it's a plain 4-digit number
                  else if (timeStr.length === 4) {
                    hours = parseInt(timeStr.substring(0, 2), 10);
                    minutes = parseInt(timeStr.substring(2, 4), 10);
                  }
                  // Check if it's a 1 or 2 digit hour
                  else if (timeStr.length <= 2) {
                    hours = parseInt(timeStr, 10);
                    minutes = 0;
                  }
                  // Handle 3-digit formats
                  else if (timeStr.length === 3) {
                    hours = parseInt(timeStr.substring(0, 1), 10);
                    minutes = parseInt(timeStr.substring(1, 3), 10);
                  }

                  // Adjust for PM times
                  if (isPM && hours < 12) {
                    hours += 12;
                  }

                  // Handle midnight (12 AM)
                  if (!isPM && hours === 12) {
                    hours = 0;
                  }

                  const totalMinutes = hours * 60 + minutes;
                  console.log(
                    `Parsed time ${timeStr} to ${hours}:${minutes} (${totalMinutes} minutes)`
                  );
                  return totalMinutes; // Return minutes since midnight
                };

                const startMinutes = startTime ? parseTime(startTime) : 0;
                const endMinutes = endTime ? parseTime(endTime) : 24 * 60 - 1;

                // Pre-process specific times to both time format and minutes for easier comparison
                const processedSpecificTimes = specificTimes
                  ? specificTimes.map((t) => {
                      const minutes = parseTime(t);
                      // Create common formats for comparison
                      return {
                        originalFormat: t,
                        minutes: minutes,
                        // Standard format HH:MM
                        standard: `${Math.floor(minutes / 60)}:${(minutes % 60)
                          .toString()
                          .padStart(2, "0")}`,
                        // AM/PM format for comparison
                        amPm: `${
                          Math.floor(minutes / 60) > 12
                            ? Math.floor(minutes / 60) - 12
                            : Math.floor(minutes / 60) || 12
                        }:${(minutes % 60).toString().padStart(2, "0")}${
                          Math.floor(minutes / 60) >= 12 ? "p" : "a"
                        }`,
                      };
                    })
                  : [];

                if (processedSpecificTimes.length > 0) {
                  console.log(
                    `Processed specific times:`,
                    processedSpecificTimes
                  );
                }

                // Find all showtime buttons within this movie container
                const showtimeButtons = element.querySelectorAll(
                  '.showtime-btn, .btn, a[href*="showtime"], span.showtime-text'
                );

                console.log(`Found ${showtimeButtons.length} showtime buttons`);

                showtimeButtons.forEach((button: any) => {
                  const timeText = button.innerText.trim();
                  console.log(`Checking button with text: "${timeText}"`);

                  const buttonTime = parseTime(timeText);

                  let shouldHighlight = false;

                  // Check if time is within start/end range
                  if (
                    startTime &&
                    endTime &&
                    buttonTime >= startMinutes &&
                    buttonTime <= endMinutes
                  ) {
                    shouldHighlight = true;
                    console.log(
                      `Time ${timeText} is within range ${startTime}-${endTime}`
                    );
                  }

                  // Check if time matches any specific times
                  if (
                    processedSpecificTimes &&
                    processedSpecificTimes.length > 0
                  ) {
                    for (const specificTime of processedSpecificTimes) {
                      // Compare direct minutes values
                      if (buttonTime === specificTime.minutes) {
                        shouldHighlight = true;
                        console.log(
                          `Time ${timeText} matches specific time ${specificTime.originalFormat} by minutes`
                        );
                        break;
                      }

                      // Compare with various formats
                      const buttonTimeLower = timeText.toLowerCase();
                      if (
                        buttonTimeLower ===
                          specificTime.originalFormat.toLowerCase() ||
                        buttonTimeLower ===
                          specificTime.standard.toLowerCase() ||
                        buttonTimeLower === specificTime.amPm.toLowerCase() ||
                        // Also try with AM/PM variants
                        buttonTimeLower ===
                          specificTime.amPm.replace("a", " AM").toLowerCase() ||
                        buttonTimeLower ===
                          specificTime.amPm.replace("p", " PM").toLowerCase()
                      ) {
                        shouldHighlight = true;
                        console.log(
                          `Time ${timeText} matches specific time ${specificTime.originalFormat} by format`
                        );
                        break;
                      }
                    }
                  }

                  if (shouldHighlight) {
                    // This showtime is within the requested range or matches specific time
                    console.log(`Highlighting time: ${timeText}`);
                    button.style.border = "3px solid green";
                    button.style.boxShadow = "0 0 8px #00FF00";
                    button.style.backgroundColor = "#006600";
                    button.style.color = "white";
                    button.style.fontWeight = "bold";
                  }
                });
              },
              {
                element: await containerElement.elementHandle(),
                startTime: timeFilter?.start?.replace(":", "") || "",
                endTime: timeFilter?.end?.replace(":", "") || "",
                specificTimes: specificTimes || [],
              }
            );

            // Take only the filtered times screenshot
            const movieSS = await this.takeScreenshot(
              `movie_${movie.replace(/ /g, "_")}_filtered_times`,
              `#${movieContainer}`
            );
            screenshots.push(movieSS);
          } else {
            // If no time filter, just take one screenshot
            const movieSS = await this.takeScreenshot(
              `movie_${movie.replace(/ /g, "_")}`,
              `#${movieContainer}`
            );
            screenshots.push(movieSS);
          }
        }
      }

      return {
        success: true,
        message: `Found movie '${movie}' on theater page`,
        screenshots,
      };
    } catch (error) {
      console.error(`Error finding movie on theater page: ${error}`);
      return {
        error: `Error finding movie on theater page: ${error}`,
        screenshots,
      };
    }
  }

  async selectNearbyTheater(theaterName: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(
      `Looking for theater '${theaterName}' in nearby theaters dropdown`
    );

    try {
      // Check if the nearby theaters dropdown exists
      let dropdown = this.page.locator("#nearby-theaters-select-list");
      if ((await dropdown.count()) === 0) {
        // Try alternative selectors
        dropdown = this.page.locator("select.nearby-theaters__select");
        if ((await dropdown.count()) === 0) {
          dropdown = this.page.locator("select.js-nearby-theaters");
          if ((await dropdown.count()) === 0) {
            console.log("Nearby theaters dropdown not found on this page");
            return {
              error: "Nearby theaters dropdown not found on this page",
            };
          }
        }
      }

      // Get all options from the dropdown using JavaScript
      const optionsData = await this.page.evaluate(() => {
        const select =
          document.querySelector("#nearby-theaters-select-list") ||
          document.querySelector(".nearby-theaters__select") ||
          document.querySelector(".js-nearby-theaters");
        if (!select) return [];

        return Array.from((select as HTMLSelectElement).options).map(
          (option) => ({
            text: option.text,
            value: option.value,
          })
        );
      });

      console.log(`Found ${optionsData.length} theater options in dropdown`);

      // Find the theater that matches or contains the specified name
      let theaterFound = false;
      let theaterUrl = null;
      let matchingOption = null;

      for (const option of optionsData) {
        const optionText = option.text || "";
        const optionValue = option.value || "";

        // Skip the "Select Theater" option
        if (optionText === "Select Theater" || optionValue === "#") {
          continue;
        }

        // Check if the theater name matches or is contained in the option text
        if (optionText.toLowerCase().includes(theaterName.toLowerCase())) {
          console.log(`Found matching theater: ${optionText}`);
          matchingOption = option;
          theaterUrl = optionValue;
          break;
        }
      }

      if (matchingOption) {
        // Method 1: Try direct navigation to the theater page
        if (theaterUrl && theaterUrl.startsWith("/")) {
          const fullUrl = `https://www.fandango.com${theaterUrl}`;
          console.log(`Navigating directly to theater URL: ${fullUrl}`);
          await this.page.goto(fullUrl);
          await this.waitForNavigation();
          theaterFound = true;
        } else {
          // Method 2: Select option and try to trigger form submission
          try {
            // Use the dropdown.selectOption method
            await dropdown.selectOption({ value: matchingOption.value });
            console.log(
              `Selected theater option with value: ${matchingOption.value}`
            );

            // Wait a moment for any change event handlers to trigger
            await this.page.waitForTimeout(2000);

            // Check if the page has navigated by itself
            const currentUrl = this.page.url();
            if (theaterUrl && currentUrl.includes(theaterUrl)) {
              console.log("Page navigated automatically after selection");
              theaterFound = true;
            } else {
              // Try to trigger navigation through various means
              console.log(
                "Page didn't navigate automatically, trying to trigger navigation"
              );

              // Try to locate and click a "Go" or submit button
              const goButton = this.page.locator(
                "button.nearby-theaters__go-btn, button.go-btn, input[type='submit']"
              );
              if ((await goButton.count()) > 0) {
                console.log("Found Go/Submit button, clicking it");
                await goButton.click();
                await this.waitForNavigation();
                theaterFound = true;
              } else {
                // Last resort: Extract the URL from the dropdown and navigate directly
                theaterUrl = matchingOption.value;
                if (theaterUrl && theaterUrl.startsWith("/")) {
                  const fullUrl = `https://www.fandango.com${theaterUrl}`;
                  console.log(`Navigating directly to theater URL: ${fullUrl}`);
                  await this.page.goto(fullUrl);
                  await this.waitForNavigation();
                  theaterFound = true;
                }
              }
            }
          } catch (error) {
            console.error(`Error during theater selection: ${error}`);
            // Try direct navigation as a last resort
            theaterUrl = matchingOption.value;
            if (theaterUrl && theaterUrl.startsWith("/")) {
              try {
                const fullUrl = `https://www.fandango.com${theaterUrl}`;
                console.log(
                  `Navigating directly to theater URL as fallback: ${fullUrl}`
                );
                await this.page.goto(fullUrl);
                await this.waitForNavigation();
                theaterFound = true;
              } catch (directE) {
                console.error(
                  `Error during direct navigation fallback: ${directE}`
                );
              }
            }
          }
        }
      }

      if (!theaterFound) {
        console.log(
          `Theater '${theaterName}' not found in nearby theaters dropdown or navigation failed`
        );
        return {
          error: `Theater '${theaterName}' not found in nearby theaters dropdown or navigation failed`,
        };
      }

      return {
        success: true,
        message: `Successfully selected theater: ${theaterName}`,
      };
    } catch (error) {
      console.error(`Error selecting nearby theater: ${error}`);
      return {
        error: `Error selecting nearby theater: ${error}`,
      };
    }
  }

  async processQuery(query: ScraperQuery) {
    if (!this.page) throw new Error("Page not initialized");

    const results: any = {
      message: "Processing complete",
      screenshots: [],
    };

    try {
      // Navigate to Fandango.com
      await this.navigateToFandango();

      // Create time filter from query
      const timeFilter = query.time_range;

      // Get specific times if provided
      const specificTimes = query.specific_times || [];

      // FLOW 1: If city is provided, start by searching for it
      if (query.location) {
        console.log(`Step 1: Processing location: ${query.location}`);
        const cityResult = await this.searchCity(query.location);
        if (cityResult.error) {
          results.error = cityResult.error;
          console.log(`Error in city search: ${cityResult.error}`);
          return results;
        }

        // FLOW 1.1: If we have a theater name, try to select it from the dropdown
        if (query.theater) {
          console.log(
            `Step 2: Looking for theater ${query.theater} in dropdown`
          );
          const nearbyTheaterResult = await this.selectNearbyTheater(
            query.theater
          );

          // If theater was found in dropdown
          if (!nearbyTheaterResult.error) {
            console.log("Successfully selected theater from dropdown");

            // FLOW 1.1.1: If movie name is provided, find it on theater page
            if (query.movie) {
              console.log(
                `Step 3: Looking for movie ${query.movie} on theater page`
              );
              const movieResult = await this.findMovieOnTheaterPage(
                query.movie,
                timeFilter,
                specificTimes
              );
              if (movieResult.screenshots) {
                results.screenshots.push(...movieResult.screenshots);
              }
              if (movieResult.error) {
                results.error = movieResult.error;
                console.log(`Error finding movie: ${movieResult.error}`);
              }
              return results;
            }

            // No movie name specified
            return results;
          }

          // If theater was not found in dropdown, try direct theater search as a fallback
          else {
            console.log(
              `Theater not found in dropdown: ${nearbyTheaterResult.error}`
            );
            console.log("Falling back to direct theater search...");
            const theaterResult = await this.searchTheater(query.theater);

            if (theaterResult.error) {
              results.error = theaterResult.error;
              console.log(`Error in theater search: ${theaterResult.error}`);
              return results;
            }

            // Theater found via direct search
            // If movie name is provided, find it on theater page
            if (query.movie) {
              console.log(
                `Step 3: Looking for movie ${query.movie} on theater page`
              );
              const movieResult = await this.findMovieOnTheaterPage(
                query.movie,
                timeFilter,
                specificTimes
              );
              if (movieResult.screenshots) {
                results.screenshots.push(...movieResult.screenshots);
              }
              if (movieResult.error) {
                results.error = movieResult.error;
                console.log(`Error finding movie: ${movieResult.error}`);
              }
              return results;
            }

            // No movie name specified
            return results;
          }
        }

        // No theater name specified
        return results;
      }

      // FLOW 2: No city provided, but we have a theater name - search directly for theater
      else if (query.theater) {
        console.log(`Step 1: Directly searching for theater: ${query.theater}`);
        const theaterResult = await this.searchTheater(query.theater);

        if (theaterResult.error) {
          results.error = theaterResult.error;
          console.log(`Error in theater search: ${theaterResult.error}`);
          return results;
        }

        // If movie name is provided, find it on theater page
        if (query.movie) {
          console.log(
            `Step 2: Looking for movie ${query.movie} on theater page`
          );
          const movieResult = await this.findMovieOnTheaterPage(
            query.movie,
            timeFilter,
            specificTimes
          );
          if (movieResult.screenshots) {
            results.screenshots.push(...movieResult.screenshots);
          }
          if (movieResult.error) {
            results.error = movieResult.error;
            console.log(`Error finding movie: ${movieResult.error}`);
          }
          return results;
        }

        // No movie name specified
        return results;
      }

      // FLOW 3: Just a movie name provided, search for it directly
      else if (query.movie) {
        console.log(`Step 1: Processing movie: ${query.movie}`);
        const movieResult = await this.searchMovie(query.movie);
        if (movieResult.error) {
          results.error = movieResult.error;
          console.log(`Error in movie search: ${movieResult.error}`);
        }
        return results;
      }

      // No valid parameters provided
      else {
        results.error = "No valid search parameters provided";
        console.log("Error: No valid search parameters provided");
        return results;
      }
    } catch (error) {
      const errorMsg = `Error processing query: ${error}`;
      console.error(errorMsg);
      results.error = errorMsg;
    }

    return results;
  }
}

export { FandangoScraper, type ScraperQuery, type TimeRange };
