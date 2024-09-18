const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000; // You can change this to any port you like

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Route to serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/pageLinkMapping.json", (req, res) => {
  res.sendFile(path.join(__dirname, "pageLinkMapping.json"));
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

async function main(maxPages = 50) {
  // Initialized with the first webpage to visit
  const paginationURLsToVisit = ["https://www.scrapingcourse.com/ecommerce/"];
  const visitedURLs = [];

  // This will store an array of objects where each object contains the page URL and the associated links found
  const pageLinkMapping = [];

  // Iterating until the queue is empty or the iteration limit is hit
  while (paginationURLsToVisit.length !== 0 && visitedURLs.length <= maxPages) {
    // The current webpage to crawl
    const currentURL = paginationURLsToVisit.pop();

    // Prevent re-visiting the same URL
    if (visitedURLs.includes(currentURL)) {
      continue;
    }

    // Retrieving the HTML content from the current URL
    try {
      const pageHTML = await axios.get(currentURL);

      // Adding the current webpage to the list of visited URLs
      visitedURLs.push(currentURL);

      // Initializing cheerio on the current webpage
      const $ = cheerio.load(pageHTML.data);

      // Retrieving all the <a> tags with href attributes (standard link elements)
      const pageLinks = [];
      $("a[href]").each((index, element) => {
        const link = $(element).attr("href");

        // Only add valid, non-anchor links (e.g., ignore #hash fragments)
        if (link && !link.startsWith("#") && !link.startsWith("javascript:")) {
          const absoluteURL = new URL(link, currentURL).href; // Resolve relative URLs

          // Add to the queue if it's a valid new URL and not yet visited
          if (
            !visitedURLs.includes(absoluteURL) &&
            !paginationURLsToVisit.includes(absoluteURL)
          ) {
            paginationURLsToVisit.push(absoluteURL);
          }

          pageLinks.push(absoluteURL); // Store the link found on the current page
        }
      });

      // If any links were found, store them with the page URL
      if (pageLinks.length > 0) {
        pageLinkMapping.push({
          page: currentURL,
          links: pageLinks,
        });
      }
    } catch (err) {
      console.error(`Error fetching page: ${currentURL}`, err.message);
    }
  }

  // Append the crawl results to a JSON file
  try {
    fs.writeFileSync(
      "pageLinkMapping.json",
      JSON.stringify(pageLinkMapping, null, 2)
    );
    console.log("Data successfully appended to pageLinkMapping.json");
  } catch (err) {
    console.error("Error writing to JSON file", err.message);
  }

  return pageLinkMapping;
}

main()
  .then((result) => {
    console.log("Crawl completed.");
    process.exit(0);
  })
  .catch((e) => {
    // Logging the error message
    console.error(e);
    process.exit(1);
  });
