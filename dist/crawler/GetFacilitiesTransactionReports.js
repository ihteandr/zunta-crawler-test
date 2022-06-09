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
exports.GetFacilitiesTransactionReports = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilitiesTransactionReports extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityIds, dateFrom, dateTo, payerTypeIds) {
        super(username, password);
        this.facilityIds = facilityIds;
        this.dateFrom = dateFrom;
        this.dateTo = dateTo;
        this.payerTypeIds = payerTypeIds;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.payerTypeIds === null || this.payerTypeIds === undefined) {
                return {};
            }
            console.log('get transactions for payers', this.payerTypeIds);
            yield this.enter();
            yield this.gotoReportPage('Transaction Report');
            yield this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
            const facilitiesTransactionReports = {};
            const initFacilityTransactionReport = (facilityId) => __awaiter(this, void 0, void 0, function* () {
                const initFilters = () => __awaiter(this, void 0, void 0, function* () {
                    yield this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
                    yield this.page.$eval("#suppressZeroValue", check => check.checked = true);
                    yield this.page.$eval("#showSubTotals", check => check.checked = false);
                    yield this.page.$eval("#showCumulativeBalance", check => check.checked = false);
                    yield this.page.$eval("#summarizeReversal", check => check.checked = true);
                    yield this.page.$eval("#showComments", check => check.checked = false);
                    yield this.page.$eval("#clientsWithTransactions", check => check.checked = false);
                    yield this.page.$eval("#billStatus", check => check.checked = true);
                    yield this.page.$eval("#unbillStatus", check => check.checked = true);
                    yield this.page.$eval("#markAsBilledStatus", check => check.checked = true);
                    yield this.page.$eval("#showDetails", check => check.checked = false);
                    yield this.page.$eval('#startDate', (input, dateFrom) => input.value = dateFrom, this.dateFrom);
                    yield this.page.$eval('#startDate_dummy', (input, dateFrom) => input.value = dateFrom, this.dateFrom);
                    yield this.page.$eval('#endDate', (input, dateTo) => input.value = dateTo, this.dateTo);
                    yield this.page.$eval('#endDate_dummy', (input, dateTo) => input.value = dateTo, this.dateTo);
                    yield this.page.$$eval('#payerSelection input', (inputs, payerTypeIds) => {
                        inputs.forEach(input => {
                            if (payerTypeIds.indexOf(input.value) !== -1) {
                                input.checked = true;
                            }
                            else {
                                input.checked = false;
                            }
                        });
                    }, this.payerTypeIds);
                    yield this.page.$$eval('#format option', (options) => {
                        options.forEach((option) => {
                            if (option.value === 'csv') {
                                option.selected = true;
                            }
                        });
                    });
                });
                yield initFilters();
                if (!facilitiesTransactionReports[facilityId]) {
                    facilitiesTransactionReports[facilityId] = [];
                }
                yield this.page.waitFor(2000);
                facilitiesTransactionReports[facilityId] = yield this.downloadTransactionReport();
            });
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityIds.includes(defaultSelectedFacilityId)) {
                yield initFacilityTransactionReport(defaultSelectedFacilityId);
            }
            for (let i = 0; i < this.facilityIds.length; i++) {
                if (defaultSelectedFacilityId === this.facilityIds[i]) {
                    continue;
                }
                yield this.switchToFacility(this.facilityIds[i]);
                yield initFacilityTransactionReport(this.facilityIds[i]);
            }
            try {
                yield this.close();
            }
            catch (e) {
                console.log('error', e);
            }
            return facilitiesTransactionReports;
        });
    }
}
exports.GetFacilitiesTransactionReports = GetFacilitiesTransactionReports;
//# sourceMappingURL=GetFacilitiesTransactionReports.js.map