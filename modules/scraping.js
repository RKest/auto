const puppeteer = require("puppeteer");
const util = require("util");
const sleep = util.promisify(setTimeout);
const LOCATION = "https://gero.icnea.net";
const DEF_LOCATION = LOCATION + "/HosOrdEntrades.aspx"

const INDIFFERENCE_AMOUNT = 10.0;
const DEPOSIT_AMOUNT = 150.0;

//const howManyNights = "#liNits";
const tableReqQueryOffset = 5;

const NO_TABLE_COLS = 14;

const tableReqQuerySelectorAll = ".table-condensed > tbody > tr > td:nth-child(14n + 5) > a";
const guestTableRowSelectorAll = ".table-condensed > tbody > tr";
const doesHaveVirtualCardTextareaDeterminatorSelector = "textarea#obs_canal";
const depositHasBenDeclaredDeterminantSelectorAll = ".table-condensed > tbody > tr";
const hasPaidTheDepositCandidateSelector = "td.text-right:not(.text-danger):not(.form-inline):not([colspan='2'])";
const toPayAmountSelector = ".warning > td > strong";
const personsSelectors = ["input#personesG, input#personesG, input#personesG"];
const outstandingPaymentSelector = "td > strong.text-danger";
const bookingTabAnchorSelector = "a#Menus_M1";
const guestsTabAnchorSelector = "a#Menus_M2";

const url_guest_appSelector = "a#App";
const pageGotoOptions = { waitUntil: "networkidle2" };

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

    const Contents = [];
    const Headers = [];
    const reqQueries = await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.href));
    for(var i = tableReqQueryOffset + 1; i < NO_TABLE_COLS; i++){
        const contentsSelectorAll = `.table-condensed > tbody > tr > td:nth-child(${NO_TABLE_COLS}n + ${i})`;
        const headersSelector = `.table-condensed > thead > tr > th:nth-child(${i})`;
        const data = await page.$$eval(contentsSelectorAll, els => els.map(el => el.textContent.trim()));
        const head = await page.$eval(headersSelector, el => el.childNodes[0].textContent.trim());
        Contents.push(data);
        Headers.push(head);
    }

    const services = Contents[Contents.length - 1];

    const hasGuestsFIlledOut = [];
    const hasPaidThePrices = [];
    const hasPaidDeposits = [];
    const urlGuestApps = [];
    const paymentDifferences = [];
    for(var i = 0; i < reqQueries.length; i++){
        const query = reqQueries[i];
        const temp_page = await browser.newPage();
        await temp_page.goto(query, pageGotoOptions);
        
        var noPersons = 0;
        for(const personsSelector of personsSelectors)
            noPersons += +(await temp_page.$eval(personsSelector, el => el.value));

        const url_guest_app = await temp_page.$eval(url_guest_appSelector, el => el.href);
        urlGuestApps.push(url_guest_app);

        const hasVC = await temp_page.$eval(doesHaveVirtualCardTextareaDeterminatorSelector, 
                el => /crédito virtual/.test(el.textContent.trim()));
        const bookingTabAnchor = await temp_page.$(bookingTabAnchorSelector);
        await awaitClick(bookingTabAnchor, temp_page);

        /*
        const howLongStay = await temp_page.$eval(howManyNights, el => 
            +el.childNodes[4].textContent.trim());
        */
        const service = services[i];
        if(service === "booking")
        {
            const toPayAmout = await temp_page.$eval(toPayAmountSelector, el => 
                +el.textContent.trim().slice(0, -2));
            const difference = await temp_page.$eval(outstandingPaymentSelector, el => 
                +el.textContent.trim().slice(0,-2));
            const hasMadeDepositTransaction = await temp_page.$$eval(hasPaidTheDepositCandidateSelector, els => {
                const lastElNodes = els[els.length - 1].childNodes;
                return lastElNodes.length === 1;
            });
            const hasDepositExtra = await temp_page.$$eval(depositHasBenDeclaredDeterminantSelectorAll, els => {
                var ret = false;
                for(var i = 0; i < els.length; i++){
                    const elsChildrenNodes = els[i].childNodes;
                    const elsTitleNode = elsChildrenNodes[1].textContent.trim();
                    if(elsTitleNode === "deposit")
                        ret = true;
                }
                return ret;
            });
            if(hasVC)
            {
                const hasPaidDeposit = 
                    ( hasDepositExtra && Math.abs(toPayAmout - difference - DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT) ||
                    (!hasDepositExtra && Math.abs(toPayAmout - difference) < INDIFFERENCE_AMOUNT) ||
                    hasMadeDepositTransaction;
                hasPaidDeposits.push(hasPaidDeposit);
                hasPaidThePrices.push(true);
                paymentDifferences.push(0);
            }
            else
            {
                const hasPaidDeposit = 
                    ( hasDepositExtra && Math.abs(difference) < INDIFFERENCE_AMOUNT) ||
                    (!hasDepositExtra && Math.abs(difference + DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT) ||
                    hasMadeDepositTransaction;
                hasPaidDeposits.push(hasPaidDeposit);
                hasPaidThePrices.push(difference < INDIFFERENCE_AMOUNT);
                paymentDifferences.push(difference);
            }
        }
        else if(service === "airbnb-online")
        {
            hasPaidDeposits.push(true);
            hasPaidThePrices.push(true);
            paymentDifferences.push(0);
        }
        else
            throw "Unknown service"

        const guestsTabAnchor = await temp_page.$(guestsTabAnchorSelector);
        await awaitClick(guestsTabAnchor, temp_page);
        const guestTrs = await temp_page.$$(guestTableRowSelectorAll);
        hasGuestsFIlledOut.push(!!guestTrs.length && guestTrs.length === noPersons);

        temp_page.close();
    }

    console.log({hasPaidDeposits});
    console.log({hasPaidThePrices});
    console.log({hasGuestsFIlledOut});
    console.log({paymentDifferences});

    page.close();
    return {Headers, Contents};
}

exports.scrape = scrape;