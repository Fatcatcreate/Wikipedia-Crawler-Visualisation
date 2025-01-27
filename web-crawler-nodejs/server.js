const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/pageLinkMapping.json", (req, res) => {
  res.sendFile(path.join(__dirname, "pageLinkMapping.json"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  let retries = 3;
  let delayTime = 1000;
  while (retries > 0) {
    try {
      const response = await axios.get(url, { maxRedirects: 5 });
      return response.data;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error(`Failed to fetch page after multiple attempts: ${url}`);
        return null;
      }
      await delay(delayTime);
      delayTime *= 2;
    }
  }
}

function normalizeURL(link, baseURL) {
  try {
    const urlObj = new URL(link, baseURL);
    return urlObj.href;
  } catch (error) {
    console.error(`Invalid URL: ${link}`);
    return null;
  }
}

async function main(maxPages = 10000, concurrency = 10) {
  const paginationURLsToVisit = new Set([
    "https://en.wikipedia.org/wiki/Battle_of_Havana_(1748)?wprov=sfti1",
  ]);
  const visitedURLs = new Set();
  const pageLinkMapping = [];

  const crawlBatch = async (urls) => {
    const promises = Array.from(urls).map(async (currentURL) => {
      if (!visitedURLs.has(currentURL) && visitedURLs.size < maxPages) {
        const pageHTML = await fetchPage(currentURL);
        if (!pageHTML) return;

        visitedURLs.add(currentURL);
        const $ = cheerio.load(pageHTML);

        const pageLinks = [];
        $("a[href]").each((index, element) => {
          const link = $(element).attr("href");
          if (
            link &&
            !link.startsWith("#") &&
            !link.startsWith("javascript:") &&
            link.length < 2000
          ) {
            const absoluteURL = normalizeURL(link, currentURL);
            if (
              absoluteURL &&
              absoluteURL.includes("wikipedia") &&
              !visitedURLs.has(absoluteURL) &&
              !paginationURLsToVisit.has(absoluteURL) &&
              !absoluteURL.includes("Special:") &&
              !absoluteURL.includes("User:") &&
              !absoluteURL.includes("Help:") &&
              !absoluteURL.includes("Main_Page") &&
              !absoluteURL.includes("github.com")
            ) {
              paginationURLsToVisit.add(absoluteURL);
            }

            if (absoluteURL) {
              pageLinks.push(absoluteURL);
            }
          }
        });

        if (pageLinks.length > 0) {
          pageLinkMapping.push({
            page: currentURL,
            links: pageLinks,
          });
        }
      }
    });

    await Promise.all(promises);
  };

  while (paginationURLsToVisit.size > 0 && visitedURLs.size < maxPages) {
    const urlsToVisit = new Set(
      Array.from(paginationURLsToVisit).slice(0, concurrency)
    );
    urlsToVisit.forEach((url) => paginationURLsToVisit.delete(url));

    await crawlBatch(urlsToVisit);
    console.log(`${visitedURLs.size}/${maxPages} pages crawled`);

    await delay(500);
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
  .then(() => {
    console.log("Crawl completed.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
