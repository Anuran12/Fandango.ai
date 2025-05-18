import { Browser, Page, chromium, BrowserContext } from "playwright-core";
import path from "path";
import fs from "fs";

interface TimeRange {
  start?: string;
  end?: string;
}

// Time slot interface for the extracted time slots
interface TimeSlot {
  time: string;
  url?: string;
  isHighlighted: boolean;
}

// Define return types for methods to include error property
interface ScraperResult {
  success?: boolean;
  message?: string;
  error?: string;
  screenshots?: string[];
  timeSlots?: TimeSlot[]; // Add time slots to the result
  movieTitle?: string;
  theaterName?: string;
}

interface ScraperQuery {
  movie?: string;
  location?: string;
  theater?: string;
  time_range?: TimeRange;
  specific_times?: string[];
  aisle_required?: boolean;
}

// Add interface for session object
interface Session {
  close(): Promise<void>;
}

class FandangoScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessions: Session[] = [];
  private screenshotDir: string;
  private currentPage: string = ""; // Track the current page URL

  constructor(
    private headless: boolean = true,
    private timeout: number = 30000
  ) {
    this.screenshotDir = path.join(process.cwd(), "public", "screenshots");

    // Create screenshots directory if it doesn't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: this.headless,
        timeout: this.timeout,
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        deviceScaleFactor: 1,
        hasTouch: false,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        locale: "en-US",
        timezoneId: "America/New_York",
        // Set permissions to appear more like a real browser
        permissions: ["geolocation"],
        // Add color scheme to appear more like a real browser
        colorScheme: "light",
      });
      this.page = await this.context.newPage();
      if (this.page) {
        await this.page.setDefaultTimeout(this.timeout);

        // Set common headers that real browsers include
        await this.page.setExtraHTTPHeaders({
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          "sec-ch-ua":
            '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        });

        // Add event listener to intercept and modify requests
        await this.page.route("**/*", async (route) => {
          const request = route.request();

          // Skip modifying non-navigation requests
          if (request.resourceType() !== "document") {
            await route.continue();
            return;
          }

          const headers = request.headers();

          // Add more browser-like headers
          headers["Referer"] = "https://www.google.com/";

          // Continue with modified headers
          await route.continue({ headers });
        });
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

  async waitForNavigation(timeout = 15000) {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.page.waitForLoadState("networkidle", { timeout });
    } catch {
      console.log("Navigation timeout occurred, but continuing...");
    }
  }

  async navigateToFandango() {
    if (!this.page) throw new Error("Page not initialized");

    try {
      console.log("Navigating to Fandango.com...");
      await this.page.goto("https://www.fandango.com/", {
        waitUntil: "domcontentloaded",
        timeout: this.timeout,
      });

      // Reduced wait time for overlays - wait only 500ms
      await this.page.waitForTimeout(500);

      // Check for and handle any cookie/privacy notices or popups
      try {
        const acceptButtons = this.page.locator(
          "button:has-text('Accept'), button:has-text('Accept All'), button:has-text('I Accept')"
        );
        if ((await acceptButtons.count()) > 0) {
          await acceptButtons.first().click();
          await this.page.waitForTimeout(500); // Reduced from 1000
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
        return { error: "Could not find search box", screenshots: [] };
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
                for (const form of forms) {
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

      // Wait for search results to load - reduced time
      console.log("Waiting for search results...");
      await this.page.waitForLoadState("domcontentloaded");
      await this.page.waitForTimeout(1000); // Reduced from 3000

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
    const timeSlots: TimeSlot[] = []; // Store extracted time slots
    let movieTitle = movie;
    let theaterName = "";

    try {
      // Try to extract theater name
      try {
        const theaterElement = await this.page
          .locator(".theater-name, .fd-theater-name, h1")
          .first();
        if (theaterElement) {
          theaterName = await theaterElement.innerText();
        }
      } catch (error) {
        console.log("Could not extract theater name");
      }

      // Take a screenshot of the whole page for debugging
      const debugSS = await this.takeScreenshot("debug_full_page");
      console.log("Debug screenshot:", debugSS);

      // Log time slots even at the beginning
      console.log("Initial timeSlots array:", timeSlots);

      // Reduced wait time from 3000 to 1000
      await this.page.waitForTimeout(1000);

      // Look for the movie listings section
      const movieSection = this.page.locator(
        "#lazyload-movie-times, .thtr-mv-list, .fd-panel"
      );
      if ((await movieSection.count()) === 0) {
        console.log("Movie listings section not found");
        return {
          error: "Movie listings section not found on theater page",
          screenshots: [debugSS],
          timeSlots,
          movieTitle,
          theaterName,
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

      console.log("Trying movie selectors:", selectors);
      for (const selector of selectors) {
        const elements = this.page.locator(selector);
        const count = await elements.count();
        console.log(`Selector "${selector}" found ${count} elements`);
        if (count > 0) {
          // Found the movie element
          movieElement = elements.first();
          // Try to get the exact movie title
          try {
            movieTitle = await movieElement.innerText();
          } catch (error) {
            // Stick with the original movie parameter
          }
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
          console.log(`Found ${movieElements.length} possible movie titles`);
          return Array.from(movieElements).map((el) => ({
            // Use type assertion to handle innerText property
            text: (el as HTMLElement).innerText,
            id: el.closest("li, div.thtr-mv-list__panel")?.id || "",
          }));
        });

        console.log("All movie titles found:", allMovieTitles);

        // Look for a partial match
        let bestMatch = null;
        for (const titleInfo of allMovieTitles) {
          const titleText = titleInfo.text || "";
          if (titleText.toLowerCase().includes(movie.toLowerCase())) {
            bestMatch = titleInfo;
            movieTitle = titleText; // Update movie title with the matched text
            console.log(`Found partial match: "${titleText}"`);
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
          screenshots: [debugSS],
          timeSlots,
          movieTitle,
          theaterName,
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

      if (!movieContainer) {
        console.log("Could not find movie container");
        // Try an alternative approach - look for parent elements with specific classes
        try {
          const containerClass = await this.page.evaluate((element) => {
            if (!element) return null;

            // Traverse up to find a suitable container
            let current = element.parentElement;
            const potentialContainers = [];

            while (current && potentialContainers.length < 5) {
              if (current.className)
                potentialContainers.push(current.className);
              current = current.parentElement;
            }

            console.log("Potential container classes:", potentialContainers);
            return potentialContainers[0] || null;
          }, await movieElement.elementHandle());

          if (containerClass) {
            console.log(
              `Found alternative container with class: ${containerClass}`
            );
          }
        } catch (e) {
          console.error("Error finding alternative container:", e);
        }
      }

      // Find the times directly even if we can't find the container
      if (!movieContainer) {
        console.log(
          "Using direct method to extract showtimes since container ID not found"
        );

        try {
          // Get all showtime elements on the page and check which ones are related to our movie
          const directTimeSlots = await this.page.evaluate((movieTitle) => {
            const directTimeSlots: Array<{
              time: string;
              url?: string;
              isHighlighted: boolean;
            }> = [];

            // Find all possible showtime buttons on the page
            const allShowtimeButtons = document.querySelectorAll(
              '.showtimes-btn-list .showtime-btn, .showtime-btn, .btn, a[href*="showtime"], span.showtime-text, button.btn'
            );

            console.log(
              `Found ${allShowtimeButtons.length} total showtime buttons on page`
            );

            // Try direct extraction from showtimes-btn-list if it exists
            const showtimeLists = document.querySelectorAll(
              ".showtimes-btn-list"
            );
            if (showtimeLists.length > 0) {
              console.log(`Found ${showtimeLists.length} showtime lists`);

              showtimeLists.forEach((list) => {
                // Find all time buttons in this list
                const timeButtons = list.querySelectorAll(".showtime-btn");
                console.log(`Found ${timeButtons.length} time buttons in list`);

                timeButtons.forEach((button) => {
                  const buttonElement = button as HTMLElement;
                  const timeText = buttonElement.innerText.trim();

                  if (!timeText || timeText.length > 10) return;

                  // Get URL if it's an anchor
                  let url = "";
                  if (buttonElement.tagName === "A") {
                    url = (buttonElement as HTMLAnchorElement).href;
                  } else if (buttonElement.closest("a")) {
                    url = (buttonElement.closest("a") as HTMLAnchorElement)
                      .href;
                  }

                  directTimeSlots.push({
                    time: timeText,
                    url: url || undefined,
                    isHighlighted: false, // Will set this later
                  });
                });
              });
            }

            // If we already found time slots from showtimes-btn-list, return them
            if (directTimeSlots.length > 0) {
              return directTimeSlots;
            }

            // Find all movie sections to determine which section our movie is in
            const movieSections = document.querySelectorAll(
              "h2, .thtr-mv-list__detail-title"
            );
            let targetSection = null;

            for (const section of movieSections) {
              if (
                section.textContent
                  ?.toLowerCase()
                  .includes(movieTitle.toLowerCase())
              ) {
                targetSection = section;
                console.log(`Found movie section: ${section.textContent}`);
                break;
              }
            }

            if (targetSection) {
              // Find the parent container that would contain showtimes
              const container =
                targetSection.closest("li") ||
                targetSection.closest(".thtr-mv-list__panel") ||
                targetSection.closest(".fd-panel");

              if (container) {
                console.log("Found container, looking for showtimes within it");
                // Get showtimes within this container
                const showtimeButtons = container.querySelectorAll(
                  '.showtimes-btn-list .showtime-btn, .showtime-btn, .btn, a[href*="showtime"], span.showtime-text, button.btn'
                );

                console.log(
                  `Found ${showtimeButtons.length} showtime buttons within container`
                );

                showtimeButtons.forEach((button: Element) => {
                  try {
                    const buttonElement = button as HTMLElement;
                    const timeText = buttonElement.innerText.trim();

                    if (!timeText || timeText.length > 10) return; // Skip non-time elements

                    console.log(`Found showtime: ${timeText}`);

                    // Get the button URL if it's a link
                    let url = "";
                    if (buttonElement.tagName === "A") {
                      url = (buttonElement as HTMLAnchorElement).href;
                    } else if (buttonElement.closest("a")) {
                      url = (buttonElement.closest("a") as HTMLAnchorElement)
                        .href;
                    }

                    // Add time to extracted times - none are highlighted yet
                    directTimeSlots.push({
                      time: timeText,
                      url: url || undefined,
                      isHighlighted: false, // We'll set this later
                    });
                  } catch (error) {
                    console.error("Error processing button:", error);
                  }
                });
              } else {
                console.log("Could not find container for the movie section");
              }
            } else {
              console.log("Could not find movie section");
            }

            return directTimeSlots;
          }, movieTitle);

          console.log(
            `Directly extracted ${directTimeSlots.length} time slots`
          );
          timeSlots.push(...directTimeSlots);

          // Take screenshot of what we found
          const movieSS = await this.takeScreenshot(
            `movie_${movie.replace(/ /g, "_")}_direct`
          );
          screenshots.push(movieSS);

          // Apply highlighting to the extracted time slots
          if (timeFilter || specificTimes) {
            console.log("Applying time filter highlighting to time slots");
            const startTime = timeFilter?.start?.replace(":", "") || "";
            const endTime = timeFilter?.end?.replace(":", "") || "";

            // Process all time slots to apply highlighting based on filters
            for (let i = 0; i < timeSlots.length; i++) {
              const slot = timeSlots[i];

              // Skip if slot doesn't have a time
              if (!slot.time) continue;

              // Parse the time
              const slotTime = slot.time.trim();
              let hours = 0;
              let minutes = 0;
              let isPM = false;

              // Check for 'a' or 'p' suffix format (like "5:10p")
              if (slotTime.endsWith("a")) {
                hours = parseInt(slotTime.slice(0, -1).split(":")[0]);
                minutes = parseInt(slotTime.slice(0, -1).split(":")[1] || "0");
              } else if (slotTime.endsWith("p")) {
                hours = parseInt(slotTime.slice(0, -1).split(":")[0]);
                minutes = parseInt(slotTime.slice(0, -1).split(":")[1] || "0");
                if (hours < 12) hours += 12; // Convert to 24-hour
              }
              // Check AM/PM format
              else if (slotTime.toLowerCase().includes("am")) {
                hours = parseInt(
                  slotTime.toLowerCase().split("am")[0].trim().split(":")[0]
                );
                minutes = parseInt(
                  slotTime.toLowerCase().split("am")[0].trim().split(":")[1] ||
                    "0"
                );
              } else if (slotTime.toLowerCase().includes("pm")) {
                hours = parseInt(
                  slotTime.toLowerCase().split("pm")[0].trim().split(":")[0]
                );
                minutes = parseInt(
                  slotTime.toLowerCase().split("pm")[0].trim().split(":")[1] ||
                    "0"
                );
                if (hours < 12) hours += 12;
              }
              // Try standard time format
              else if (slotTime.includes(":")) {
                hours = parseInt(slotTime.split(":")[0]);
                minutes = parseInt(slotTime.split(":")[1]);
              }

              const slotMinutes = hours * 60 + minutes;

              // Check if within time range filter
              if (startTime && endTime) {
                // Parse start and end times
                let startHours = parseInt(startTime.slice(0, 2));
                let startMinutes = parseInt(startTime.slice(2));
                let endHours = parseInt(endTime.slice(0, 2));
                let endMinutes = parseInt(endTime.slice(2));

                const startTotalMinutes = startHours * 60 + startMinutes;
                const endTotalMinutes = endHours * 60 + endMinutes;

                if (
                  slotMinutes >= startTotalMinutes &&
                  slotMinutes <= endTotalMinutes
                ) {
                  timeSlots[i].isHighlighted = true;
                  console.log(
                    `Highlighting time ${slotTime} - within time range ${startTime}-${endTime}`
                  );
                }
              }

              // Check if matches specific times
              if (specificTimes && specificTimes.length > 0) {
                for (const specificTime of specificTimes) {
                  // Parse specific time
                  let specHours = 0;
                  let specMinutes = 0;

                  if (specificTime.includes(":")) {
                    specHours = parseInt(specificTime.split(":")[0]);
                    specMinutes = parseInt(specificTime.split(":")[1]);
                  } else if (specificTime.length === 4) {
                    specHours = parseInt(specificTime.slice(0, 2));
                    specMinutes = parseInt(specificTime.slice(2));
                  }

                  const specTotalMinutes = specHours * 60 + specMinutes;

                  // Compare times
                  if (slotMinutes === specTotalMinutes) {
                    timeSlots[i].isHighlighted = true;
                    console.log(
                      `Highlighting time ${slotTime} - matches specific time ${specificTime}`
                    );
                    break;
                  }
                }
              }
            }
          } else {
            // If no time filter, highlight all available times
            timeSlots.forEach((slot, index) => {
              // Only highlight times that have valid URLs (available, not expired)
              if (slot.url) {
                timeSlots[index].isHighlighted = true;
                console.log(`Highlighting available time: ${slot.time}`);
              }
            });
          }

          // Final log before returning
          console.log(
            `Final timeSlots array before return: ${timeSlots.length} items`
          );
          console.log("Time slots data:", JSON.stringify(timeSlots));

          return {
            success: true,
            message: `Found movie '${movieTitle}' and extracted showtimes directly`,
            screenshots,
            timeSlots,
            movieTitle,
            theaterName,
          };
        } catch (error) {
          console.error("Error directly extracting time slots:", error);
        }

        // Take screenshot of what we found
        const movieSS = await this.takeScreenshot(
          `movie_${movie.replace(/ /g, "_")}_direct`
        );
        screenshots.push(movieSS);

        // Apply highlighting to the extracted time slots
        if (timeFilter || specificTimes) {
          console.log("Applying time filter highlighting to time slots");
          const startTime = timeFilter?.start?.replace(":", "") || "";
          const endTime = timeFilter?.end?.replace(":", "") || "";

          // Process all time slots to apply highlighting based on filters
          for (let i = 0; i < timeSlots.length; i++) {
            const slot = timeSlots[i];

            // Skip if slot doesn't have a time
            if (!slot.time) continue;

            // Parse the time
            const slotTime = slot.time.trim();
            let hours = 0;
            let minutes = 0;
            let isPM = false;

            // Check for 'a' or 'p' suffix format (like "5:10p")
            if (slotTime.endsWith("a")) {
              hours = parseInt(slotTime.slice(0, -1).split(":")[0]);
              minutes = parseInt(slotTime.slice(0, -1).split(":")[1] || "0");
            } else if (slotTime.endsWith("p")) {
              hours = parseInt(slotTime.slice(0, -1).split(":")[0]);
              minutes = parseInt(slotTime.slice(0, -1).split(":")[1] || "0");
              if (hours < 12) hours += 12; // Convert to 24-hour
            }
            // Check AM/PM format
            else if (slotTime.toLowerCase().includes("am")) {
              hours = parseInt(
                slotTime.toLowerCase().split("am")[0].trim().split(":")[0]
              );
              minutes = parseInt(
                slotTime.toLowerCase().split("am")[0].trim().split(":")[1] ||
                  "0"
              );
            } else if (slotTime.toLowerCase().includes("pm")) {
              hours = parseInt(
                slotTime.toLowerCase().split("pm")[0].trim().split(":")[0]
              );
              minutes = parseInt(
                slotTime.toLowerCase().split("pm")[0].trim().split(":")[1] ||
                  "0"
              );
              if (hours < 12) hours += 12;
            }
            // Try standard time format
            else if (slotTime.includes(":")) {
              hours = parseInt(slotTime.split(":")[0]);
              minutes = parseInt(slotTime.split(":")[1]);
            }

            const slotMinutes = hours * 60 + minutes;

            // Check if within time range filter
            if (startTime && endTime) {
              // Parse start and end times
              let startHours = parseInt(startTime.slice(0, 2));
              let startMinutes = parseInt(startTime.slice(2));
              let endHours = parseInt(endTime.slice(0, 2));
              let endMinutes = parseInt(endTime.slice(2));

              const startTotalMinutes = startHours * 60 + startMinutes;
              const endTotalMinutes = endHours * 60 + endMinutes;

              if (
                slotMinutes >= startTotalMinutes &&
                slotMinutes <= endTotalMinutes
              ) {
                timeSlots[i].isHighlighted = true;
                console.log(
                  `Highlighting time ${slotTime} - within time range ${startTime}-${endTime}`
                );
              }
            }

            // Check if matches specific times
            if (specificTimes && specificTimes.length > 0) {
              for (const specificTime of specificTimes) {
                // Parse specific time
                let specHours = 0;
                let specMinutes = 0;

                if (specificTime.includes(":")) {
                  specHours = parseInt(specificTime.split(":")[0]);
                  specMinutes = parseInt(specificTime.split(":")[1]);
                } else if (specificTime.length === 4) {
                  specHours = parseInt(specificTime.slice(0, 2));
                  specMinutes = parseInt(specificTime.slice(2));
                }

                const specTotalMinutes = specHours * 60 + specMinutes;

                // Compare times
                if (slotMinutes === specTotalMinutes) {
                  timeSlots[i].isHighlighted = true;
                  console.log(
                    `Highlighting time ${slotTime} - matches specific time ${specificTime}`
                  );
                  break;
                }
              }
            }
          }
        } else {
          // If no time filter, highlight all available times
          timeSlots.forEach((slot, index) => {
            // Only highlight times that have valid URLs (available, not expired)
            if (slot.url) {
              timeSlots[index].isHighlighted = true;
              console.log(`Highlighting available time: ${slot.time}`);
            }
          });
        }

        // Final log before returning
        console.log(
          `Final timeSlots array before return: ${timeSlots.length} items`
        );
        console.log("Time slots data:", JSON.stringify(timeSlots));

        return {
          success: true,
          message: `Found movie '${movieTitle}' and extracted showtimes directly`,
          screenshots,
          timeSlots,
          movieTitle,
          theaterName,
        };
      }

      // If we have a container, continue with the original approach
      const containerElement = this.page.locator(`#${movieContainer}`);
      if ((await containerElement.count()) > 0) {
        // Scroll to the movie container to ensure it's visible
        await containerElement.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500); // Reduced from 1000

        // Add a red border to the movie container
        await this.page.evaluate((element) => {
          if (element) {
            element.style.border = "4px solid red";
            element.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
          }
        }, await containerElement.elementHandle());

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

          // Highlight showtimes and extract time slots
          const extractedTimeSlots = await this.page.evaluate(
            ({ element, startTime, endTime, specificTimes }) => {
              if (!element) return [];

              const extractedTimes: Array<{
                time: string;
                url?: string;
                isHighlighted: boolean;
              }> = [];

              console.log(
                `In evaluate: Highlighting times with startTime=${startTime}, endTime=${endTime}`
              );
              console.log(
                `In evaluate: Specific times: ${JSON.stringify(specificTimes)}`
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

              // Special case for showtimes-btn-list
              const showtimeLists = element.querySelectorAll(
                ".showtimes-btn-list"
              );
              if (showtimeLists.length > 0) {
                console.log(
                  `Found ${showtimeLists.length} showtimes-btn-list elements`
                );

                showtimeLists.forEach((list) => {
                  const timeButtons = list.querySelectorAll(".showtime-btn");
                  console.log(
                    `Found ${timeButtons.length} showtime buttons in list`
                  );

                  timeButtons.forEach((button) => {
                    try {
                      const buttonElement = button as HTMLElement;
                      const timeText = buttonElement.innerText.trim();

                      if (!timeText || timeText.length > 10) return;
                      console.log(
                        `Found time in showtimes-btn-list: ${timeText}`
                      );

                      // Get URL if it's an anchor
                      let url = "";
                      if (buttonElement.tagName === "A") {
                        url = (buttonElement as HTMLAnchorElement).href;
                      } else if (buttonElement.closest("a")) {
                        url = (buttonElement.closest("a") as HTMLAnchorElement)
                          .href;
                      }

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
                            buttonTimeLower ===
                              specificTime.amPm.toLowerCase() ||
                            // Also try with AM/PM variants
                            buttonTimeLower ===
                              specificTime.amPm
                                .replace("a", " AM")
                                .toLowerCase() ||
                            buttonTimeLower ===
                              specificTime.amPm
                                .replace("p", " PM")
                                .toLowerCase()
                          ) {
                            shouldHighlight = true;
                            console.log(
                              `Time ${timeText} matches specific time ${specificTime.originalFormat} by format`
                            );
                            break;
                          }
                        }
                      }

                      extractedTimes.push({
                        time: timeText,
                        url: url || undefined,
                        isHighlighted: shouldHighlight,
                      });

                      if (shouldHighlight) {
                        // This showtime is within the requested range or matches specific time
                        console.log(`Highlighting time: ${timeText}`);
                        buttonElement.style.border = "3px solid green";
                        buttonElement.style.boxShadow = "0 0 8px #00FF00";
                        buttonElement.style.backgroundColor = "#006600";
                        buttonElement.style.color = "white";
                        buttonElement.style.fontWeight = "bold";
                      }
                    } catch (error) {
                      console.error(
                        "Error processing button in showtimes-btn-list:",
                        error
                      );
                    }
                  });
                });

                // If we found times in the showtimes-btn-list, just return those
                if (extractedTimes.length > 0) {
                  return extractedTimes;
                }
              }

              // Find all showtime buttons within this movie container
              const showtimeButtons = element.querySelectorAll(
                '.showtimes-btn-list .showtime-btn, .showtime-btn, .btn, a[href*="showtime"], span.showtime-text, button.btn'
              );

              console.log(`Found ${showtimeButtons.length} showtime buttons`);

              showtimeButtons.forEach((button: Element) => {
                try {
                  // Use type assertion to safely access properties
                  const buttonElement = button as HTMLElement;
                  const timeText = buttonElement.innerText.trim();

                  // Skip elements that don't look like times
                  if (!timeText || timeText.length > 10) return;

                  console.log(`Found time: ${timeText}`);

                  // Get the button URL if it's a link
                  let url = "";
                  if (buttonElement.tagName === "A") {
                    url = (buttonElement as HTMLAnchorElement).href;
                  } else if (buttonElement.closest("a")) {
                    url = (buttonElement.closest("a") as HTMLAnchorElement)
                      .href;
                  }

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

                  // Add time to extracted times
                  extractedTimes.push({
                    time: timeText,
                    url: url || undefined,
                    isHighlighted: shouldHighlight,
                  });

                  if (shouldHighlight) {
                    // This showtime is within the requested range or matches specific time
                    console.log(`Highlighting time: ${timeText}`);
                    buttonElement.style.border = "3px solid green";
                    buttonElement.style.boxShadow = "0 0 8px #00FF00";
                    buttonElement.style.backgroundColor = "#006600";
                    buttonElement.style.color = "white";
                    buttonElement.style.fontWeight = "bold";
                  }
                } catch (error) {
                  console.error("Error processing button:", error);
                }
              });

              console.log(`Extracted ${extractedTimes.length} time slots`);
              return extractedTimes;
            },
            {
              element: await containerElement.elementHandle(),
              startTime: timeFilter?.start?.replace(":", "") || "",
              endTime: timeFilter?.end?.replace(":", "") || "",
              specificTimes: specificTimes || [],
            }
          );

          console.log(
            `Extracted ${extractedTimeSlots.length} time slots from the container`
          );

          // Add the extracted time slots to our result
          timeSlots.push(...extractedTimeSlots);

          // Take only the filtered times screenshot
          const movieSS = await this.takeScreenshot(
            `movie_${movie.replace(/ /g, "_")}_filtered_times`,
            `#${movieContainer}`
          );
          screenshots.push(movieSS);
        } else {
          // If no time filter, extract all time slots
          const extractedTimeSlots = await this.page.evaluate((element) => {
            if (!element) return [];

            const extractedTimes: Array<{
              time: string;
              url?: string;
              isHighlighted: boolean;
            }> = [];

            // Special case for showtimes-btn-list
            const showtimeLists = element.querySelectorAll(
              ".showtimes-btn-list"
            );
            if (showtimeLists.length > 0) {
              console.log(
                `Found ${showtimeLists.length} showtimes-btn-list elements`
              );

              showtimeLists.forEach((list) => {
                const timeButtons = list.querySelectorAll(".showtime-btn");
                console.log(
                  `Found ${timeButtons.length} showtime buttons in list`
                );

                timeButtons.forEach((button) => {
                  try {
                    const buttonElement = button as HTMLElement;
                    const timeText = buttonElement.innerText.trim();

                    if (!timeText || timeText.length > 10) return;
                    console.log(
                      `Found time in showtimes-btn-list: ${timeText}`
                    );

                    // Get URL if it's an anchor
                    let url = "";
                    if (buttonElement.tagName === "A") {
                      url = (buttonElement as HTMLAnchorElement).href;
                    } else if (buttonElement.closest("a")) {
                      url = (buttonElement.closest("a") as HTMLAnchorElement)
                        .href;
                    }

                    extractedTimes.push({
                      time: timeText,
                      url: url || undefined,
                      isHighlighted: false,
                    });
                  } catch (error) {
                    console.error(
                      "Error processing button in showtimes-btn-list:",
                      error
                    );
                  }
                });
              });

              // If we found times in the showtimes-btn-list, just return those
              if (extractedTimes.length > 0) {
                return extractedTimes;
              }
            }

            // Find all showtime buttons within this movie container
            const showtimeButtons = element.querySelectorAll(
              '.showtimes-btn-list .showtime-btn, .showtime-btn, .btn, a[href*="showtime"], span.showtime-text, button.btn'
            );

            console.log(`Found ${showtimeButtons.length} showtime buttons`);

            showtimeButtons.forEach((button: Element) => {
              try {
                // Use type assertion to safely access properties
                const buttonElement = button as HTMLElement;
                const timeText = buttonElement.innerText.trim();

                // Skip elements that don't look like times
                if (!timeText || timeText.length > 10) return;

                console.log(`Found time: ${timeText}`);

                // Get the button URL if it's a link
                let url = "";
                if (buttonElement.tagName === "A") {
                  url = (buttonElement as HTMLAnchorElement).href;
                } else if (buttonElement.closest("a")) {
                  url = (buttonElement.closest("a") as HTMLAnchorElement).href;
                }

                // Add time to extracted times - none are highlighted
                extractedTimes.push({
                  time: timeText,
                  url: url || undefined,
                  isHighlighted: false,
                });
              } catch (error) {
                console.error("Error processing button:", error);
              }
            });

            console.log(`Extracted ${extractedTimes.length} time slots`);
            return extractedTimes;
          }, await containerElement.elementHandle());

          console.log(
            `Extracted ${extractedTimeSlots.length} time slots from the container`
          );

          // Add the extracted time slots to our result
          timeSlots.push(...extractedTimeSlots);

          // Take one screenshot
          const movieSS = await this.takeScreenshot(
            `movie_${movie.replace(/ /g, "_")}`,
            `#${movieContainer}`
          );
          screenshots.push(movieSS);
        }
      }

      // Final log before returning
      console.log(
        `Final timeSlots array before return: ${timeSlots.length} items`
      );
      console.log("Time slots data:", JSON.stringify(timeSlots));

      return {
        success: true,
        message: `Found movie '${movie}' on theater page`,
        screenshots,
        timeSlots,
        movieTitle,
        theaterName,
      };
    } catch (error) {
      console.error(`Error finding movie on theater page: ${error}`);
      return {
        error: `Error finding movie on theater page: ${error}`,
        screenshots,
        timeSlots,
        movieTitle,
        theaterName,
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

  async processQuery(query: ScraperQuery): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    const results: ScraperResult = {
      message: "Processing complete",
      screenshots: [], // Initialize screenshots with empty array
    };

    // Set aggressive timeouts for better performance
    if (this.page) {
      await this.page.setDefaultTimeout(this.timeout);
      await this.page.setDefaultNavigationTimeout(this.timeout);
    }

    try {
      // Navigate to Fandango.com
      await this.navigateToFandango();

      // Create time filter from query
      const timeFilter = query.time_range;

      // Get specific times if provided
      const specificTimes = query.specific_times || [];

      // Process the primary search object first - prioritize Movie > Theater > Location
      if (query.movie && query.theater) {
        // If we have both movie and theater, go directly to theater then find movie
        console.log(`Starting with theater search: ${query.theater}`);
        const theaterResult = await this.searchTheater(query.theater);

        if (!theaterResult.error) {
          console.log(`Now looking for movie ${query.movie} on theater page`);
          const movieResult = await this.findMovieOnTheaterPage(
            query.movie,
            timeFilter,
            specificTimes
          );

          // Log movie result details
          console.log(
            `Movie search result: success=${movieResult.success}, timeSlots=${
              movieResult.timeSlots ? movieResult.timeSlots.length : 0
            }`
          );

          // Copy all properties from movieResult to results
          if (movieResult.screenshots && movieResult.screenshots.length > 0) {
            results.screenshots = results.screenshots || [];
            results.screenshots.push(...movieResult.screenshots);
          }

          // Make sure to copy the timeSlots
          if (movieResult.timeSlots && movieResult.timeSlots.length > 0) {
            results.timeSlots = movieResult.timeSlots;
            console.log(
              `Added ${results.timeSlots.length} time slots to final results`
            );
          }

          // Copy other properties
          if (movieResult.movieTitle) {
            results.movieTitle = movieResult.movieTitle;
          }
          if (movieResult.theaterName) {
            results.theaterName = movieResult.theaterName;
          }

          if (movieResult.error) {
            results.error = movieResult.error;
            console.log(`Error finding movie: ${movieResult.error}`);
          }
          return results;
        }
      }

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
              if (
                movieResult.screenshots &&
                movieResult.screenshots.length > 0
              ) {
                results.screenshots = results.screenshots || [];
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
              if (
                movieResult.screenshots &&
                movieResult.screenshots.length > 0
              ) {
                results.screenshots = results.screenshots || [];
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
          if (movieResult.screenshots && movieResult.screenshots.length > 0) {
            results.screenshots = results.screenshots || [];
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

  // Add a new method to manage cookies for better acceptance
  async manageCookies() {
    if (!this.page) throw new Error("Page not initialized");

    try {
      // Get all cookies to see what we have
      const cookies = (await this.context?.cookies()) || [];
      console.log(`Current cookies count: ${cookies.length}`);

      // Set some common cookies that might help authentication
      await this.context?.addCookies([
        {
          name: "OptanonAlertBoxClosed",
          value: new Date().toISOString(),
          domain: ".fandango.com",
          path: "/",
        },
        {
          name: "OptanonConsent",
          value:
            "isGpcEnabled=0&datestamp=" +
            new Date().toISOString() +
            "&version=6.26.0",
          domain: ".fandango.com",
          path: "/",
        },
        {
          name: "fdvisttyp",
          value: "returning",
          domain: ".fandango.com",
          path: "/",
        },
        // Add cookies that indicate we're a regular browser user
        {
          name: "fdprefercookies",
          value: "true",
          domain: ".fandango.com",
          path: "/",
        },
        {
          name: "fd_usertk",
          value: new Date().getTime().toString(),
          domain: ".fandango.com",
          path: "/",
        },
        {
          name: "fdexperience",
          value: "browser",
          domain: ".fandango.com",
          path: "/",
        },
        // Add a session cookie
        {
          name: "fdvisittk",
          value: this.generateVisitToken(),
          domain: ".fandango.com",
          path: "/",
        },
        // Add cookie to bypass bot detection
        {
          name: "_abck",
          value: this.generateAbckToken(),
          domain: ".fandango.com",
          path: "/",
        },
      ]);

      return true;
    } catch (error) {
      console.error("Error managing cookies:", error);
      return false;
    }
  }

  // Helper method to generate a visit token similar to what Fandango uses
  private generateVisitToken(): string {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000000);
    return `${timestamp}${random}`;
  }

  // Helper method to generate an Akamai bot detection cookie
  private generateAbckToken(): string {
    // This is just a simplified version - real tokens are more complex
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000000);
    return `0~${random}~${timestamp}~AAA_~_~-1~-1~-1`;
  }

  // Add a method to navigate to time slot through movie details to avoid direct ticket page access
  async navigateToTimeSlotSafely(timeSlotUrl: string): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Attempting to navigate safely to time slot: ${timeSlotUrl}`);
    const screenshots: string[] = [];

    try {
      // Store the current page URL so we can go back if needed
      this.currentPage = this.page.url();

      // First visit Fandango.com to set up session
      await this.navigateToFandango();
      await this.manageCookies();

      // Extract parameters from query string
      let movieId = null;
      let theaterId = null;
      try {
        const urlObj = new URL(timeSlotUrl);
        const params = urlObj.searchParams;

        // Check for movie ID in mid parameter
        if (params.has("mid")) {
          movieId = params.get("mid");
          console.log(`Extracted movie ID from query parameter: ${movieId}`);
        }

        // Check for theater ID in tid parameter
        if (params.has("tid")) {
          theaterId = params.get("tid");
          console.log(
            `Extracted theater ID from query parameter: ${theaterId}`
          );
        }
      } catch (error) {
        console.log(`Error parsing URL: ${error}`);
      }

      if (movieId) {
        console.log(`Using movie ID: ${movieId}`);

        // First navigate to the movie page
        const moviePageUrl = `https://www.fandango.com/${movieId}`;
        console.log(`Navigating to movie page first: ${moviePageUrl}`);

        await this.page.goto(moviePageUrl, {
          waitUntil: "domcontentloaded",
          timeout: this.timeout,
        });

        await this.waitForNavigation();
        await this.manageCookies();

        // Now try to navigate to the time slot with the movie page as referer
        console.log(`Now navigating to time slot from movie page`);
        return await this.navigateToTimeSlotAndGetSeatMap(timeSlotUrl, {
          referer: moviePageUrl,
        });
      } else if (theaterId) {
        console.log(`Using theater ID: ${theaterId}`);

        // Navigate to the theater page
        const theaterPageUrl = `https://www.fandango.com/${theaterId}`;
        console.log(`Navigating to theater page first: ${theaterPageUrl}`);

        await this.page.goto(theaterPageUrl, {
          waitUntil: "domcontentloaded",
          timeout: this.timeout,
        });

        await this.waitForNavigation();
        await this.manageCookies();

        // Now try to navigate to the time slot with the theater page as referer
        console.log(`Now navigating to time slot from theater page`);
        return await this.navigateToTimeSlotAndGetSeatMap(timeSlotUrl, {
          referer: theaterPageUrl,
        });
      } else {
        // If we couldn't extract useful IDs, try with homepage as referer
        console.log(
          "Could not extract IDs, using Fandango homepage as referer"
        );
        return await this.navigateToTimeSlotAndGetSeatMap(timeSlotUrl, {
          referer: "https://www.fandango.com/",
        });
      }
    } catch (error) {
      console.error(`Error in safe navigation: ${error}`);

      // Take a screenshot of the current state
      try {
        const errorSS = await this.takeScreenshot("safe_navigation_error");
        screenshots.push(errorSS);
      } catch (ssError) {
        console.error(`Error taking error screenshot: ${ssError}`);
      }

      return {
        error: `Failed in safe navigation to time slot: ${error}`,
        screenshots,
      };
    }
  }

  // Add a new method to navigate to a specific time slot and get seat map
  async navigateToTimeSlotAndGetSeatMap(
    timeSlotUrl: string,
    options?: { referer?: string }
  ): Promise<ScraperResult> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Navigating to time slot URL: ${timeSlotUrl}`);
    const screenshots: string[] = [];

    try {
      // Store the current page URL so we can go back if needed
      this.currentPage = this.page.url();

      // Try with a different user agent for this specific request
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
      ];

      // Select a random user agent
      const randomUserAgent =
        userAgents[Math.floor(Math.random() * userAgents.length)];

      // Set user agent through context options
      await this.page.setExtraHTTPHeaders({
        "User-Agent": randomUserAgent,
      });

      console.log(`Using user agent: ${randomUserAgent}`);

      // Update browser settings to avoid detection
      const headers: Record<string, string> = {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        // Add headers to look like a normal browser
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        // Add random browser features
        "sec-ch-ua": `"${
          randomUserAgent.includes("Chrome") ? "Google Chrome" : "Not=A?Brand"
        }";v="${Math.floor(Math.random() * 20) + 110}", "Chromium";v="${
          Math.floor(Math.random() * 20) + 110
        }"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": `"${
          randomUserAgent.includes("Windows")
            ? "Windows"
            : randomUserAgent.includes("Mac")
            ? "macOS"
            : "Linux"
        }"`,
      };

      // Add referer if provided
      if (options?.referer) {
        headers["Referer"] = options.referer;
      } else {
        headers["Referer"] = "https://www.fandango.com/";
      }

      await this.page.setExtraHTTPHeaders(headers);

      // Emulate normal user behavior by briefly scrolling before proceeding
      await this.page.evaluate(() => {
        // Simulate random scrolling behavior
        window.scrollTo(0, 100);
      });

      // Wait briefly between actions to look more human-like
      await this.page.waitForTimeout(Math.random() * 1000 + 500);

      // Navigate to the time slot URL
      const response = await this.page.goto(timeSlotUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.timeout,
      });

      // Check if we got an Access Denied response
      if (response && response.status() === 403) {
        console.log("Access Denied (403) response received from Fandango");

        // Take a screenshot of the access denied page
        const accessDeniedSS = await this.takeScreenshot("access_denied_page");
        screenshots.push(accessDeniedSS);

        return {
          success: false,
          error:
            "Access Denied: Fandango has blocked access to the seat map. This may be due to anti-scraping measures.",
          message:
            "Could not access seat selection page due to website restrictions",
          screenshots,
        };
      }

      // Check for access denied message in page content
      const pageContent = await this.page.content();
      if (
        pageContent.includes("Access Denied") ||
        pageContent.includes("You don't have permission")
      ) {
        console.log("Access Denied message found in page content");

        const accessDeniedSS = await this.takeScreenshot("access_denied_page");
        screenshots.push(accessDeniedSS);

        return {
          success: false,
          error:
            "Access Denied: Fandango has blocked access to the seat map. This may be due to anti-scraping measures.",
          message:
            "Could not access seat selection page due to website restrictions",
          screenshots,
        };
      }

      // Wait for the page to load
      await this.waitForNavigation();
      await this.page.waitForTimeout(1000);

      // Look for the specific seat map container with ID "mapZoom"
      const seatMapZoom = this.page.locator("#mapZoom.seat-map__container");
      if ((await seatMapZoom.count()) > 0) {
        console.log("Found seat map container with ID 'mapZoom'");

        // Take a screenshot of the seat map zoom container
        const seatMapSS = await this.takeScreenshot(
          "seat_map_zoom",
          "#mapZoom.seat-map__container"
        );
        screenshots.push(seatMapSS);

        return {
          success: true,
          message: "Successfully captured seat map container",
          screenshots,
        };
      }

      // Look for the general seat map container as fallback
      const seatMapContainer = this.page.locator(".seat-map__container");

      if ((await seatMapContainer.count()) > 0) {
        console.log("Found general seat map container");

        // Take a screenshot of the seat map
        const seatMapSS = await this.takeScreenshot(
          "seat_map",
          ".seat-map__container"
        );
        screenshots.push(seatMapSS);

        return {
          success: true,
          message: "Successfully navigated to seat map",
          screenshots,
        };
      } else {
        // Try to find any seats or seat map related elements
        const seatsContainer = this.page.locator(
          "div:has(.seat-map__seat), .seat-map, .seating-chart"
        );

        if ((await seatsContainer.count()) > 0) {
          console.log("Found seat container");
          const seatMapSS = await this.takeScreenshot(
            "seat_map",
            "div:has(.seat-map__seat), .seat-map, .seating-chart"
          );
          screenshots.push(seatMapSS);

          return {
            success: true,
            message: "Found seat map (alternative selector)",
            screenshots,
          };
        }

        // If we couldn't find the seat map, take a screenshot of the whole page
        const pageSS = await this.takeScreenshot("time_slot_page");
        screenshots.push(pageSS);

        return {
          success: false,
          error: "Could not find seat map container",
          screenshots,
        };
      }
    } catch (error) {
      console.error(`Error navigating to time slot: ${error}`);

      // Take a screenshot of the current state
      try {
        const errorSS = await this.takeScreenshot("time_slot_error");
        screenshots.push(errorSS);
      } catch (ssError) {
        console.error(`Error taking error screenshot: ${ssError}`);
      }

      return {
        error: `Failed to navigate to time slot: ${error}`,
        screenshots,
      };
    }
  }
}

export {
  FandangoScraper,
  type ScraperQuery,
  type TimeRange,
  type ScraperResult,
  type TimeSlot,
};
