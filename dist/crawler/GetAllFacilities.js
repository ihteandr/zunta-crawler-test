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
exports.GetAllFacilities = void 0;
const PccBaseCrawler_1 = require("./PccBaseCrawler");
class GetAllFacilities extends PccBaseCrawler_1.PccBaseCrawler {
    constructor(username, password) {
        super(username, password);
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.enter();
            yield this.page.waitFor(2000);
            yield this.page.click('#pccFacLink');
            yield this.page.waitForSelector('#optionList', { timeout: this.regularTimeout });
            const links = yield this.page.$$('#optionList li a');
            let shouldGetOnlyDefault = false;
            console.log('links', links.length);
            if (links.length === 0) {
                shouldGetOnlyDefault = true;
            }
            if (shouldGetOnlyDefault) {
                const link = yield this.page.$('#pccFacLink', { timeout: this.regularTimeout });
                const idInput = yield this.page.$('input[name="current_fac_id"]', { timeout: this.regularTimeout });
                const name = yield (yield link.getProperty('title')).jsonValue();
                const id = yield (yield idInput.getProperty('value')).jsonValue();
                yield this.close();
                return [{
                        name,
                        id
                    }];
            }
            yield this.page.waitForSelector('#pccUserMenu');
            const navLinks = yield this.page.$$('#pccUserMenu li a');
            let editProfilUrl;
            for (let i = 0; i < navLinks.length; i++) {
                const text = yield (yield navLinks[i].getProperty('textContent')).jsonValue();
                if (text.trim() === 'Edit Profile') {
                    const href = yield (yield navLinks[i].getProperty('href')).jsonValue();
                    const uri = href.substring(href.indexOf('\'') + 1, href.lastIndexOf('\''));
                    const pageUrl = this.page.url();
                    const urlHost = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
                    editProfilUrl = `${urlHost}${uri}`;
                    break;
                }
            }
            yield this.page.goto(editProfilUrl, {
                waitUntil: 'networkidle0', timeout: this.pageLoadTimeout
            });
            yield this.page.waitForSelector('#id-ESOLfac_id', { timeout: this.regularTimeout });
            const listItems = yield this.page.$$('#id-ESOLfac_id option');
            const facilities = [];
            for (let i = 0; i < listItems.length; i++) {
                const name = yield (yield listItems[i].getProperty('textContent')).jsonValue();
                const id = yield (yield listItems[i].getProperty('value')).jsonValue();
                facilities.push({
                    name,
                    id
                });
            }
            yield this.close();
            return facilities;
        });
    }
}
exports.GetAllFacilities = GetAllFacilities;
//# sourceMappingURL=GetAllFacilities.js.map