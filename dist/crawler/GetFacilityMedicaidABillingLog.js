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
exports.GetFacilityMedicareABillingLog = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilityMedicareABillingLog extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityId, reportMonth) {
        super(username, password);
        this.facilityId = facilityId;
        this.reportMonth = reportMonth;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            console.log('facilityId', defaultSelectedFacilityId, this.facilityId);
            if (this.facilityId !== defaultSelectedFacilityId) {
                yield this.switchToFacility(this.facilityId);
            }
            yield this.gotoReportPage([
                'Medicare A Billing Log',
            ]);
            yield this.page.waitForSelector('#clientsearchnumber', { timeout: this.regularTimeout });
            const fromYear = this.getFromYear();
            const month = this.getReportMonth();
            const toYear = this.getToYear();
            yield this.page.select('select[name="ESOLmonthStart"]', month.toString());
            yield this.page.select('select[name="ESOLyearStart"]', fromYear.toString());
            yield this.page.select('select[name="ESOLmonthEnd"]', month.toString());
            yield this.page.select('select[name="ESOLyearEnd"]', toYear.toString());
            // await this.page.$$eval('input[name="ESOLprintformat"]', checks => checks.forEach(c => c.checked = true));
            yield this.page.click('#runButton');
            console.log('run report clicked');
            const reportPage = yield this.getNewPageWhenLoaded();
            const data = yield reportPage.evaluate(() => {
                function parseAmount(amount) {
                    const parsed = parseFloat(amount.replace('$', '').replace(/,/g, ''));
                    return isNaN(parsed) ? 0 : parsed;
                }
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        const result = [];
                        const tables = document.querySelectorAll('table');
                        tables.forEach((table, index) => {
                            if (index < 3) {
                                return;
                            }
                            for (const row of table.rows) {
                                if (row.cells.length !== 29 || row.cells[0].className !== 'smallestData') {
                                    continue;
                                }
                                if (!row.cells[0].innerText || !row.cells[0].innerText.trim()) {
                                    continue;
                                }
                                const item = {
                                    from: row.cells[0].innerText,
                                    to: row.cells[1].innerText,
                                    hicOrMbi: row.cells[3].innerText,
                                    total: parseAmount(row.cells[19].innerText),
                                    remitDate: row.cells[20].innerText,
                                    recFromMCare: parseAmount(row.cells[21].innerText),
                                    coinsName: row.cells[22].innerText,
                                    coinsDays: row.cells[23].innerText,
                                    coins: parseAmount(row.cells[24].innerText),
                                    coinsAmountPaid: parseAmount(row.cells[25].innerText),
                                    coinsDue: parseAmount(row.cells[27].innerText)
                                };
                                result.push(item);
                            }
                            resolve(result);
                        });
                    }, 5000);
                });
            });
            yield this.close();
            return data;
        });
    }
    getFromYear() {
        const to = new Date().setMonth(this.getReportMonth() - 1);
        const now = Date.now();
        let currentYear = new Date().getFullYear();
        if (to > now) {
            currentYear = currentYear - 1;
        }
        return currentYear - 3;
    }
    /**
     * Calculate report month from
     * month = fiscal year end - 4 month
     * @private
     */
    getReportMonth() {
        if (this.reportMonth - 4 > 0) {
            return this.reportMonth - 4;
        }
        return 12 + this.reportMonth - 4;
    }
    getToYear() {
        const month = this.getReportMonth();
        if (new Date().setMonth(month) > Date.now()) {
            return new Date().getFullYear() - 1;
        }
        return new Date().getFullYear();
    }
}
exports.GetFacilityMedicareABillingLog = GetFacilityMedicareABillingLog;
//# sourceMappingURL=GetFacilityMedicaidABillingLog.js.map