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
exports.GetFacilityMedicaidDetailsReports = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilityMedicaidDetailsReports extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityId) {
        super(username, password);
        this.facilityId = facilityId;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityId !== defaultSelectedFacilityId) {
                yield this.switchToFacility(this.facilityId);
            }
            yield this.gotoReportPage([
                'Resident List Report *NEW*',
                'Resident List Report *NEW* (Admin - ADT / Profiles)',
                'Resident List Report *NEW* (Clinical - ADT / Profiles)'
            ]);
            yield this.page.waitForSelector('#fieldstodisplaytable', { timeout: this.regularTimeout });
            const getFacilityMadicaidReport = () => __awaiter(this, void 0, void 0, function* () {
                const checkboxValuesToSelect = ['3', '4', '125', '41'];
                yield this.page.$$eval('#fieldstodisplaytable input[type="checkbox"]', (inputs, checkboxValuesToSelect) => {
                    inputs.forEach(input => {
                        if (checkboxValuesToSelect.indexOf(input.value) !== -1) {
                            input.checked = true;
                        }
                        else {
                            input.checked = false;
                        }
                    });
                }, checkboxValuesToSelect);
                yield this.page.$$eval('#reportFormatType option', (options) => {
                    options.forEach((option) => {
                        if (option.value === 'csv') {
                            option.selected = true;
                        }
                    });
                });
                return yield this.fetchReportBuffer('/reporting/setup/runtime/residentList.xhtml?action=runReport&report_id=-81&ESOLreportType=adtprofiles&ESOLaction=run&ESOLreportCatalogId=-9&ESOLtabType=P', ['form', '"N"']);
            });
            const buffer = yield getFacilityMadicaidReport();
            yield this.close();
            return buffer;
        });
    }
}
exports.GetFacilityMedicaidDetailsReports = GetFacilityMedicaidDetailsReports;
//# sourceMappingURL=GetFacilityMedicaidDetailsReport.js.map