import { PccBaseCrawler } from './PccBaseCrawler';

export class GetFacilityMedicareABillingLog extends PccBaseCrawler {
  facilityId: string;
  reportMonth: number;
  constructor(username: string, password: string, facilityId: string, reportMonth: number) {
    super(username, password);
    this.facilityId = facilityId;
    this.reportMonth = reportMonth;
  }

  async start(): Promise<any> {
    await this.enter();
    const defaultSelectedFacilityId = await (await (await this.page.$('input[name="current_fac_id"]')).getProperty('value')).jsonValue();
    console.log('facilityId', defaultSelectedFacilityId, this.facilityId);
    if (this.facilityId !== defaultSelectedFacilityId) {
      await this.switchToFacility(this.facilityId);
    }
    await this.gotoReportPage([
      'Medicare A Billing Log',
    ]);
    await this.page.waitForSelector('#clientsearchnumber', { timeout: this.regularTimeout });

    const fromYear = this.getFromYear();
    const month = this.getReportMonth();
    const toYear = this.getToYear();

    await this.page.select('select[name="ESOLmonthStart"]', month.toString());
    await this.page.select('select[name="ESOLyearStart"]', fromYear.toString());
    await this.page.select('select[name="ESOLmonthEnd"]', month.toString());
    await this.page.select('select[name="ESOLyearEnd"]', toYear.toString());
    // await this.page.$$eval('input[name="ESOLprintformat"]', checks => checks.forEach(c => c.checked = true));
    await this.page.click('#runButton');
    console.log('run report clicked');
    const reportPage = await this.getNewPageWhenLoaded();
    const data = await reportPage.evaluate(() => {
      function parseAmount(amount: string) {
        const parsed = parseFloat(amount.replace('$', '').replace(/,/g, ''))
        return isNaN(parsed) ? 0 : parsed;
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const result: any[] = [];
          const tables = document.querySelectorAll('table');
          tables.forEach((table, index) => {
            if (index < 3) {
              return;
            }
            for (const row of table.rows) {
              if (row.cells.length !== 29 || row.cells[0].className !== 'smallestData') {
                continue;
              }
              if (!row.cells[0].innerText || !row.cells[0].innerText.trim()) {
                continue;
              }
              const item = {
                from: row.cells[0].innerText,
                to: row.cells[1].innerText,
                hicOrMbi: row.cells[3].innerText,
                total: parseAmount(row.cells[19].innerText),
                remitDate: row.cells[20].innerText,
                recFromMCare: parseAmount(row.cells[21].innerText),
                coinsName: row.cells[22].innerText,
                coinsDays: row.cells[23].innerText,
                coins: parseAmount(row.cells[24].innerText),
                coinsAmountPaid: parseAmount(row.cells[25].innerText),
                coinsDue: parseAmount(row.cells[27].innerText)
              };
              result.push(item);
            }
            resolve(result);
          });
        }, 5000);
      });

    });
    await this.close();
    return data;
  }

  private getFromYear() {
    const to = new Date().setMonth(this.getReportMonth() - 1);
    const now = Date.now();
    let currentYear = new Date().getFullYear();
    if (to > now) {
      currentYear = currentYear - 1;
    }
    return currentYear - 3;
  }

  /**
   * Calculate report month from
   * month = fiscal year end - 4 month
   * @private
   */
  private getReportMonth() {
    if (this.reportMonth - 4 > 0) {
      return this.reportMonth - 4;
    }
    return 12 + this.reportMonth - 4;
  }

  private getToYear() {
    const month = this.getReportMonth();
    if (new Date().setMonth(month) > Date.now()) {
      return new Date().getFullYear() - 1;
    }
    return new Date().getFullYear();
  }
}
