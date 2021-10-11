const scraper = require("./modules/scraping");
const parser = require("./modules/parsing");

const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.static(__dirname + "/public"));
app.use(express.json());

const VIEW_PATH = __dirname + "/views";
const CASHE_PATH = VIEW_PATH + "/table.html";

const progressObj = {i: 0, outof: 1};

app.route("/") 
.get((req, res) => {
    res.sendFile(VIEW_PATH + "/index.html");
    progressObj.i = 0;
    progressObj.outof = 1;
})
.post((req, res) => {
    const email = req.body.email;
    const passwd = req.body.passwd;
    const date = req.body.date;
    progressObj.i = 0;
    progressObj.outof = 1;

    scraper.scrape(email, passwd, date, progressObj)
    .then(obj => {
        fs.writeFileSync(CASHE_PATH, parser.parse(obj), "utf-8");
        res.statusCode = 200;
        res.send("http://localhost/data");
    })
    .catch(e => {
        res.statusCode = 400;
        console.log(e);
        res.send(e);
    });
});

app.get("/data", (_, res) => {
    res.sendFile(CASHE_PATH);
});

app.listen(80, () => {
    console.log("http://localhost");
});

