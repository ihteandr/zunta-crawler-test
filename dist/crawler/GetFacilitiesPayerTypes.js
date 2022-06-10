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
exports.GetFacilitiesPayerTypes = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilitiesPayerTypes extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityIds) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            yield this.gotoReportPage('Transaction Report');
            yield this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
            const facilitiesPayerTypes = {};
            const initFacilityPayerTypes = (facilityId) => __awaiter(this, void 0, void 0, function* () {
                yield this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
                const listOfPayers = yield this.page.$$('#payerSelection > table > tbody > tr > td > div.scroller > label');
                const arrayOfPayers = [];
                for (let a = 0; a < listOfPayers.length; a++) {
                    const idElem = yield listOfPayers[a].$eval('input', (elem) => ({
                        value: elem['value'],
                    }));
                    const nameElem = yield listOfPayers[a].evaluate((elem) => ({
                        value: elem['innerText'],
                    }));
                    arrayOfPayers.push({
                        id: idElem.value,
                        name: nameElem.value.replace('\n', ''),
                    });
                }
                facilitiesPayerTypes[facilityId] = arrayOfPayers;
            });
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityIds.includes(defaultSelectedFacilityId)) {
                yield initFacilityPayerTypes(defaultSelectedFacilityId);
            }
            for (let i = 0; i < this.facilityIds.length; i++) {
                if (defaultSelectedFacilityId === this.facilityIds[i]) {
                    continue;
                }
                yield this.switchToFacility(this.facilityIds[i]);
                yield initFacilityPayerTypes(this.facilityIds[i]);
            }
            yield this.close();
            return facilitiesPayerTypes;
        });
    }
}
exports.GetFacilitiesPayerTypes = GetFacilitiesPayerTypes;
//# sourceMappingURL=GetFacilitiesPayerTypes.js.map