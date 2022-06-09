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
exports.DeleteBatch = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class DeleteBatch extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password, facilityId, batchWillowId) {
        super(username, password);
        console.log('init', username, password);
        this.facilityId = facilityId;
        this.batchWillowId = batchWillowId;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // login
            console.log('start');
            yield this.enter();
            console.log('login ok');
            // select facility
            yield this.switchToFacility(this.facilityId);
            console.log('switch facility ok');
            // go to billing admin
            yield this.page.waitForSelector('#QTF_AdminTab');
            yield this.page.hover('#QTF_AdminTab');
            const billingBtn = yield this.page.$x(`//a[contains(text(),'Billing')]`);
            console.log('billingBtn', billingBtn);
            if (billingBtn.length > 1) {
                yield billingBtn[1].click();
            }
            else {
                yield billingBtn[0].click();
            }
            yield this.page.waitForNavigation({ waitUntil: 'networkidle2' });
            console.log('go to billing ok');
            let cashBatchesBtn = yield this.page.$x(`//a[contains(text(),'Cash Receipt Batches')]`);
            console.log('cashBatchesBtn', cashBatchesBtn, this.page.url());
            yield cashBatchesBtn[0].click();
            yield this.page.waitForNavigation();
            const batches = (yield this.page.$x(`//a[contains(text(),'ePay Zunta Import-${this.batchWillowId}')]`));
            for (const batch of batches) {
                batch.click();
                const modal = yield this.getNewPageWhenLoaded();
                modal.evaluate('dKeyPressed();');
                yield this.waitUntilPageClosed(modal);
                console.log('batch deleted');
            }
            yield this.browser.close();
            return true;
        });
    }
}
exports.DeleteBatch = DeleteBatch;
//# sourceMappingURL=DeleteBatch.js.map