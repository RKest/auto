const scraper = require("./modules/scraping");
const parser = require("./modules/parsing");

const express = require("express");
const fs = require("fs");
const app = express();

app.use(express.static(__dirname + "/public"));
app.use(express.json());

const VIEW_PATH = __dirname + "/views";
const CASHE_PATH = VIEW_PATH + "/table.html";

app.route("/") 
.get((req, res) => {
    console.log(req.method);
    res.sendFile(VIEW_PATH + "/index.html");
})
.post((req, res) => {
    const email = req.body.email;
    const passwd = req.body.passwd;
    const date = JSON.parse(req.body.date);
    console.log(email, passwd, date);

    scraper.scrape(email, passwd)
    .then(obj => {
        fs.writeFileSync(CASHE_PATH, parser.parse(obj), "utf-8");
        res.statusCode = 200;
        res.send("http://localhost:8080/data");
    })
    .catch(e => {
        res.statusCode = 400;
        res.send(e);
    });
});

app.all("/data", (_, res) => {
    res.sendFile(CASHE_PATH);
});

app.listen(80, () => {
    console.log("http://localhost");
});

