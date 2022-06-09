"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PccBaseCrawler = void 0;
const puppeteer = require("puppeteer");
class PccBaseCrawler {
    constructor(username, password) {
        this.regularTimeout = 60 * 1000;
        this.pageLoadTimeout = 60 * 1000;
        this.fileIndex = 0;
        this.logs = [];
        this.name = 'general';
        this.loginUrl = 'https://login.pointclickcare.com/home/userLogin.xhtml';
        this.username = username;
        this.password = password;
    }
    addLog(...logs) {
        const preparedLog = `${this.name}:${logs.map((log) => JSON.stringify(log, null, 4)).join(':-:')}`;
        this.logs.push(preparedLog);
        console.log(preparedLog);
    }
    enter() {
        return __awaiter(this, void 0, void 0, function* () {
            const path = process.env.NODE_ENV === 'stage' ? '/usr/bin/chromium-browser' : undefined;
            console.log('chrome path', path);
            this.browser = yield puppeteer.launch({
                args: [
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--disable-setuid-sandbox',
                    '--no-first-run',
                    '--no-sandbox',
                    '--no-zygote',
                ],
                headless: true,
                timeout: this.regularTimeout,
                executablePath: path
            });
            this.browser.on('disconnected', () => {
                console.log('disconnected');
            });
            this.page = yield this.browser.newPage();
            yield this.page.setViewport({
                height: 800,
                width: 1280,
            });
            yield this.page.goto(this.loginUrl, { waitUntil: 'networkidle0', timeout: this.pageLoadTimeout });
            this.page.on('dialog', (dialog) => {
                this.addLog('dialog', dialog.message());
                dialog.accept();
            });
            yield this.page.waitForSelector('#login-button');
            yield this.page.type('#username', this.username.trim());
            yield this.page.type('#password', this.password.trim());
            yield this.page.click('#login-button');
            //await this.page.screenshot('example.png');
            console.log('enter');
            yield this.page.waitForSelector('#pccFacLink', { timeout: 20000 });
            yield this.closeModal();
        });
    }
    waitForFn(fn, tries = 200) {
        return __awaiter(this, void 0, void 0, function* () {
            const condition = yield fn();
            if (!condition && tries > 0) {
                yield this.sleep(100);
                yield this.waitForFn(fn, tries - 1);
            }
            if (tries === 0) {
                throw new Error('can wait any more');
            }
        });
    }
    switchToFacility(facilityId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('switch Facility', facilityId);
            yield this.closeModal();
            yield this.page.waitForSelector('#pccFacLink', { timeout: this.pageLoadTimeout });
            const defaultCurFacId = yield (yield this.page.$('input[name="current_fac_id"]')).evaluate((e) => e.value);
            console.log('cur Fac id', defaultCurFacId);
            if (defaultCurFacId === facilityId) {
                return;
            }
            const interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                yield this.closeModal();
                const currentSelectedField = yield this.page.$('#pccFacLink');
                const facilityButton = yield this.page.$(`#pccFacMenu a[href="javascript:switchToFacilityView(${facilityId})"]`);
                if (!facilityButton) {
                    yield currentSelectedField.click();
                }
                else {
                    clearInterval(interval);
                }
            }), 2000);
            const currentSelectedField = yield this.page.$('#pccFacLink');
            currentSelectedField.click();
            try {
                yield this.page.waitForSelector(`#pccFacMenu a[href="javascript:switchToFacilityView(${facilityId})"]`, { timeout: this.pageLoadTimeout });
            }
            catch (e) {
                // current facility selected
                clearInterval(interval);
                return;
            }
            clearInterval(interval);
            yield this.page.evaluate(`(async () => {
            switchToFacilityView(${facilityId});
        })()`);
            try {
                yield this.page.waitForNavigation({ timeout: this.pageLoadTimeout });
            }
            catch (e) {
                console.log('Navigation timeout error');
            }
            const curFacId = yield (yield this.page.$('input[name="current_fac_id"]')).evaluate((e) => e.value);
            console.log('cur Fac id', curFacId);
            if (curFacId !== facilityId) {
                throw new Error('can not select facility');
            }
        });
    }
    goBiilingPage() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.page.waitForSelector('#QTF_AdminTab');
            this.addLog('admin tab apprear');
            yield this.page.hover('#QTF_AdminTab');
            yield this.sleep(1000);
            const adminTab = yield this.page.$('#QTF_AdminTab');
            this.addLog(`admin tab founded ${!!adminTab}`);
            const billingBtn = yield adminTab.$x(`//ul[contains(@class,"mmList")]//a[contains(text(),'Billing')]`);
            this.addLog('billingBtn ' + billingBtn.length);
            if (billingBtn.length > 1) {
                yield billingBtn[1].click();
            }
            else {
                yield billingBtn[0].click();
            }
            this.addLog('waiting for navigation');
            yield this.page.waitForNavigation({ waitUntil: 'networkidle2' });
            this.addLog('go to billing ok');
        });
    }
    gotoReportPage(reportName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.page.waitForSelector('#QTF_reportingTab');
            const reportButton = yield this.page.$('#QTF_reportingTab');
            yield reportButton.click();
            console.log('after button click');
            yield this.page.waitForNavigation({ timeout: this.pageLoadTimeout, waitUntil: 'networkidle0' });
            console.log('after navigation click');
            yield this.page.waitForFunction((reportName) => {
                const listOfItems = document.querySelectorAll('.reportList-row');
                for (let i = 0; i < listOfItems.length; i++) {
                    const title = listOfItems[i].getAttribute('data-report-title');
                    if ((Array.isArray(reportName) && reportName.includes(title)) || reportName === title) {
                        return true;
                    }
                }
                return false;
            }, { timeout: this.pageLoadTimeout }, reportName);
            console.log('after function');
            const foundReportName = yield this.page.evaluate((reportName) => {
                const listOfItems = document.querySelectorAll('.reportList-row');
                for (let i = 0; i < listOfItems.length; i++) {
                    const title = listOfItems[i].getAttribute('data-report-title');
                    if ((Array.isArray(reportName) && reportName.includes(title)) || reportName === title) {
                        return title;
                    }
                }
            }, reportName);
            const reportRow = yield this.page.$(`.reportList-row[data-report-title="${foundReportName}"]`, { timeout: this.regularTimeout });
            if (!reportRow) {
                throw new Error(`Can't find exact report row`);
            }
            yield reportRow.click();
            console.log('after row click');
            yield this.page.waitForSelector(`button._openSetupPage[data-report="${foundReportName}"]`, { timeout: this.regularTimeout });
            const runReportButton = yield this.page.$(`button._openSetupPage[data-report="${foundReportName}"]`);
            yield runReportButton.click();
            console.log('after click');
            // await this.page.waitForNavigation({ timeout: this.pageLoadTimeout, waitUntil: 'networkidle0' });
        });
    }
    closeModal() {
        return __awaiter(this, void 0, void 0, function* () {
            const modalCloseButton = yield this.page.$('.bb-button._pendo-button-custom._pendo-button[data-_pendo-button-custom-2]');
            const modalCloseButton2 = yield this.page.$('.bb-button._pendo-button[data-_pendo-button-2]');
            const modalCloseButton3 = yield this.page.$('.bb-button._pendo-button[data-_pendo-button-3]');
            if (modalCloseButton || modalCloseButton2 || modalCloseButton3) {
                console.log('modal CLose Button exists');
                if (modalCloseButton3) {
                    yield modalCloseButton3.click();
                }
                else {
                    if (modalCloseButton) {
                        yield modalCloseButton.click();
                    }
                    if (modalCloseButton2) {
                        yield modalCloseButton2.click();
                    }
                }
                yield this.page.waitForSelector('#pccFacLink', { timeout: this.regularTimeout });
            }
        });
    }
    waitUntilPageClosed(page) {
        return __awaiter(this, void 0, void 0, function* () {
            if (page.isClosed()) {
                return;
            }
            yield this.sleep(100);
            return yield this.waitUntilPageClosed(page);
        });
    }
    sleep(time) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => setTimeout(resolve, time));
        });
    }
    getNewPageWhenLoaded() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(rResolve => {
                const resolve = (data) => {
                    setTimeout(() => {
                        rResolve(data);
                    }, 2000);
                };
                this.browser.once('targetcreated', (target) => __awaiter(this, void 0, void 0, function* () {
                    console.log('target created', target.type());
                    if (target.type() === 'page') {
                        const newPage = yield target.page();
                        newPage.on('dialog', (dialog) => {
                            this.addLog('dialog', dialog.message());
                            dialog.accept();
                        });
                        const isPageLoaded = yield newPage.evaluate(() => document.readyState);
                        const newPagePromise = new Promise((lresolve) => {
                            const timeout = setTimeout(() => {
                                if (isPageLoaded.match('complete|interactive')) {
                                    lresolve(newPage);
                                }
                            }, 15 * 1000);
                            newPage.once('domcontentloaded', () => {
                                lresolve(newPage);
                                clearTimeout(timeout);
                            });
                        });
                        return isPageLoaded.match('complete|interactive')
                            ? resolve(newPage)
                            : resolve(newPagePromise);
                    }
                }));
            });
        });
    }
    downloadTransactionReport() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.page.click('#runButton');
            const newPage = yield this.getNewPageWhenLoaded();
            const pageUrl = newPage.url();
            const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
            const host = origin.substr(8);
            const fileIndex = this.fileIndex;
            newPage.evaluate(`(async () => {
            console.log(window.location)
            const search = window.location.search;
            async function waitUntilReportReady () {
                console.log('${origin}/admin/billing/reportProgressMonitor/poll.xhtml' + search)
                const response = await fetch('${origin}/admin/billing/reportProgressMonitor/poll.xhtml' + search, { 
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }).then(res => res.json())
                console.log(response)
                if (response.status != 'Completed') {
                    await waitUntilReportReady()
                }
            }
            await waitUntilReportReady();
            console.log('${origin}/admin/billing/reportProgressMonitor/downloadFile.xhtml' + search)
	    	return await fetch('${origin}/admin/billing/reportProgressMonitor/downloadFile.xhtml' + search, {
                credentials: "include"
            }).then(res => {
                return res.body;
            }).then(stream => {
                const reader = stream.getReader();
                let charsReceived = 0;
                let result = [];
                return reader.read().then(function processText({ done, value }) {
                    if (done) {
                        return new Promise((resolve) => {
                            const blob = new Blob(result, {type: 'text/plain'});
                            let reader = new FileReader();
                            reader.readAsBinaryString(blob);
                            reader.onload = function() {
                                const el = document.createElement('span')
                                el.id = 'alldatadownloaded${fileIndex}';
                                el.innerText = reader.result;
                                setTimeout(function () {
                                    document.body.append(el)
                                }, 5000)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err))
        })()`);
            yield newPage.waitForFunction((fileIndex) => {
                const el = document.getElementById(`alldatadownloaded${fileIndex}`);
                return !!el;
            }, { timeout: 7 * 60 * 1000 }, fileIndex);
            console.log('file index', fileIndex);
            const csv = yield newPage.evaluate((fileIndex) => {
                const el = document.getElementById(`alldatadownloaded${fileIndex}`);
                if (el) {
                    return el.innerText;
                }
            }, fileIndex);
            this.fileIndex++;
            return Buffer.from('Facility' + csv.substr(csv.indexOf(',')), 'utf8');
        });
    }
    fetchReportBuffer(report, generateReportArgs = ['form']) {
        return __awaiter(this, void 0, void 0, function* () {
            const pageUrl = this.page.url();
            const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
            const host = origin.substr(8);
            const fileIndex = this.fileIndex;
            this.page.evaluate(`(async () => {
            console.log('data', document.frmData);
            const form = document.frmData;
            form.submit = function () { return false; }
            form.onsubmit = function (event) { event.preventDefault(); event.stopPropagation(); return false; }
            generateReport.call(window, ${generateReportArgs.join(',')});
	    	return await fetch('${origin}${report}', {
                method: "POST",
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    Connection: 'Keep-Alive',
                    Host: '${host}',
                    Origin: '${origin}',
                    'Accept-Language': 'en-US',
                    'Upgrade-Insecure-Requests': 1,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
                },
                credentials: "include",
                body: new FormData(form)
            }).then(res => {
                return res.body;
            }).then(stream => {
                const reader = stream.getReader();
                let charsReceived = 0;
                let result = [];
                return reader.read().then(function processText({ done, value }) {
                    if (done) {
                        return new Promise((resolve) => {
                            const blob = new Blob(result, {type: 'text/plain'});
                            let reader = new FileReader();
                            reader.readAsBinaryString(blob);
                            reader.onload = function() {
                                const el = document.createElement('span')
                                el.id = 'alldatadownloaded${fileIndex}';
                                el.innerText = reader.result;
                                setTimeout(function () {
                                    document.body.append(el)
                                }, 5000)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err));
        })()`);
            yield this.page.waitForFunction((fileIndex) => {
                const el = document.getElementById(`alldatadownloaded${fileIndex}`);
                return !!el;
            }, { timeout: 1 * 60 * 1000 }, fileIndex);
            const csv = yield this.page.evaluate((fileIndex) => {
                const el = document.getElementById(`alldatadownloaded${fileIndex}`);
                if (el) {
                    return el.innerText;
                }
            }, fileIndex);
            this.fileIndex++;
            return Buffer.from('Facility' + csv.substr(csv.indexOf(',')), 'utf8');
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.browser.close();
        });
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.enter();
        });
    }
    repeatedlyStart(count = 3) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.start();
                    resolve(result);
                }
                catch (e) {
                    console.log('error', e);
                    console.log('repeat', count);
                    if (count > 1) {
                        this.repeatedlyStart(count - 1).then(resolve, reject);
                    }
                    else {
                        reject(e);
                        throw e;
                    }
                }
            }));
        });
    }
}
exports.PccBaseCrawler = PccBaseCrawler;
//# sourceMappingURL=PccBaseCrawler.js.map