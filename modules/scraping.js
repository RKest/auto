const puppeteer = require("puppeteer");
const util = require("util");
const sleep = util.promisify(setTimeout);
const LOCATION = "https://gero.icnea.net";
const DEF_LOCATION = LOCATION + "/HosOrdEntrades.aspx"

const tableReqQuerySelectorAll = ".table-condensed > tbody > tr > td:nth-child(14n + 5) > a";
const tableServiceSelectorAll = ".table-condensed > tbody > tr > td:nth-child(14n + 13)";
const guestTableRowSelectorAll = ".table-condensed > tbody > tr";
const doesHaveVirtualCardTextareaDeterminatorSelector = "textarea#obs_canal";
const personsSelectors = ["input#personesG, input#personesG, input#personesG"];
const hasPaidTheDepositCandidateSelector = "td.text-right:not(.text-danger):not(.form-inline):not([colspan='2'])";
const bookingTabAnchorSelector = "a#Menus_M1";
const guestsTabAnchorSelector = "a#Menus_M2";

const url_guest_appSelector = "a#App";
const pageGotoOptions = { waitUntil: "networkidle0" };

const awaitClick = async (el, page) => {
    await Promise.all([
        el.click(),
        page.waitForNavigation(pageGotoOptions)
    ]);
}

const scrape = async () => {
    const browserURL = "http://127.0.0.1:9222";
    const browser = await puppeteer.connect({browserURL});
    const page = await browser.newPage();
    await page.goto(DEF_LOCATION, pageGotoOptions);
    const reqQueries = await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.href));
    const services = await page.$$eval(tableServiceSelectorAll, els => els.map(el => el.textContent.trim()));
    const hasVCs = [];
    const hasGuestsFIlledOut = [];
    const hasPaidThePrices = [];
    const hasPaidDeposits = [];
    const urlGuestApps = [];
    for(const query of reqQueries){
        const temp_page = await browser.newPage();
        await temp_page.goto(query, pageGotoOptions);

        var noPersons = 0;
        for(const personsSelector of personsSelectors)
            noPersons += +(await temp_page.$eval(personsSelector, el => el.value));

        const url_guest_app = await temp_page.$eval(url_guest_appSelector, el => el.href);
        urlGuestApps.push(url_guest_app);

        const hasVC = await temp_page.$eval(doesHaveVirtualCardTextareaDeterminatorSelector, 
                el => /crédito virtual/.test(el.textContent.trim()));
        hasVCs.push(hasVC);

        const bookingTabAnchor = await temp_page.$(bookingTabAnchorSelector);
        await awaitClick(bookingTabAnchor, temp_page);

        const hasPaidDeposit = await temp_page.$$eval(hasPaidTheDepositCandidateSelector, els => {
            const lastElNodes = els[els.length - 1].childNodes;
            return lastElNodes.length === 1;
        });
        hasPaidDeposits.push(hasPaidDeposit);        

        const guestsTabAnchor = await temp_page.$(guestsTabAnchorSelector);
        await awaitClick(guestsTabAnchor, temp_page);
        const guestTrs = await temp_page.$$(guestTableRowSelectorAll);
        hasGuestsFIlledOut.push(!!guestTrs.length && guestTrs.length === noPersons);
        
        temp_page.close();
    }



    page.close();
}

exports.scrape = scrape;