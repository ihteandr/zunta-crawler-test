import { PccBaseCrawler } from './crawler/PccBaseCrawler';
import { GetAllFacilities } from './crawler/GetAllFacilities';
import { AppService } from './service';

class Controller {
    appService: AppService;
    constructor() {
        this.appService = new AppService();
    }

    async checkLogin(
        param,
        body
    ) {
        const { username, password } = body
        try {
            const crawler = new PccBaseCrawler(username, password);
            await crawler.start();
            return true;
        } catch(e) {
            console.log('checkLogin:e', e);
            return false;
        }
    }

    async getAllFacilities(
        param, body
    ) {
        const { username, password } = body
        try {
            const crawler = new GetAllFacilities(username, password);
            const facilities = await crawler.start();
            return facilities;
        } catch (e) {
            console.log('getAllFacilities:e', e)
            throw new Error('Pcc creadetails are wrong')
        }
    }


    async fetchFacilitiesWithDetails(param, body): Promise<'OK'> {
        const chainId = param;
        console.log('body',body)
        const {
            username,
            password,
            facilities,
            activityId,
            userName,
            userIP,
            userId
        } = body;

        await this.appService.startFetchingFacilitiesWithDetails(chainId, facilities, username, password, {
            activityId,
            userName,
            userIP,
            userId
        });
        return 'OK';
    }

    async updateFacility(param, body): Promise<'OK'> {
        const chainId = param;
        const params = body.params;
        const {
            username,
            password,
            facilityId,
            activityId,
            facilityOriginId,
            updateFacilityDetails,
            updateFacilityResidentContactTypes,
            updateFacilityPayerTypes,
            updateResidents
        } = params;

        console.log('create request: updateFacility ', chainId, {
            updateFacilityDetails,
            updateFacilityResidentContactTypes,
            updateFacilityPayerTypes,
            updateResidents,
        }, username, password)

        await this.appService.startFetchFacilityUpdates(
            chainId,
            updateFacilityDetails,
            updateFacilityResidentContactTypes,
            updateFacilityPayerTypes,
            updateResidents,
            facilityId,
            facilityOriginId,
            username,
            password,
            activityId,
            params
        );
        return 'OK';
    }


    async fetchFacilityResidents(param, body): Promise<'OK'> {
        const chainId = param;
        const {
            username,
            password,
            facility,
            activityId,
            failActivityId,
            params
        } = body;

        console.log('create request fetch residents ', JSON.stringify(body))
        await this.appService.startFetchingFacilityResidents(chainId, facility, username, password, params);
        return 'OK';
    }


    async fetchTransactions (param, body) {
        const chainId = param;
        const {
            facilityId,
            dateTo,
            dateFrom,
            payerTypes,
            username,
            password,
            params
        } = body;
        console.log('fetch  transactions endpoint', JSON.stringify(body));
        await this.appService.fetchFacilityTransactions(chainId, facilityId, dateFrom, dateTo, payerTypes, username, password, params);
        return 'OK'
    }

    async uploadPayments(param, body) {
        const chainId = param;
        const {
            facilityId,
            facilityRealId,
            username,
            password,
            payments,
            csvData,
            teds,
            effectiveDate,
            activityId,
            numTries = 0,
            willowDepositId,
            errorsStack
        } = body;
        console.log('numTries', numTries);
        const paymentsData = { payments, teds, csvData };
        return this.appService.updatePayments(numTries, chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate, activityId, errorsStack);
    }

    async checkPayments(param, body) {
        const chainId = param;
        const {
            facilityId,
            username,
            password,
            payments,
            csvData,
            teds,
            effectiveDate,
            facilityRealId,
            willowDepositId
        } = body;

        const paymentsData = { payments, teds, csvData };
        return this.appService.checkPayments(chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate);
    }

    async fetchUBReport (params, body) {
        const {
            username,
            password,
            rowNum,
            facilityOriginId,
            facilityId
        } = body;
        return this.appService.fetchUBReport(username, password, facilityOriginId, facilityId, rowNum);
    }

    async deleteFailedBatch(param, body) {
        const chainId = param;
        const {
            username,
            password,
            facilityId,
            activityId,
            willowDepositId
        } = body;

        return this.appService.deleteFailedBatch(chainId, username, password, facilityId, willowDepositId, activityId);
    }
}

export default new Controller();
