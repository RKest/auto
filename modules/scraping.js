const puppeteer = require("puppeteer");
const util = require("util");
const sleep = util.promisify(setTimeout);
const LOCATION = "https://gero.icnea.net";
const LOGIN_LOCATION = LOCATION + "/Servidor.aspx";
const DEF_LOCATION = LOCATION + "/HosOrdEntrades.aspx"

const INDIFFERENCE_AMOUNT = 10.0;
const DEPOSIT_AMOUNT = 150.0;
const NO_TABLE_COLS = 14;
const pageGotoOptions = { waitUntil: "networkidle2" };

const initialOffset = 5;
const tableDateTimeOffset = 0;
const tablePropertyOffset = 1;

//Login Page Selectors
const emailInpSelector = "input#Email";
const passwordInpSelector = "input#Contrasenya"
const loginInpSelector = "input#Login";

//Arivals Page Selectors
const tableReqQuerySelectorAll = ".table-condensed > tbody > tr > td:nth-child(14n + 5) > a";

//Cleaning Page Selectors

//Tab Selectors
const bookingTabAnchorSelector = "a#Menus_M1";
const guestsTabAnchorSelector = "a#Menus_M2";

//Customer Tab Selectors
const url_guest_appSelector = "a#App"; //UNUSED
const departureDateSelector = "input#sortida";

//Guest Tab Selectors
const guestTableRowSelectorAll = ".table-condensed > tbody > tr";
const tablePassportNumberSelector = ".table-condensed > tbody > tr > td:nth-child(7)";

const splitDateTime = dateStringArray => {
    const ret = [[], []];
    for(const dateString of dateStringArray){
        const datePart = dateString.slice(0, 10).trim();
        const timePart = dateString.slice(11).trim();
        ret[0].push(datePart);
        ret[1].push(timePart);
    }
    return ret;
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

const dateToString = date => {
    return   date.toLocaleDateString("en-US", { day: 'numeric' })
     + "/" + date.toLocaleDateString("en-US", { month: 'numeric' })  
     + "/" + date.toLocaleDateString("en-US", { year: 'numeric' });
}

//StringFormat is dd/mm/yyyy
const nDaysFromGivenDate = (dateString, num) => {
    const date = dateFromString(dateString);
    date.setDate(date.getDate() + num);
    return date;
}

const noPersonsFunc = async page => {
    const personsSels = ["input#personesG", "input#personesM", "input#personesP"];
    var noPersons = 0;
    for(const personsSel of personsSels)
        noPersons += +(await page.$eval(personsSel, el => el.value));
    return noPersons;
}

const hasVCFunc = async (page, service) => {
    const doesHaveVCTextareaSel = "textarea#obs_canal";
    return service === "expedia" || await page.$eval(doesHaveVCTextareaSel,  
        el => /crédito virtual/.test(el.textContent.trim()));
}

const toPayAmountFunc = async page => {
    const toPayNumSel = ".warning > td > strong";
    return page.$eval(toPayNumSel, el => +el.textContent.trim().slice(0, -2));
}

const outstandingPaymentFunc = async page => {
    const outstandingPaymentSel = "td > strong.text-danger";
    return page.$eval(outstandingPaymentSel, el => +el.textContent.trim().slice(0,-2));
}

const hasDepositExtraFunc = async page => {
    const depositBeenDeclaredSelAll = ".table-condensed > tbody > tr";
    return page.$$eval(depositBeenDeclaredSelAll, els => {
        const depositNames = ["deposit", "depósito", "deposito", "fianza"];
        var ret = false;
        for(var i = 0; i < els.length; i++){
            const elsChildrenNodes = els[i].childNodes;
            const elsTitleNode = elsChildrenNodes[1].textContent.trim();
            const elsTitleNodeLC = elsTitleNode.toLowerCase();
            ret |= depositNames.includes(elsTitleNodeLC);
        }
        return ret;
    });
}

const hasPaidDepositFunc = (hasVC, toPayAmout, outstandingPayment, hasMadeDepositTransaction, hasDepositExtra) => {
    const hasPaidWithoutVC = 
        ( hasDepositExtra && Math.abs(outstandingPayment) < INDIFFERENCE_AMOUNT) ||
        (!hasDepositExtra && Math.abs(outstandingPayment + DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT);
    const hasPaidWithVC = 
        ( hasDepositExtra && Math.abs(toPayAmout - outstandingPayment) < INDIFFERENCE_AMOUNT) ||
        (!hasDepositExtra && Math.abs(toPayAmout - outstandingPayment - DEPOSIT_AMOUNT) < INDIFFERENCE_AMOUNT);

    return hasPaidWithoutVC || hasMadeDepositTransaction || (hasVC && hasPaidWithVC);
};

const hasDepositTransactionFunc = async (page, departureDate) => {
    const hasPaidDepositSel = "td.text-right:not(.text-danger):not(.form-inline):not([colspan='2'])";
    return page.$$eval(hasPaidDepositSel, async (els, departureDate) => {
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
}

const scrape = async (email, passwd, date, progressObj) => {
    //const browserURL = "http://127.0.0.1:9222";
    //const browser = await puppeteer.connect({browserURL});
    const browser = await puppeteer.launch({
        headless: false
    });
    try {
    const page = await browser.newPage();
    await page.goto(LOGIN_LOCATION, pageGotoOptions);

    if(!email || !passwd)
        throw "Provide email and password";
    await Promise.all([
        page.$eval(emailInpSelector,    (el, val) => el.value = val, email),
        page.$eval(passwordInpSelector, (el, val) => el.value = val, passwd)
    ]);

    const loginInp = await page.$(loginInpSelector);
    await awaitClick(loginInp, page);
    if(page.url() === LOGIN_LOCATION)
        throw "Incorrect email or password";
        
    const dateString = dateToString(new Date(date));
    const cleanApts = await cleanApartamentNames(browser);
    const exactLocation = DEF_LOCATION + "?data=" + dateString;
    await page.goto(exactLocation, pageGotoOptions);
    var Contents = [];
    var Headers = [];
    const reqQueries = await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.href));
    const reqTexts = await page.$$eval(tableReqQuerySelectorAll, els => els.map(el => el.textContent.trim()));
    for(var i = initialOffset + 1; i < NO_TABLE_COLS; i++){
        const contentsSelectorAll = `.table-condensed > tbody > tr > td:nth-child(${NO_TABLE_COLS}n + ${i})`;
        const headersSelector = `.table-condensed > thead > tr > th:nth-child(${i})`;
        const data = await page.$$eval(contentsSelectorAll, els => els.map(el => el.textContent.trim()));
        const head = await page.$eval(headersSelector, el => el.childNodes[0].textContent.trim());
        Contents.push(data);
        Headers.push(head);
    }

    progressObj.outof = Contents[0].length;

    const services = Contents[Contents.length - 1];
    const properties = Contents[tablePropertyOffset];
    const splitDatesList = splitDateTime(Contents[tableDateTimeOffset]);
    Contents = [...splitDatesList, ...Contents.slice(1)];
    Headers = ["Date", "Time", ...Headers.slice(1)];

    const hasGuestsFIlledOut = [];
    const hasPaidThePrices = [];
    const hasPaidDeposits = [];
    //const urlGuestApps = [];
    const paymentDifferences = [];
    const areAllPassportsValids = [];
    const areTheApartmentClean = properties.map(el => cleanApts.some(apt => 
            el.toLowerCase().includes(apt.toLowerCase())));

    for(; progressObj.i < reqQueries.length; progressObj.i++){
        const i = progressObj.i;
        const query = reqQueries[i];
        const temp_page = await browser.newPage();
        temp_page.on('console', message =>
            console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`));
        await temp_page.goto(query, pageGotoOptions);
        await temp_page.exposeFunction("nDaysFromGivenDate", nDaysFromGivenDate);
        await temp_page.exposeFunction("dateFromString", dateFromString);
        
        const noPersons = await noPersonsFunc(temp_page);

        const departureDate = await temp_page.$eval(departureDateSelector, el => el.value);
        //const url_guest_app = await temp_page.$eval(url_guest_appSelector, el => el.href);
        //urlGuestApps.push(url_guest_app);

        const service = services[i];
        const hasVC = await hasVCFunc(temp_page, service);
        const bookingTabAnchor = await temp_page.$(bookingTabAnchorSelector);
        await awaitClick(bookingTabAnchor, temp_page);
        const VCServices = ["booking", "holidu", "directas", "expedia"]; 
        if(VCServices.includes(service))
        {
            const toPayAmout                = await toPayAmountFunc(temp_page);
            const outstandingPayment        = await outstandingPaymentFunc(temp_page);
            const hasMadeDepositTransaction = await hasDepositTransactionFunc(temp_page, departureDate);
            const hasDepositExtra           = await hasDepositExtraFunc(temp_page);

            const hasPaidDeposit = hasPaidDepositFunc(hasVC, toPayAmout, outstandingPayment, 
                hasMadeDepositTransaction, hasDepositExtra);

            hasPaidDeposits.push(hasPaidDeposit);
            if(hasVC){
                hasPaidThePrices.push(true);
                paymentDifferences.push(0);
            } else {
                hasPaidThePrices.push(outstandingPayment < INDIFFERENCE_AMOUNT);
                paymentDifferences.push(outstandingPayment);
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

    } catch (e) {
        browser.close();
        throw e;
    }
    browser.close();
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

const cleanApartamentNames = async browser => {
    const apartmentCleaningTrSelAll = ".table-condensed > tbody > tr:not(.bg-light)";
    const cleanClassName = "text-success";
    const cleaningsUri = "https://gero.icnea.net/HosOrdNetejes.aspx";
    const cleaning_page = await browser.newPage();
    await cleaning_page.goto(cleaningsUri, pageGotoOptions);
    const apartmentObjects = await cleaning_page.$$eval(apartmentCleaningTrSelAll, (els, cleanClassName) => 
        els.map(el => {
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
        }), cleanClassName);
    cleaning_page.close();
    return apartmentObjects.filter(el => el.isClean).map(el => el.aptName);
};

exports.scrape = scrape;