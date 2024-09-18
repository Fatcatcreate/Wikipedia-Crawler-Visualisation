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

// Delay function to add pauses between requests
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetch page with retry logic
async function fetchPage(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const response = await axios.get(url, { maxRedirects: 5 });
      return response.data;
    } catch (err) {
      //console.error(`Error fetching page: ${url}`, err.message);
      retries--;
      if (retries === 0) {
        //console.error(`Failed to fetch page after multiple attempts: ${url}`);
        return null;
      }
      await delay(1000);
    }
  }
}

async function main(maxPages = 5000) {
  const paginationURLsToVisit = [
    "https://en.wikipedia.org/wiki/Battle_of_Havana_(1748)?wprov=sfti1",
  ];
  const visitedURLs = [];
  const pageLinkMapping = [];

  while (paginationURLsToVisit.length !== 0 && visitedURLs.length <= maxPages) {
    const currentURL = paginationURLsToVisit.pop();

    if (visitedURLs.includes(currentURL)) {
      continue;
    }

    const pageHTML = await fetchPage(currentURL);
    if (!pageHTML) {
      continue;
    }

    visitedURLs.push(currentURL);

    const $ = cheerio.load(pageHTML);

    console.log(visitedURLs.length / maxPages);

    const pageLinks = [];
    $("a[href]").each((index, element) => {
      const link = $(element).attr("href");
      if (
        link &&
        !link.startsWith("#") &&
        !link.startsWith("javascript:") &&
        link.length < 2000
      ) {
        const absoluteURL = new URL(link, currentURL).href;

        // Skip if URL is from a problematic domain or path
        if (
          !visitedURLs.includes(absoluteURL) &&
          !paginationURLsToVisit.includes(absoluteURL) &&
          !absoluteURL.includes("Special:") &&
          !absoluteURL.includes("User:") &&
          !absoluteURL.includes("Help:") &&
          !absoluteURL.includes("Main_Page") &&
          !absoluteURL.includes(
            "github.com/creativecommons/global-network-strategy"
          )
        ) {
          paginationURLsToVisit.push(absoluteURL);
        }

        pageLinks.push(absoluteURL);
      }
    });

    if (pageLinks.length > 0) {
      pageLinkMapping.push({
        page: currentURL,
        links: pageLinks,
      });
    }

    await delay(1000);
  }

  try {
    fs.writeFileSync(
      "pageLinkMapping.json",
      JSON.stringify(pageLinkMapping, null, 2)
    );
    console.log("Data successfully written to pageLinkMapping.json");
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
    console.error(e);
    process.exit(1);
  });
