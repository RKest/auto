const scraper = require("./modules/scraping");
const parser = require("./modules/parsing");

const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.static(__dirname + "/public"));

const CASHE_PATH = __dirname + "/public/index.html";

(async () => {
    const obj = await scraper.scrape();
    fs.writeFileSync(CASHE_PATH, parser.parse(obj), "utf-8");
    app.get("/", (_, res) => {
        res.sendFile(CASHE_PATH);
    });
})();

app.listen(8080, () => {
    console.log("http://localhost:8080");
});

