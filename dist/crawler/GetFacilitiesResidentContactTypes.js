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
exports.GetFacilitiesResidentContactTypes = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilitiesResidentContactTypes extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityIds) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            yield this.gotoReportPage([
                'Resident Contacts',
                'Resident Contacts (Admin - ADT / Profiles)',
                'Resident Contacts (Clinical - ADT / Profiles)'
            ]);
            yield this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });
            const facilitiesResidentContactTypes = {};
            const initFacilityResidentContactTypes = (facilityId) => __awaiter(this, void 0, void 0, function* () {
                yield this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });
                facilitiesResidentContactTypes[facilityId] = yield this.page.evaluate(() => {
                    const contactTypesSelectorArray = Array.prototype.slice.call(document.querySelectorAll('select[name="ESOLcontacttype"] > option'), 0);
                    return contactTypesSelectorArray
                        .filter(element => element.value != -1)
                        .map((element) => ({
                        value: element.value,
                        type: element.text
                    }));
                });
            });
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityIds.includes(defaultSelectedFacilityId)) {
                yield initFacilityResidentContactTypes(defaultSelectedFacilityId);
            }
            for (let i = 0; i < this.facilityIds.length; i++) {
                if (defaultSelectedFacilityId === this.facilityIds[i]) {
                    continue;
                }
                yield this.switchToFacility(this.facilityIds[i]);
                yield initFacilityResidentContactTypes(this.facilityIds[i]);
            }
            yield this.close();
            return facilitiesResidentContactTypes;
        });
    }
}
exports.GetFacilitiesResidentContactTypes = GetFacilitiesResidentContactTypes;
//# sourceMappingURL=GetFacilitiesResidentContactTypes.js.map