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
exports.GetFacilitiesWithDetails = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetFacilitiesWithDetails extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityIds) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            const facilitiesDetails = [];
            const initFacilityDetails = (facilityId) => __awaiter(this, void 0, void 0, function* () {
                yield this.page.waitForSelector('.footertext', { timeout: this.regularTimeout });
                const firstDivText = yield (yield (yield this.page.$('.footertext div:first-child')).getProperty('textContent')).jsonValue();
                const splitD = firstDivText.split(/\n/);
                const [name, street, address2, phone] = splitD.map(line => line.trim())
                    .filter(line => line.length > 0);
                const addr = address2.split(',');
                const zip = addr[1].trim().split(' ')[1];
                const city = addr[0];
                const state = addr[1].trim().split(' ')[0];
                facilitiesDetails.push({
                    name,
                    id: facilityId,
                    street,
                    city,
                    state,
                    zip,
                    phone: phone.replace('Phone: ', '')
                });
            });
            const defaultSelectedFacilityId = yield (yield (yield this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
            if (this.facilityIds.includes(defaultSelectedFacilityId)) {
                yield initFacilityDetails(defaultSelectedFacilityId);
            }
            for (let i = 0; i < this.facilityIds.length; i++) {
                if (defaultSelectedFacilityId === this.facilityIds[i]) {
                    continue;
                }
                yield this.switchToFacility(this.facilityIds[i]);
                yield initFacilityDetails(this.facilityIds[i]);
            }
            yield this.close();
            return facilitiesDetails;
        });
    }
}
exports.GetFacilitiesWithDetails = GetFacilitiesWithDetails;
//# sourceMappingURL=GetFacilitiesWithDetails.js.map