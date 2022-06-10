import * as puppeteer from 'puppeteer';
import * as config from 'config';
const functionsConfig = config.get('functions');

export class PccBaseCrawler {
    username: string;
    password: string;
    page: any;
    browser: any;
    regularTimeout: number = 60 * 1000;
    pageLoadTimeout: number = 60 * 1000;
    fileIndex: number = 0;
    logs: string[] = [];
    name: string = 'general';
    loginUrl: string = 'https://login.pointclickcare.com/home/userLogin.xhtml';
    constructor (username: string, password: string) {
        this.username = username;
        this.password = password;
    }
    addLog (...logs: any[]) {
        const preparedLog = `${this.name}:${logs.map((log) => JSON.stringify(log, null, 4)).join(':-:')}`;
        this.logs.push(preparedLog);
        console.log(preparedLog);
    }
    async enter() {
        this.browser = await puppeteer.launch({
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--use-gl=egl'
            ],
            headless: true,
            timeout:  this.regularTimeout,
            ignoreDefaultArgs: ['--disable-extensions'],
            executablePath: functionsConfig.cromium
        });
        this.browser.on('disconnected', () => {
            console.log('disconnected');
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            height: 800,
            width: 1280,
        });

        await this.page.goto(
            this.loginUrl,
            { waitUntil: 'networkidle0', timeout: this.pageLoadTimeout },
        );
        this.page.on('dialog', (dialog) => {
            this.addLog('dialog', dialog.message());
            dialog.accept();
        });
        await this.page.waitForSelector('#login-button');
        await this.page.type('#username', this.username.trim());
        await this.page.type('#password', this.password.trim());
        await this.page.click('#login-button');
        //await this.page.screenshot('example.png');
        console.log('enter');
        
        await this.page.waitForSelector('#pccFacLink', { timeout: 20000 });
        await this.closeModal();
    }

    async waitForFn(fn, tries = 200) {
        const condition = await fn();
        if (!condition && tries > 0) {
            await this.sleep(100);
            await this.waitForFn(fn, tries - 1);
        }
        if (tries === 0) {
            throw new Error('can wait any more');
        }
    }

    async switchToFacility(facilityId: string) {

        console.log('switch Facility', facilityId);
        await this.closeModal();
        await this.page.waitForSelector('#pccFacLink', { timeout: this.pageLoadTimeout });
        const defaultCurFacId = await (await this.page.$('input[name="current_fac_id"]')).evaluate((e) => e.value);
        console.log('cur Fac id', defaultCurFacId);
        if (defaultCurFacId === facilityId) { 
            return;
        }
        const interval = setInterval(async () => {
            await this.closeModal();
            const currentSelectedField = await this.page.$('#pccFacLink');
            const facilityButton = await this.page.$(`#pccFacMenu a[href="javascript:switchToFacilityView(${facilityId})"]`);
            if (!facilityButton) {
                await currentSelectedField.click();
            } else {
                clearInterval(interval);
            }
        }, 2000);
        const currentSelectedField = await this.page.$('#pccFacLink');
        currentSelectedField.click();
        try {
           await this.page.waitForSelector(`#pccFacMenu a[href="javascript:switchToFacilityView(${facilityId})"]`, { timeout: this.pageLoadTimeout });
        } catch (e) {
            // current facility selected
            clearInterval(interval);
            return;
        }
        clearInterval(interval);
        await this.page.evaluate(`(async () => {
            switchToFacilityView(${facilityId});
        })()`);
        try {
            await this.page.waitForNavigation({ timeout: this.pageLoadTimeout });
        } catch (e) {
            console.log('Navigation timeout error')
        }
        const curFacId = await (await this.page.$('input[name="current_fac_id"]')).evaluate((e) => e.value);
        console.log('cur Fac id', curFacId);
        if (curFacId !== facilityId) {
            throw new Error('can not select facility');
        }
    }
    protected async goBiilingPage () {
        await this.page.waitForSelector('#QTF_AdminTab');
        this.addLog('admin tab apprear');
        await this.page.hover('#QTF_AdminTab');
        await this.sleep(1000);
        const adminTab = await this.page.$('#QTF_AdminTab')
        this.addLog(`admin tab founded ${!!adminTab}`);
        const billingBtn = await adminTab.$x(`//ul[contains(@class,"mmList")]//a[contains(text(),'Billing')]`);
        this.addLog('billingBtn ' + billingBtn.length)
        if (billingBtn.length > 1) {
          await billingBtn[1].click();
        } else {
          await billingBtn[0].click();
        }
        this.addLog('waiting for navigation');
        await this.page.waitForNavigation({waitUntil: 'networkidle2'});
        this.addLog('go to billing ok');
    }
    protected async gotoReportPage(reportName: string | string[]) {
        await this.page.waitForSelector('#QTF_reportingTab');
        const reportButton = await this.page.$('#QTF_reportingTab');
        await reportButton.click();
        console.log('after button click')
        await this.page.waitForNavigation({ timeout: this.pageLoadTimeout, waitUntil: 'networkidle0' });
        console.log('after navigation click')
        await this.page.waitForFunction((reportName) => {
            const listOfItems = document.querySelectorAll('.reportList-row');
            for (let i = 0; i < listOfItems.length; i++) {
                const title = listOfItems[i].getAttribute('data-report-title');
                if ((Array.isArray(reportName) && reportName.includes(title)) || reportName === title) {
                    return true;
                }
            }
            return false;
        }, { timeout: this.pageLoadTimeout }, reportName);
        console.log('after function')
        const foundReportName = await this.page.evaluate((reportName) => {
            const listOfItems = document.querySelectorAll('.reportList-row');
            for (let i = 0; i < listOfItems.length; i++) {
                const title = listOfItems[i].getAttribute('data-report-title');
                if ((Array.isArray(reportName) && reportName.includes(title)) || reportName === title) {
                    return title;
                }
            }
        }, reportName);
        const reportRow = await this.page.$(`.reportList-row[data-report-title="${foundReportName}"]`, { timeout: this.regularTimeout });
        if (!reportRow) {
            throw new Error(`Can't find exact report row`)
        }
        await reportRow.click();
        console.log('after row click');
        await this.page.waitForSelector(`button._openSetupPage[data-report="${foundReportName}"]`, { timeout: this.regularTimeout });
        const runReportButton = await this.page.$(`button._openSetupPage[data-report="${foundReportName}"]`);
        await runReportButton.click();
        console.log('after click');
        // await this.page.waitForNavigation({ timeout: this.pageLoadTimeout, waitUntil: 'networkidle0' });
    }
    async closeModal() {
        const modalCloseButton = await this.page.$('.bb-button._pendo-button-custom._pendo-button[data-_pendo-button-custom-2]');
        const modalCloseButton2 = await this.page.$('.bb-button._pendo-button[data-_pendo-button-2]')
        const modalCloseButton3 = await this.page.$('.bb-button._pendo-button[data-_pendo-button-3]')
        if (modalCloseButton || modalCloseButton2 || modalCloseButton3) {
            console.log('modal CLose Button exists');
            if (modalCloseButton3) {
                await modalCloseButton3.click();
            } else {
                if (modalCloseButton) {
                    await modalCloseButton.click();
                }
                if (modalCloseButton2) {
                    await modalCloseButton2.click();
                }    
            }
            await this.page.waitForSelector('#pccFacLink', { timeout: this.regularTimeout });
        }
    }
    protected async waitUntilPageClosed(page) {
        if (page.isClosed()) {
            return;
        }
        await this.sleep(100);
        return await this.waitUntilPageClosed(page);
    }
    protected async sleep (time) {
        return new Promise((resolve) => setTimeout(resolve, time));
    }
    protected async getNewPageWhenLoaded(): Promise<any> {
        return new Promise(rResolve =>{
            const resolve = (data) => {
                setTimeout(() => {
                    rResolve(data);
                }, 2000);
            }
            this.browser.once('targetcreated', async target => {
                console.log('target created', target.type());
                if (target.type() === 'page') {
                    const newPage = await target.page();
                    newPage.on('dialog', (dialog) => {
                        this.addLog('dialog', dialog.message());
                        dialog.accept();
                    });
                      
                    const isPageLoaded = await newPage.evaluate(
                        () => document.readyState
                    );
                    const newPagePromise = new Promise((lresolve) => {
                        const timeout = setTimeout(() => {
                            if (isPageLoaded.match('complete|interactive')) {
                                lresolve(newPage)
                            }
                        }, 15 * 1000)
                        newPage.once('domcontentloaded', () => {
                            lresolve(newPage);
                            clearTimeout(timeout)
                        });
                    });
                    return isPageLoaded.match('complete|interactive')
                        ? resolve(newPage)
                        : resolve(newPagePromise);
                }
            });
        });
    }

    protected async downloadTransactionReport() {
        await this.page.click('#runButton');
        const newPage = await this.getNewPageWhenLoaded();
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
        await newPage.waitForFunction((fileIndex) => {
            const el = document.getElementById(`alldatadownloaded${fileIndex}`)
            return !!el
        }, { timeout: 7 * 60 * 1000 }, fileIndex)
        console.log('file index', fileIndex);
        const csv = await newPage.evaluate((fileIndex) => {
            const el = document.getElementById(`alldatadownloaded${fileIndex}`)
            if (el) {
                return el.innerText
            }
        }, fileIndex)
        this.fileIndex++;
        return Buffer.from('Facility' + csv.substr(csv.indexOf(',')), 'utf8');
    }
    protected async fetchReportBuffer(report: string, generateReportArgs: string[] = ['form']): Promise<Buffer> {
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
        await this.page.waitForFunction((fileIndex) => {
            const el = document.getElementById(`alldatadownloaded${fileIndex}`)
            return !!el
        }, { timeout: 1 * 60 * 1000 }, fileIndex)
        const csv = await this.page.evaluate((fileIndex) => {
            const el = document.getElementById(`alldatadownloaded${fileIndex}`)
            if (el) {
                return el.innerText
            }
        }, fileIndex)
        this.fileIndex++;
        return Buffer.from('Facility' + csv.substr(csv.indexOf(',')), 'utf8');
    }
    async close () {
        await this.browser.close();
    }
    async start (): Promise<any> {
        return await this.enter();
    }
    async repeatedlyStart (count: number = 3): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.start();
                resolve(result);
            } catch (e) {
                console.log('error', e);
                console.log('repeat', count);
                if (count > 1) {
                    this.repeatedlyStart(count - 1).then(resolve, reject);
                } else {
                    reject(e);
                    throw e;
                }
            }
        })
    }
}
