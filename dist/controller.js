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
const PccBaseCrawler_1 = require("./crawler/PccBaseCrawler");
const GetAllFacilities_1 = require("./crawler/GetAllFacilities");
const service_1 = require("./service");
class Controller {
    constructor() {
        this.appService = new service_1.AppService();
    }
    checkLogin(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = body;
            try {
                const crawler = new PccBaseCrawler_1.PccBaseCrawler(username, password);
                yield crawler.start();
                return true;
            }
            catch (e) {
                console.log('checkLogin:e', e);
                return false;
            }
        });
    }
    getAllFacilities(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = body;
            try {
                const crawler = new GetAllFacilities_1.GetAllFacilities(username, password);
                const facilities = yield crawler.start();
                return facilities;
            }
            catch (e) {
                console.log('getAllFacilities:e', e);
                throw new Error('Pcc creadetails are wrong');
            }
        });
    }
    fetchFacilitiesWithDetails(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            console.log('body', body);
            const { username, password, facilities, activityId, userName, userIP, userId } = body;
            yield this.appService.startFetchingFacilitiesWithDetails(chainId, facilities, username, password, {
                activityId,
                userName,
                userIP,
                userId
            });
            return 'OK';
        });
    }
    updateFacility(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const params = body.params;
            const { username, password, facilityId, activityId, facilityOriginId, updateFacilityDetails, updateFacilityResidentContactTypes, updateFacilityPayerTypes, updateResidents } = params;
            console.log('create request: updateFacility ', chainId, {
                updateFacilityDetails,
                updateFacilityResidentContactTypes,
                updateFacilityPayerTypes,
                updateResidents,
            }, username, password);
            yield this.appService.startFetchFacilityUpdates(chainId, updateFacilityDetails, updateFacilityResidentContactTypes, updateFacilityPayerTypes, updateResidents, facilityId, facilityOriginId, username, password, activityId, params);
            return 'OK';
        });
    }
    fetchFacilityResidents(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const { username, password, facility, activityId, failActivityId, params } = body;
            console.log('create request fetch residents ', JSON.stringify(body));
            yield this.appService.startFetchingFacilityResidents(chainId, facility, username, password, params);
            return 'OK';
        });
    }
    fetchTransactions(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const { facilityId, dateTo, dateFrom, payerTypes, username, password, params } = body;
            console.log('fetch  transactions endpoint', JSON.stringify(body));
            yield this.appService.fetchFacilityTransactions(chainId, facilityId, dateFrom, dateTo, payerTypes, username, password, params);
            return 'OK';
        });
    }
    uploadPayments(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const { facilityId, facilityRealId, username, password, payments, csvData, teds, effectiveDate, activityId, numTries = 0, willowDepositId, errorsStack } = body;
            console.log('numTries', numTries);
            const paymentsData = { payments, teds, csvData };
            return this.appService.updatePayments(numTries, chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate, activityId, errorsStack);
        });
    }
    checkPayments(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const { facilityId, username, password, payments, csvData, teds, effectiveDate, facilityRealId, willowDepositId } = body;
            const paymentsData = { payments, teds, csvData };
            return this.appService.checkPayments(chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate);
        });
    }
    fetchUBReport(params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password, rowNum, facilityOriginId, facilityId } = body;
            return this.appService.fetchUBReport(username, password, facilityOriginId, facilityId, rowNum);
        });
    }
    deleteFailedBatch(param, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const chainId = param;
            const { username, password, facilityId, activityId, willowDepositId } = body;
            return this.appService.deleteFailedBatch(chainId, username, password, facilityId, willowDepositId, activityId);
        });
    }
}
exports.default = new Controller();
//# sourceMappingURL=controller.js.map