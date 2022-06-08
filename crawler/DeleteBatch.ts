import { PccBaseCrawler } from './PccBaseCrawler';

export class DeleteBatch extends PccBaseCrawler {
    facilityId: string;
    batchWillowId: string;
    constructor(username: string, password: string, facilityId: string, batchWillowId: string) {
        super(username, password);
        console.log('init', username, password);
        this.facilityId = facilityId;
        this.batchWillowId = batchWillowId;
    }

    async start(): Promise<any> {
        // login
        console.log('start');
        await this.enter();
        console.log('login ok');
        // select facility
        await this.switchToFacility(this.facilityId);
        console.log('switch facility ok');
        // go to billing admin
        await this.page.waitForSelector('#QTF_AdminTab');
        await this.page.hover('#QTF_AdminTab');
        const billingBtn = await this.page.$x(`//a[contains(text(),'Billing')]`);
        console.log('billingBtn', billingBtn)
        if (billingBtn.length > 1) {
            await billingBtn[1].click();
        } else {
            await billingBtn[0].click();
        }
        await this.page.waitForNavigation({waitUntil: 'networkidle2'});
        console.log('go to billing ok');

        let cashBatchesBtn = await this.page.$x(`//a[contains(text(),'Cash Receipt Batches')]`);

        console.log('cashBatchesBtn', cashBatchesBtn, this.page.url());
        await cashBatchesBtn[0].click();
        await this.page.waitForNavigation();
        const batches = (await this.page.$x(`//a[contains(text(),'ePay Zunta Import-${this.batchWillowId}')]`));
        for (const batch of batches) {
            batch.click();
            const modal = await this.getNewPageWhenLoaded();
            modal.evaluate('dKeyPressed();');
            await this.waitUntilPageClosed(modal);
            console.log('batch deleted');
        }
        await this.browser.close();
        return true;
    }
}