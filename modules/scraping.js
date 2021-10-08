const puppeteer = require("puppeteer");
const util = require("util");
const sleep = util.promisify(setTimeout);
const LOCATION = "https://gero.icnea.net";
const DEF_LOCATION = LOCATION + "/HosOrdEntrades.aspx"

const INDIFFERENCE_AMOUNT = 10.0;
const DEPOSIT_AMOUNT = 150.0;
const NO_TABLE_COLS = 14;

//const howManyNights = "#liNits";
const initialOffset = 5;
const tableDateTimeOffset = 0;
const tablePropertyOffset = 1;

const tablePassportNumberSelector = ".table-condensed > tbody > tr > td:nth-child(7)";
const tableReqQuerySelectorAll = ".table-condensed > tbody > tr > td:nth-child(14n + 5) > a";
const guestTableRowSelectorAll = ".table-condensed > tbody > tr";
const doesHaveVirtualCardTextareaDeterminatorSelector = "textarea#obs_canal";
const depositHasBenDeclaredDeterminantSelectorAll = ".table-condensed > tbody > tr";
const hasPaidTheDepositCandidateSelector = "td.text-right:not(.text-danger):not(.form-inline):not([colspan='2'])";
const toPayAmountSelector = ".warning > td > strong";
const personsSelectors = ["input#personesG", "input#personesM", "input#personesP"];
const outstandingPaymentSelector = "td > strong.text-danger";
const bookingTabAnchorSelector = "a#Menus_M1";
const guestsTabAnchorSelector = "a#Menus_M2";
const departureDateSelector = "input#sortida";

const url_guest_appSelector = "a#App";
const pageGotoOptions = { waitUntil: "networkidle2" };

const splitDateTime = dateString => {
    const datePart = dateString.slice(0, 10).trim();
    const timePart = dateString.slice(11).trim();
    return [datePart, timePart];
}

const awaitClick = async (el, page) => {
    await Promise.all([
        el.click(),
        page.waitForNavigation(pageGotoOptions)
    ]);
}

const dateFromString = dateString => {
    const parts = dateString.split("/");
    return new Date(parseInt(parts[2], 10),
                    parseInt(parts[1], 10) - 1,
                    parseInt(parts[0], 10));
}

//StringFormat is dd/mm/yyyy
const nDaysFromGivenDate = (dateString, num) => {
    const date = dateFromString(dateString);
    date.setDate(date.getDate() + num);
    return date;
}

const scrape = async () => {
    const browserURL = "http://127.0.0.1:9222";
    const browser = await puppeteer.connect({browserURL});
    const cleanApts = await cleanApartamentNames(browser);
    const page = await browser.newPage();
    await page.goto("https://gero.icnea.net/HosOrdEntrades.aspx?data=09/10/2021&Tar=0", pageGotoOptions);

    var Contents = [];
    var Headers = [];
    const reqQueries = await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.href));
    const reqTexts =  await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.textContent.trim()));
    for(var i = initialOffset + 1; i < NO_TABLE_COLS; i++){
        const contentsSelectorAll = `.table-condensed > tbody > tr > td:nth-child(${NO_TABLE_COLS}n + ${i})`;
        const headersSelector = `.table-condensed > thead > tr > th:nth-child(${i})`;
        const data = await page.$$eval(contentsSelectorAll, els => els.map(el => el.textContent.trim()));
        const head = await page.$eval(headersSelector, el => el.childNodes[0].textContent.trim());
        Contents.push(data);
        Headers.push(head);
    }

    const services = Contents[Contents.length - 1];
    const properties = Contents[tablePropertyOffset];
    const splitDatesList = Contents[tableDateTimeOffset].map(el => splitDateTime(el));
    Contents = [splitDatesList.map(el => el[0]), splitDatesList.map(el => el[1]), ...Contents.slice(1)];
    Headers = ["Date", "Time", ...Headers.slice(1)];

    const hasGuestsFIlledOut = [];
    const hasPaidThePrices = [];
    const hasPaidDeposits = [];
    const urlGuestApps = [];
    const paymentDifferences = [];
    const areAllPassportsValids = [];
    const areTheApartmentClean = properties.map(el => cleanApts.some(apt => 
            el.toLowerCase().includes(apt.toLowerCase())));

    for(var i = 0; i < reqQueries.length; i++){
        const query = reqQueries[i];
        const temp_page = await browser.newPage();
        temp_page.on('console', message =>
            console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
        await temp_page.goto(query, pageGotoOptions);
        await temp_page.exposeFunction("nDaysFromGivenDate", nDaysFromGivenDate);
        await temp_page.exposeFunction("dateFromString", dateFromString);
        
        var noPersons = 0;
        for(const personsSelector of personsSelectors)
            noPersons += +(await temp_page.$eval(personsSelector, el => el.value));

        const departureDate = await temp_page.$eval(departureDateSelector, el => el.value);
        const url_guest_app = await temp_page.$eval(url_guest_appSelector, el => el.href);
        urlGuestApps.push(url_guest_app);

        const service = services[i];
        const hasVC = service === "expedia" || await temp_page.$eval(doesHaveVirtualCardTextareaDeterminatorSelector, 
                el => /crédito virtual/.test(el.textContent.trim()));
        const bookingTabAnchor = await temp_page.$(bookingTabAnchorSelector);
        await awaitClick(bookingTabAnchor, temp_page);
        /*
        const howLongStay = await temp_page.$eval(howManyNights, el => 
            +el.childNodes[4].textContent.trim());
        */
        if(service === "booking" || service === "holidu" || service === "directas" || service === "expedia")
        {
            const toPayAmout = await temp_page.$eval(toPayAmountSelector, el => 
                +el.textContent.trim().slice(0, -2));
            const difference = await temp_page.$eval(outstandingPaymentSelector, el => 
                +el.textContent.trim().slice(0,-2));
            const hasMadeDepositTransaction = await temp_page.$$eval(hasPaidTheDepositCandidateSelector, 
                 async (els, departureDate) => {
                const lastEl = els[els.length - 1];
                const lastElNodes = lastEl.childNodes;
                if(lastElNodes.length === 1)
                {
                    const lastElParent = lastEl.parentNode;
                    const lastElParentFirstTd = lastElParent.childNodes[1];
                    const paymentDateAsString = lastElParentFirstTd.textContent.trim();
                    const paymentDateTrimmed = paymentDateAsString.slice(-10);
                    const paymentDatePlusSevenDays = await nDaysFromGivenDate(paymentDateTrimmed, 7);
                    const departureDateAsDate = await dateFromString(departureDate);
                    return paymentDatePlusSevenDays > departureDateAsDate;
                }
                return false;
            }, departureDate);
            
            const hasDepositExtra = await temp_page.$$eval(depositHasBenDeclaredDeterminantSelectorAll, els => {
                var ret = false;
                for(var i = 0; i < els.length; i++){
                    const elsChildrenNodes = els[i].childNodes;
                    const elsTitleNode = elsChildrenNodes[1].textContent.trim();
                    const elsTitleNodeLC = elsTitleNode.toLowerCase();
                    if(elsTitleNodeLC === "deposit" || 
                       elsTitleNodeLC === "depósito" || 
                       elsTitleNodeLC === "fianza" ||
                       elsTitleNodeLC === "deposito")
                        ret = true;
                }
                return ret;
            });
            if(hasVC)
            {
                const hasPaidDeposit = 
                    ( hasDepositExtra && Math.abs(toPayAmout - difference) < INDIFFERENCE_AMOUNT) ||
                    (!hasDepositExtra && Math.abs(toPayAmout - difference - DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT) ||
                    ( hasDepositExtra && Math.abs(difference) < INDIFFERENCE_AMOUNT) ||
                    (!hasDepositExtra && Math.abs(difference + DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT) ||
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
            throw `Unknown service ${service}`

        const guestsTabAnchor = await temp_page.$(guestsTabAnchorSelector);
        await awaitClick(guestsTabAnchor, temp_page);
        const guestTrs = await temp_page.$$(guestTableRowSelectorAll);
        hasGuestsFIlledOut.push(!!guestTrs.length && guestTrs.length === noPersons);
        const passportNumbers = await temp_page.$$eval(tablePassportNumberSelector, els => 
            els.map(el => el.textContent.trim()));
        const areAllPassportNumbersValid = !!passportNumbers.length && passportNumbers.every(isPassportValid);
        areAllPassportsValids.push(areAllPassportNumbersValid);

        temp_page.close();
    }

    page.close();
    Headers = ["Booking", ...Headers, "Has Paid", "Has Paid Deposit", "Has Filled Out Guests", 
        "Are All Passports Valid", "Is Apartment Clean"];
    Contents = [reqTexts, ...Contents, hasPaidThePrices, hasPaidDeposits, hasGuestsFIlledOut, 
        areAllPassportsValids, areTheApartmentClean];
    return {Headers, Contents};
}

const isPassportValid = str => {
    //https://towardsdatascience.com/exploratory-data-analysis-passport-numbers-in-pandas-4ccb567115b6
    if(str.length < 3 || str.length > 17)
        return false;
    var charAcc = 0;
    for(var i = 0; i < str.length; i++){
        const isNum = !Number.isNaN(+str[i]);
        if(!isNum)
            charAcc++;
    }
    return charAcc !== str.length;
}

const apartmentCleaningTrSelectorAll = ".table-condensed > tbody > tr:not(.bg-light)";
const cleanClassName = "text-success";
const cleanApartamentNames = async browser => {
    const cleaningsUri = "https://gero.icnea.net/HosOrdNetejes.aspx";
    const cleaning_page = await browser.newPage();
    await cleaning_page.goto(cleaningsUri, pageGotoOptions);
    const apartmentObjects = await cleaning_page.$$eval(apartmentCleaningTrSelectorAll, 
        (els, cleanClassName) => {
            return els.map(el => {
                const secondNode = el.childNodes[1]; 
                const leafNode = secondNode.childNodes[1];
                const textNode = el.childNodes[5].childNodes[1];
                const textNodeContent = textNode.textContent.trim();
                if(leafNode === undefined){
                    return {
                        aptName: textNodeContent.slice(1, -1),
                        isClean: textNode.classList.contains(cleanClassName)
                    }
                }
                else {
                    const leafSpan = leafNode.childNodes[0];
                    if(leafSpan !== undefined)
                        return {
                            aptName: textNodeContent,
                            isClean: leafSpan.classList.contains(cleanClassName)
                        }
                    else
                        return {
                            aptName: textNodeContent,
                            isClean: leafNode.classList.contains(cleanClassName)
                            
                        }
                }

            });
    }, cleanClassName);
    cleaning_page.close();
    return apartmentObjects.filter(el => el.isClean).map(el => el.aptName);
};

exports.scrape = scrape;