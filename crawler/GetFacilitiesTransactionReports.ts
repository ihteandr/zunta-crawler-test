import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetFacilitiesTransactionReports extends PccBaseCrawler {
    facilityIds: string[];
    dateFrom: string;
    dateTo: string;
    payerTypeIds: string[] | null;
    constructor (username: string, password: string, facilityIds: string[], dateFrom: string, dateTo: string, payerTypeIds: string[]) {
        super(username, password);
        this.facilityIds = facilityIds;
        this.dateFrom = dateFrom;
        this.dateTo = dateTo;
        this.payerTypeIds = payerTypeIds;
    }

    async start (): Promise<any> {
        if (this.payerTypeIds === null || this.payerTypeIds === undefined) {
            return {};
        }
        console.log('get transactions for payers', this.payerTypeIds);
        await this.enter();
        await this.gotoReportPage('Transaction Report');
        await this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
        const facilitiesTransactionReports = {};
        const initFacilityTransactionReport = async (facilityId: string) => {
            const initFilters = async () => {
                await this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
                await this.page.$eval("#suppressZeroValue", check => check.checked = true);
                await this.page.$eval("#showSubTotals", check => check.checked = false);
                await this.page.$eval("#showCumulativeBalance", check => check.checked = false);
                await this.page.$eval("#summarizeReversal", check => check.checked = true);
                await this.page.$eval("#showComments", check => check.checked = false);
                await this.page.$eval("#clientsWithTransactions", check => check.checked = false);
                await this.page.$eval("#billStatus", check => check.checked = true);
                await this.page.$eval("#unbillStatus", check => check.checked = true);
                await this.page.$eval("#markAsBilledStatus", check => check.checked = true);
                await this.page.$eval("#showDetails", check => check.checked = false);
                await this.page.$eval('#startDate', (input, dateFrom) => input.value = dateFrom, this.dateFrom);
                await this.page.$eval('#startDate_dummy', (input, dateFrom) => input.value = dateFrom, this.dateFrom);
                await this.page.$eval('#endDate', (input, dateTo) => input.value = dateTo, this.dateTo);
                await this.page.$eval('#endDate_dummy', (input, dateTo) => input.value = dateTo, this.dateTo);
                await this.page.$$eval('#payerSelection input', (inputs, payerTypeIds) => {
                    inputs.forEach(input => {
                        if (payerTypeIds.indexOf(input.value) !== -1) {
                            input.checked = true;
                        } else {
                            input.checked = false;
                        }
                    });
                }, this.payerTypeIds)

                await this.page.$$eval('#format option', (options) => {
                    options.forEach((option) => {
                        if (option.value === 'csv') {
                            option.selected = true;
                        }
                    });
                });
            };
            await initFilters();
            if (!facilitiesTransactionReports[facilityId]) {
                facilitiesTransactionReports[facilityId] = [];
            }
            await this.page.waitFor(2000);
            facilitiesTransactionReports[facilityId] = await this.downloadTransactionReport()
        };
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityIds.includes(defaultSelectedFacilityId)) {
            await initFacilityTransactionReport(defaultSelectedFacilityId);
        }
        for (let i = 0; i < this.facilityIds.length; i++) {
            if (defaultSelectedFacilityId === this.facilityIds[i]) {
                continue;
            }
            await this.switchToFacility(this.facilityIds[i]);
            await initFacilityTransactionReport(this.facilityIds[i])
        }
        try {
            await this.close();
        } catch (e) {
            console.log('error', e);
        }
        return facilitiesTransactionReports;
    }
}
