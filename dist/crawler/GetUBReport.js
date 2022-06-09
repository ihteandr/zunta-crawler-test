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
exports.GetUBReport = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetUBReport extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityOriginId, rowNum, reportCallback) {
        super(username, password);
        this.rowNum = rowNum;
        this.facilityOriginId = facilityOriginId;
        this.reportCallback = reportCallback;
        this.name = 'FetchUBReport';
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            yield this.switchToFacility(this.facilityOriginId);
            yield this.goBiilingPage();
            const ubTd = yield this.page.$x(`//td[contains(text(), 'UB Claims:')]`);
            console.log('ubtd', !!ubTd[0]);
            const ubRow = yield ubTd[0].$x('..');
            console.log('ubrow', !!ubRow[0]);
            const ubLink = (yield ubRow[0].$x(`//a[contains(text(), 'Edit / Submit')]`))[0];
            yield ubLink.click();
            this.addLog('go to ub report');
            yield this.page.waitForNavigation();
            this.addLog('on ub report page');
            this.addLog('selecting all');
            this.page.select('select[name=ESOLstatus]', "");
            yield this.page.waitForNavigation({ timeout: this.pageLoadTimeout });
            this.addLog('selected all');
            let missingReportCount = 0;
            while (true) {
                yield this.goCorrectPage();
                const td = yield this.page.evaluate((rowNum) => {
                    const tds = [...document.querySelectorAll('td')];
                    return tds.find(td => {
                        var _a;
                        return ((_a = td.textContent) === null || _a === void 0 ? void 0 : _a.trim()) == rowNum.toString();
                    });
                }, this.rowNum);
                if (!td) {
                    missingReportCount++;
                    this.addLog('row not found', this.rowNum, 'missing reports', missingReportCount);
                    if (missingReportCount >= 50) {
                        break;
                    }
                    else {
                        this.rowNum++;
                        continue;
                    }
                }
                const report837SpanClicked = yield this.page.evaluate((rowNum) => {
                    const tds = [...document.querySelectorAll('td')];
                    const td = tds.find(td => {
                        var _a;
                        return ((_a = td.textContent) === null || _a === void 0 ? void 0 : _a.trim()) == rowNum.toString();
                    });
                    const els = [...td.parentNode.querySelectorAll('span')];
                    const el = els.find(el => {
                        var _a;
                        return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) == '837';
                    });
                    if (!el) {
                        return false;
                    }
                    el.style.color = 'green';
                    el.click();
                    return true;
                }, this.rowNum);
                if (report837SpanClicked) {
                    const modal = yield this.getNewPageWhenLoaded();
                    const buffer = yield this.downloadReport(modal);
                    this.reportCallback({
                        rowNum: this.rowNum,
                        buffer
                    });
                    missingReportCount = 0;
                }
                else {
                    const reportExportSpanClicked = yield this.page.evaluate((rowNum) => {
                        const tds = [...document.querySelectorAll('td')];
                        const td = tds.find(td => {
                            var _a;
                            return ((_a = td.textContent) === null || _a === void 0 ? void 0 : _a.trim()) == rowNum.toString();
                        });
                        const els = [...td.parentNode.querySelectorAll('a')];
                        const el = els.find(el => {
                            var _a;
                            return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) == 'export';
                        });
                        if (!el) {
                            return false;
                        }
                        el.style.color = 'green';
                        el.click();
                        return true;
                    }, this.rowNum);
                    if (reportExportSpanClicked) {
                        const modal = yield this.getNewPageWhenLoaded();
                        const buffer = yield this.downloadReportFromExport(modal);
                        this.reportCallback({
                            rowNum: this.rowNum,
                            buffer
                        });
                        missingReportCount = 0;
                    }
                    else {
                        this.addLog('it is not a 837 report');
                    }
                }
                this.addLog('rowNum', this.rowNum);
                this.rowNum++;
            }
            yield this.browser.close();
        });
    }
    goCorrectPage() {
        return __awaiter(this, void 0, void 0, function* () {
            const firstRowNum = parseInt(yield (yield this.page.$('form[name=frmData]>div:last-child>div>table tbody tr:last-child td:nth-child(2)')).evaluate(e => e.textContent.trim()));
            const lastRowNum = parseInt(yield (yield this.page.$('form[name=frmData]>div:last-child>div>table tbody tr:nth-child(2) td:nth-child(2)')).evaluate(e => e.textContent.trim()));
            const navigationBar = yield this.page.$('form[name=frmData]>div:last-child>table:last-child');
            if (firstRowNum > this.rowNum) {
                const nextLink = (yield navigationBar.$x(`//a[contains(text(), 'Next')]`))[0];
                if (nextLink) {
                    console.log('go next');
                    yield nextLink.click();
                    yield this.page.waitForNavigation();
                    yield this.goCorrectPage();
                }
            }
            if (lastRowNum < this.rowNum) {
                const prevLink = (yield navigationBar.$x(`//a[contains(text(), 'Prev')]`))[0];
                if (prevLink) {
                    console.log('go prev');
                    yield prevLink.click();
                    yield this.page.waitForNavigation();
                }
            }
        });
    }
    downloadReportFromExport(modal) {
        return __awaiter(this, void 0, void 0, function* () {
            const exportButton = yield modal.$('#sButton');
            this.addLog('opening export modal');
            yield exportButton.click();
            this.addLog('waiting for export modal');
            const exportModal = yield this.getNewPageWhenLoaded();
            this.addLog('export modal opened');
            const sKeyPressedFunction = yield exportModal.evaluate(() => {
                //@ts-ignore
                return sKeyPressed.toString();
            });
            const sKeyPressedFunctionText = sKeyPressedFunction.replace(/[\s\n\r ]/g, '');
            const uri = sKeyPressedFunctionText.substring(sKeyPressedFunctionText.indexOf('frmData.action="') + 'frmData.action="'.length, sKeyPressedFunctionText.indexOf('";frmData.submit();'));
            const pageUrl = this.page.url();
            const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
            const host = origin.substr(8);
            exportModal.evaluate(`(async () => {
        console.log('data', document.frmData);
        const form = document.frmData;
        form.submit = function () { return false; }
        form.onsubmit = function (event) { event.preventDefault(); event.stopPropagation(); return false; }
        return await fetch('${origin}${uri}', {
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
                console.log('stream', stream);
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
                                window.zuntaData = reader.result;
                                console.log('reader', reader.result)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err));
        })()`);
            yield exportModal.waitForFunction(() => {
                //@ts-ignore
                return !!window.zuntaData;
            }, { timeout: 1 * 60 * 1000 });
            const text = yield exportModal.evaluate(() => {
                //@ts-ignore
                return window.zuntaData;
            });
            exportModal.close();
            yield this.waitUntilPageClosed(exportModal);
            return Buffer.from(text, 'utf8');
        });
    }
    downloadReport(modal) {
        return __awaiter(this, void 0, void 0, function* () {
            const pageUrl = this.page.url();
            const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
            const host = origin.substr(8);
            const ESOLfileId = yield modal.evaluate(() => {
                const field = document.querySelector('input[name=ESOLfileId]');
                //@ts-ignore
                return field.value;
            });
            modal.evaluate(`(async () => {
        console.log('data', document.frmData);
        const form = document.frmData;
        form.submit = function () { return false; }
        form.onsubmit = function (event) { event.preventDefault(); event.stopPropagation(); return false; }
        return await fetch('${origin}/tools/edi/exportsave.jsp?ESOL837Link=Y&ESOLfileId=${ESOLfileId}', {
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
                console.log('stream', stream);
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
                                window.zuntaData = reader.result;
                                console.log('reader', reader.result)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err));
        })()`);
            yield modal.waitForFunction(() => {
                //@ts-ignore
                return !!window.zuntaData;
            }, { timeout: 1 * 60 * 1000 });
            const text = yield modal.evaluate(() => {
                //@ts-ignore
                return window.zuntaData;
            });
            // console.log('text', text);
            modal.close();
            yield this.waitUntilPageClosed(modal);
            return Buffer.from(text, 'utf8');
        });
    }
}
exports.GetUBReport = GetUBReport;
//# sourceMappingURL=GetUBReport.js.map