import { PccBaseCrawler } from "./PccBaseCrawler";
import { writeFileSync } from "fs";

export class GetFacilityMedicaidDetailsReports extends PccBaseCrawler {
    facilityId: string;
    constructor (username: string, password: string, facilityId: string) {
        super(username, password);
        this.facilityId = facilityId;
    }

    async start (): Promise<any> {
        await this.enter();
        const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
        if (this.facilityId !== defaultSelectedFacilityId) {
            await this.switchToFacility(this.facilityId);
        }
        await this.gotoReportPage([
            'Resident List Report *NEW*',
            'Resident List Report *NEW* (Admin - ADT / Profiles)',
            'Resident List Report *NEW* (Clinical - ADT / Profiles)'
        ]);
        await this.page.waitForSelector('#fieldstodisplaytable', { timeout: this.regularTimeout });
        const getFacilityMadicaidReport = async () => {
            const checkboxValuesToSelect = ['3', '4', '125', '41'];
            await this.page.$$eval('#fieldstodisplaytable input[type="checkbox"]', (inputs, checkboxValuesToSelect) => {
                inputs.forEach(input => {
                    if (checkboxValuesToSelect.indexOf(input.value) !== -1) {
                        input.checked = true;
                    } else {
                        input.checked = false;
                    }
                });
            }, checkboxValuesToSelect);
            await this.page.$$eval('#reportFormatType option', (options) => {
                options.forEach((option) => {
                    if (option.value === 'csv') {
                        option.selected = true;
                    }
                });
            });
            return await this.fetchReportBuffer('/reporting/setup/runtime/residentList.xhtml?action=runReport&report_id=-81&ESOLreportType=adtprofiles&ESOLaction=run&ESOLreportCatalogId=-9&ESOLtabType=P', ['form', '"N"'])
        };
        const buffer = await getFacilityMadicaidReport();
        await this.close();
        return buffer;
    }
}
