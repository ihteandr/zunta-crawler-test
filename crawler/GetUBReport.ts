import { PccBaseCrawler } from "./PccBaseCrawler";

export class GetUBReport extends PccBaseCrawler {
    rowNum: number;
    reportCallback: Function;
    facilityOriginId: string;
    constructor (username: string, password: string, facilityOriginId: string, rowNum: number, reportCallback: Function) {
        super(username, password);
        this.rowNum = rowNum;
        this.facilityOriginId = facilityOriginId;
        this.reportCallback = reportCallback;
        this.name = 'FetchUBReport'
    }
    async start (): Promise<any> {
      await this.enter();
      await this.switchToFacility(this.facilityOriginId); 
      await this.goBiilingPage();
      const ubTd = await this.page.$x(`//td[contains(text(), 'UB Claims:')]`);
      console.log('ubtd', !!ubTd[0]);
      const ubRow = await ubTd[0].$x('..');
      console.log('ubrow', !!ubRow[0]);
      const ubLink = (await ubRow[0].$x(`//a[contains(text(), 'Edit / Submit')]`))[0];
      await ubLink.click();
      
      this.addLog('go to ub report');
      await this.page.waitForNavigation();
      this.addLog('on ub report page');
      this.addLog('selecting all');
      this.page.select('select[name=ESOLstatus]', "")
      await this.page.waitForNavigation({ timeout: this.pageLoadTimeout });
      this.addLog('selected all');
      let missingReportCount = 0;
      while (true) {
        await this.goCorrectPage();
        const td = await this.page.evaluate((rowNum) => {
          const tds = [...document.querySelectorAll('td')];
          return tds.find(td => {
              return td.textContent?.trim() == rowNum.toString()
          })
        }, this.rowNum);
        if (!td) {
          missingReportCount++;
          this.addLog('row not found', this.rowNum, 'missing reports', missingReportCount);
          if (missingReportCount >= 50) {
            break;
          } else {
            this.rowNum++;
            continue;
          }
        }

        const report837SpanClicked = await this.page.evaluate((rowNum) => {
          const tds = [...document.querySelectorAll('td')];
          const td:any = tds.find(td => {
              return td.textContent?.trim() == rowNum.toString()
          });
          const els = [...td.parentNode.querySelectorAll('span')];

          const el = els.find(el => {
              return el.textContent?.trim() == '837'
          })
          if (!el) {
            return false;
          }
          
          el.style.color = 'green';
          el.click()
          return true;
        }, this.rowNum);
        if (report837SpanClicked) {
          const modal = await this.getNewPageWhenLoaded();
          const buffer = await this.downloadReport(modal);
          this.reportCallback({
            rowNum: this.rowNum,
            buffer
          })
          missingReportCount = 0
        } else {
          const reportExportSpanClicked = await this.page.evaluate((rowNum) => {
            const tds = [...document.querySelectorAll('td')];
            const td:any = tds.find(td => {
                return td.textContent?.trim() == rowNum.toString()
            });
            const els = [...td.parentNode.querySelectorAll('a')];
  
            const el = els.find(el => {
                return el.textContent?.trim() == 'export'
            })
            if (!el) {
              return false;
            }
            el.style.color = 'green';
            el.click()
            return true;
          }, this.rowNum);
          if (reportExportSpanClicked) {
            const modal = await this.getNewPageWhenLoaded();
            const buffer = await this.downloadReportFromExport(modal);
            this.reportCallback({
              rowNum: this.rowNum,
              buffer
            }); 
            missingReportCount = 0   
          } else {
            this.addLog('it is not a 837 report');
          }
        }
        this.addLog('rowNum', this.rowNum)
        this.rowNum++;
      }
      await this.browser.close();
    }
    async goCorrectPage () {
      const firstRowNum = parseInt(await (await this.page.$('form[name=frmData]>div:last-child>div>table tbody tr:last-child td:nth-child(2)')).evaluate(e => e.textContent.trim()));
      const lastRowNum = parseInt(await (await this.page.$('form[name=frmData]>div:last-child>div>table tbody tr:nth-child(2) td:nth-child(2)')).evaluate(e => e.textContent.trim()));
      const navigationBar = await this.page.$('form[name=frmData]>div:last-child>table:last-child');
      if (firstRowNum > this.rowNum) {
        const nextLink = (await navigationBar.$x(`//a[contains(text(), 'Next')]`))[0]
        if (nextLink) {
          console.log('go next');
          await nextLink.click();
          await this.page.waitForNavigation();
          await this.goCorrectPage();
        }
      }
      if (lastRowNum < this.rowNum) {
        const prevLink = (await navigationBar.$x(`//a[contains(text(), 'Prev')]`))[0]
        if (prevLink) {
          console.log('go prev')
          await prevLink.click();
          await this.page.waitForNavigation();
        }
      }
    }
    async downloadReportFromExport (modal) {
      const exportButton = await modal.$('#sButton');
      this.addLog('opening export modal');
      await exportButton.click();
      this.addLog('waiting for export modal');
      const exportModal = await this.getNewPageWhenLoaded();
      this.addLog('export modal opened');
      const sKeyPressedFunction = await exportModal.evaluate(() => {
        //@ts-ignore
        return sKeyPressed.toString()
      });
      const sKeyPressedFunctionText = sKeyPressedFunction.replace(/[\s\n\r ]/g, '');
      const uri = sKeyPressedFunctionText.substring(
        sKeyPressedFunctionText.indexOf('frmData.action="') + 'frmData.action="'.length,
        sKeyPressedFunctionText.indexOf('";frmData.submit();')
      );
      const pageUrl = this.page.url();
      const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
      const host = origin.substr(8);
      exportModal.evaluate(`(async () => {
        console.log('data', document.frmData);
        const form = document.frmData;
        form.submit = function () { return false; }
        form.onsubmit = function (event) { event.preventDefault(); event.stopPropagation(); return false; }
        return await fetch('${origin}${uri}', {
                method: "POST",
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    Connection: 'Keep-Alive',
                    Host: '${host}',
                    Origin: '${origin}',
                    'Accept-Language': 'en-US',
                    'Upgrade-Insecure-Requests': 1,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
                },
                credentials: "include",
                body: new FormData(form)
            }).then(res => {
                return res.body;
            }).then(stream => {
                console.log('stream', stream);
                const reader = stream.getReader();
                let charsReceived = 0;
                let result = [];
                return reader.read().then(function processText({ done, value }) {
                    if (done) {
                        return new Promise((resolve) => {
                            const blob = new Blob(result, {type: 'text/plain'});
                            let reader = new FileReader();
                            reader.readAsBinaryString(blob);
                            reader.onload = function() {
                                window.zuntaData = reader.result;
                                console.log('reader', reader.result)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err));
        })()`);
        await exportModal.waitForFunction(() => {
          //@ts-ignore
          return !!window.zuntaData
        }, { timeout: 1 * 60 * 1000 })
        const text = await exportModal.evaluate(() => {
          //@ts-ignore
            return window.zuntaData
        })
        exportModal.close();
        await this.waitUntilPageClosed(exportModal);
        return Buffer.from(text, 'utf8');
    }
    async downloadReport (modal) {
      const pageUrl = this.page.url();
      const origin = pageUrl.match(/(https*:\/\/[^\/]+)/)[0];
      const host = origin.substr(8);
      const ESOLfileId = await modal.evaluate(() => {
        const field = document.querySelector('input[name=ESOLfileId]');
        //@ts-ignore
        return field.value;
      })
      modal.evaluate(`(async () => {
        console.log('data', document.frmData);
        const form = document.frmData;
        form.submit = function () { return false; }
        form.onsubmit = function (event) { event.preventDefault(); event.stopPropagation(); return false; }
        return await fetch('${origin}/tools/edi/exportsave.jsp?ESOL837Link=Y&ESOLfileId=${ESOLfileId}', {
                method: "POST",
                headers: {
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    Connection: 'Keep-Alive',
                    Host: '${host}',
                    Origin: '${origin}',
                    'Accept-Language': 'en-US',
                    'Upgrade-Insecure-Requests': 1,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
                },
                credentials: "include",
                body: new FormData(form)
            }).then(res => {
                return res.body;
            }).then(stream => {
                console.log('stream', stream);
                const reader = stream.getReader();
                let charsReceived = 0;
                let result = [];
                return reader.read().then(function processText({ done, value }) {
                    if (done) {
                        return new Promise((resolve) => {
                            const blob = new Blob(result, {type: 'text/plain'});
                            let reader = new FileReader();
                            reader.readAsBinaryString(blob);
                            reader.onload = function() {
                                window.zuntaData = reader.result;
                                console.log('reader', reader.result)
                                resolve(reader.result);
                            };
                        })
                    }
                    result = result.concat(value);
                    
                    return reader.read().then(processText);
                });
            }).catch(err => console.error(err));
        })()`);
        await modal.waitForFunction(() => {
          //@ts-ignore
          return !!window.zuntaData
        }, { timeout: 1 * 60 * 1000 })
        const text = await modal.evaluate(() => {
          //@ts-ignore
            return window.zuntaData
        })
        // console.log('text', text);
        modal.close();
        await this.waitUntilPageClosed(modal);
        return Buffer.from(text, 'utf8');
    }
}
