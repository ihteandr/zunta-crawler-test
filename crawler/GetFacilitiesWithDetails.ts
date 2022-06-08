import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetFacilitiesWithDetails extends PccBaseCrawler {
    facilityIds: string[];
    constructor (username: string, password: string, facilityIds: string[]) {
        super(username, password);
        this.facilityIds = facilityIds;
    }
    async start (): Promise<any> {
        await this.enter();
        const facilitiesDetails: any = [];
        const initFacilityDetails = async (facilityId: string) => {
            await this.page.waitForSelector('.footertext', { timeout: this.regularTimeout });
            const firstDivText = await (await (await this.page.$('.footertext div:first-child')).getProperty('textContent')).jsonValue();
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
        };
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityIds.includes(defaultSelectedFacilityId)) {
            await initFacilityDetails(defaultSelectedFacilityId);
        }
        for (let i = 0; i < this.facilityIds.length; i++) {
            if (defaultSelectedFacilityId === this.facilityIds[i]) {
                continue;
            }
            await this.switchToFacility(this.facilityIds[i]);
            await initFacilityDetails(this.facilityIds[i])
        }
        await this.close();
        return facilitiesDetails;
    }
}
