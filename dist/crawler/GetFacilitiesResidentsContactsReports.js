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
exports.GetFacilitiesResidentsContactsReports = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilitiesResidentsContactsReports extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityIds) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('start fetch residents', this.facilityIds);
            yield this.enter();
            yield this.gotoReportPage([
                'Resident Contacts',
                'Resident Contacts (Admin - ADT / Profiles)',
                'Resident Contacts (Clinical - ADT / Profiles)'
            ]);
            yield this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });
            const facilitiesResidentContactReports = {};
            const initFacilityResidentContactReport = (facilityId) => __awaiter(this, void 0, void 0, function* () {
                yield this.page.$$eval('#ESOLstatusid option', (options) => {
                    options.forEach((option) => {
                        if (option.value === '-1') {
                            option.selected = true;
                        }
                    });
                });
                yield this.page.$eval("#id_ESOLprintphone", check => check.checked = true);
                yield this.page.$eval("#id_ESOLprintemail", check => check.checked = true);
                yield this.page.$$eval('#ESOLprintformat option', (options) => {
                    options.forEach((option) => {
                        if (option.value === 'csv') {
                            option.selected = true;
                        }
                    });
                });
                try {
                    yield this.page.select('select[name="ESOLoutpatient"]', '0');
                    console.log('outpation selected');
                }
                catch (error) {
                    console.log('select dont exist');
                }
                console.log('next step afte outpatient');
                const buffer = yield this.fetchReportBuffer('/admin/reports/resContactReport.xhtml');
                facilitiesResidentContactReports[facilityId] = buffer;
            });
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityIds.includes(defaultSelectedFacilityId)) {
                yield initFacilityResidentContactReport(defaultSelectedFacilityId);
            }
            for (let i = 0; i < this.facilityIds.length; i++) {
                if (defaultSelectedFacilityId === this.facilityIds[i]) {
                    continue;
                }
                yield this.switchToFacility(this.facilityIds[i]);
                yield initFacilityResidentContactReport(this.facilityIds[i]);
            }
            console.log('resident crawl report finished');
            yield this.close();
            return facilitiesResidentContactReports;
        });
    }
}
exports.GetFacilitiesResidentsContactsReports = GetFacilitiesResidentsContactsReports;
//# sourceMappingURL=GetFacilitiesResidentsContactsReports.js.map