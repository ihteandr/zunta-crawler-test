import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetAllFacilities extends PccBaseCrawler {
    constructor (username: string, password: string) {
        super(username, password);
    }
    async start (): Promise<any> {
        await this.enter();
        await this.page.waitFor(2000)
        await this.page.click('#pccFacLink');
        await this.page.waitForSelector('#optionList', { timeout: this.regularTimeout });
        const links = await this.page.$$('#optionList li a');
        let shouldGetOnlyDefault = false
        console.log('links', links.length)
        if (links.length === 0) {
            shouldGetOnlyDefault = true
        }
        if (shouldGetOnlyDefault) {
            const link = await this.page.$('#pccFacLink', { timeout: this.regularTimeout });
            const idInput = await this.page.$('input[name="current_fac_id"]', { timeout: this.regularTimeout });
            const name = await (await link.getProperty('title')).jsonValue();
            const id = await (await idInput.getProperty('value')).jsonValue();
            await this.close();
            return [{
                name,
                id
            }]
        }
        await this.page.waitForSelector('#pccUserMenu');
        const navLinks = await this.page.$$('#pccUserMenu li a');
        let editProfilUrl;
        for (let i = 0; i < navLinks.length; i++) {
            const text = await (await navLinks[i].getProperty('textContent')).jsonValue();
            if (text.trim() === 'Edit Profile') {
                const href = await (await navLinks[i].getProperty('href')).jsonValue()
                const uri = href.substring(href.indexOf('\'') + 1, href.lastIndexOf('\''));
                const pageUrl = this.page.url();
                const urlHost = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
                editProfilUrl = `${urlHost}${uri}`;
                break;
            }
        }
        await this.page.goto(editProfilUrl, {
            waitUntil: 'networkidle0', timeout: this.pageLoadTimeout
        });
        await this.page.waitForSelector('#id-ESOLfac_id', { timeout: this.regularTimeout });
        const listItems = await this.page.$$('#id-ESOLfac_id option');
        const facilities: any[] = [];
        for (let i = 0; i < listItems.length; i++) {
            const name = await (await listItems[i].getProperty('textContent')).jsonValue();
            const id = await (await listItems[i].getProperty('value')).jsonValue();
            facilities.push({
                name,
                id
            });
        }
        await this.close();
        return facilities;
    }
}
