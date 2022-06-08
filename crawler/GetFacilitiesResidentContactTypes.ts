import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetFacilitiesResidentContactTypes extends PccBaseCrawler {
    facilityIds: string[];
    constructor (username: string, password: string, facilityIds: string[]) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    async start (): Promise<any> {
        await this.enter();
        await this.gotoReportPage([
            'Resident Contacts',
            'Resident Contacts (Admin - ADT / Profiles)',
            'Resident Contacts (Clinical - ADT / Profiles)'
        ]);
        await this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });

        const facilitiesResidentContactTypes = {};
        const initFacilityResidentContactTypes = async (facilityId: string) => {
            await this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });
            facilitiesResidentContactTypes[facilityId] = await this.page.evaluate(() => {
                const contactTypesSelectorArray = Array.prototype.slice.call(document.querySelectorAll('select[name="ESOLcontacttype"] > option'), 0)
                return contactTypesSelectorArray
                .filter(element => element.value != -1)
                .map((element) => ({ 
                    value: element.value,
                    type: element.text
                }));
            });
        };
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityIds.includes(defaultSelectedFacilityId)) {
            await initFacilityResidentContactTypes(defaultSelectedFacilityId);
        }
        for (let i = 0; i < this.facilityIds.length; i++) {
            if (defaultSelectedFacilityId === this.facilityIds[i]) {
                continue;
            }
            await this.switchToFacility(this.facilityIds[i]);
            await initFacilityResidentContactTypes(this.facilityIds[i])
        }
        await this.close();
        return facilitiesResidentContactTypes;
    }
}