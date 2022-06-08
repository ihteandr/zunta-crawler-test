import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetFacilitiesResidentsContactsReports extends PccBaseCrawler {
    facilityIds: string[];
    constructor (username: string, password: string, facilityIds: string[]) {
        super(username, password);
        this.facilityIds = facilityIds;
    }

    async start (): Promise<any> {
        console.log('start fetch residents', this.facilityIds);
        try {
            await this.enter();
        } catch (e) {
            throw new Error('access denied');
        }

        await this.gotoReportPage([
            'Resident Contacts',
            'Resident Contacts (Admin - ADT / Profiles)',
            'Resident Contacts (Clinical - ADT / Profiles)'
        ]);
        await this.page.waitForSelector('select[name="ESOLcontacttype"]', { timeout: this.regularTimeout });
        const facilitiesResidentContactReports = {};
        const initFacilityResidentContactReport = async (facilityId: string) => {
            await this.page.$$eval('#ESOLstatusid option', (options) => {
                options.forEach((option) => {
                    if (option.value === '-1') {
                        option.selected = true;
                    }
                });
            });
            await this.page.$eval("#id_ESOLprintphone", check => check.checked = true);
            await this.page.$eval("#id_ESOLprintemail", check => check.checked = true);
            
            await this.page.$$eval('#ESOLprintformat option', (options) => {
                options.forEach((option) => {
                    if (option.value === 'csv') {
                        option.selected = true;
                    }
                });
            });
            try {
                await this.page.select('select[name="ESOLoutpatient"]', '0');
                console.log('outpation selected')
            } catch (error) {
                console.log('select dont exist');
            }
            console.log('next step afte outpatient');
            const buffer = await this.fetchReportBuffer('/admin/reports/resContactReport.xhtml');
            facilitiesResidentContactReports[facilityId] = buffer;
        };
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityIds.includes(defaultSelectedFacilityId)) {
            await initFacilityResidentContactReport(defaultSelectedFacilityId);
        }
        for (let i = 0; i < this.facilityIds.length; i++) {
            if (defaultSelectedFacilityId === this.facilityIds[i]) {
                continue;
            }
            await this.switchToFacility(this.facilityIds[i]);
            await initFacilityResidentContactReport(this.facilityIds[i])
        }
        console.log('resident crawl report finished');
        await this.close();
        return facilitiesResidentContactReports;
    }
}
