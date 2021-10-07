const scraper = require("./modules/scraping");
const parser = require("./modules/parsing");

(async () => {
    const obj = await scraper.scrape();
    console.log(parser.parse(obj));
})();