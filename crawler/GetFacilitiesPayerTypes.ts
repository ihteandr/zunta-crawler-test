import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetFacilitiesPayerTypes extends PccBaseCrawler {
    facilityIds: string[];
    constructor (username: string, password: string, facilityIds: string[]) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    async start (): Promise<any> {
        await this.enter();
        await this.gotoReportPage('Transaction Report');
        await this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });

        const facilitiesPayerTypes = {};
        const initFacilityPayerTypes = async (facilityId: string) => {
            await this.page.waitForSelector('#payerSelection', { timeout: this.regularTimeout });
            const listOfPayers = await this.page.$$('#payerSelection > table > tbody > tr > td > div.scroller > label');
            const arrayOfPayers: any[] = [];
            for(let a = 0; a < listOfPayers.length; a++) {
                const idElem = await listOfPayers[a].$eval('input', (elem) => ({
                    value: elem['value'],
                }));
                const nameElem = await listOfPayers[a].evaluate((elem) => ({
                    value: elem['innerText'],
                }));
                arrayOfPayers.push({
                    id: idElem.value,
                    name: nameElem.value.replace('\n', ''),
                });
            }
            facilitiesPayerTypes[facilityId] = arrayOfPayers;
        };
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityIds.includes(defaultSelectedFacilityId)) {
            await initFacilityPayerTypes(defaultSelectedFacilityId);
        }
        for (let i = 0; i < this.facilityIds.length; i++) {
            if (defaultSelectedFacilityId === this.facilityIds[i]) {
                continue;
            }
            await this.switchToFacility(this.facilityIds[i]);
            await initFacilityPayerTypes(this.facilityIds[i])
        }
        await this.close();
        return facilitiesPayerTypes;
    }
}
