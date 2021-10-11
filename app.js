const scraper = require("./modules/scraping");
const parser = require("./modules/parsing");

const express = require("express");
const fs = require("fs/promises");
const app = express();

app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const CASHE_PATH = __dirname + "/public/index.html";
const VIEW_PATH = __dirname + "/views";

(async () => {
    app.route("/")
    .get((_, res) => {
        res.send("Hello");
    })
    .post((req, res) => {
        const email = req.body.email;
        const passwd = req.body.passwd;
        const date = JSON.parse(req.body.date);
        console.log(email, passwd, date);

        scraper.scrape(email, passwd)
        .then(obj => {
            fs.writeFile(CASHE_PATH, parser.parse(obj), "utf-8")  
        })
        .then(() => {
            res.statusCode = 200;
            res.send("http://localhost:8080/data");
        })
        .catch(e => {
            res.statusCode = 400;
            res.send(e);
        });
    });
    /*
    app.get("/data", (_, res) => {
        res.sendFile(CASHE_PATH);
    });
    */
})();

app.listen(8080, () => {
    console.log("http://localhost:8080");
});

