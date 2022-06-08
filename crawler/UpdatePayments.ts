import { PccBaseCrawler } from './PccBaseCrawler';
import * as moment from 'moment';

export class UpdatePayments extends PccBaseCrawler {
  facilityId: string;
  depositId: string;
  csvPath: string;
  paymentsData: any;
  effectiveDate: Date;
  timeoutLimit: number;
  constructor(username: string, password: string, facilityId: string, depositId: string, paymentsData: any, effectiveDate: Date | string, csvPath: string) {
    super(username, password);
    console.log('init', username, password);
    this.name = 'UpdatePayments';
    this.facilityId = facilityId;
    this.depositId = depositId;
    this.csvPath = csvPath;
    this.paymentsData = paymentsData;
    this.effectiveDate = new Date(effectiveDate);
    this.timeoutLimit = 300;
  }
  async start(): Promise<any> {
    // login
    this.addLog('start');
    await this.enter();
    this.addLog('login ok');
    // select facility
    await this.switchToFacility(this.facilityId);
    this.addLog('switch facility ok ' + this.facilityId);
    // go to billing admin
    await this.goBiilingPage();
    let cashBatchesBtn = await this.page.$x(`//a[contains(text(),'Cash Receipt Batches')]`);
    this.addLog(`cache batch button found ${cashBatchesBtn.length > 0}`)
    await cashBatchesBtn[0].click();
    this.addLog('waiting for navigation');
    await this.page.waitForNavigation();
    const importId = Date.now().toString() + Math.round(Math.random()*100000);
    const batchName = `ePay Zunta Import-${this.depositId}-${importId}`;
    this.addLog('go to batches ok');
    const openImportModalBtn = await this.page.$x(`//input[@value='Cash Import']`);
    this.addLog('import modal button found ' + (openImportModalBtn.length > 0));
    await openImportModalBtn[0].click();
    const modal = await this.getNewPageWhenLoaded();
    this.addLog('open import ok');
    const importType = await modal.$x(`//select[@id="importConfigId"]`);
    await importType[0].type('ZTA - ePay');
    await importType[0].type('Test Epay - ePay');
    const fileInput = await modal.$x(`//input[@id="ESOLfile"]`);
    await fileInput[0].uploadFile(this.csvPath);
    // in case is dialog opens
    await this.sleep(1000);
    await modal.evaluate( () => {
      //@ts-ignore
      document.getElementById("batchName").value = ""
    })
    await modal.type('#batchName', batchName);
    await this.sleep(5000);
    modal.evaluate('iKeyPressed();');
    this.addLog('submit ok');
    await Promise.all([
      modal.waitForNavigation({ timeout: this.pageLoadTimeout }),
      this.page.waitForNavigation({ timeout: this.pageLoadTimeout })
    ]);
    this.addLog('modal reload ok');
    this.addLog('waiting for new batch');
    await this.waitForFn(async () => {
      const batch = await this.page.$x(`//a[contains(text(),'${batchName}')]`);
      return batch.length > 0
    });
    this.addLog('page reload ok');
    const trEl = (await (await (await this.page.$x(`//a[contains(text(),'${batchName}')]`))[0].$x('..'))[0].$x('..'))[0];
    const editBtn = (await trEl.$x(`//a[contains(text(),'edit')]`))[0]
    editBtn.click();
    await this.page.waitForNavigation();
    await this.waitForFn(async () => {
      return (await this.page.$x(`//a[contains(text(),'edit')]`)).length > 0
    })
    this.addLog('go to edit ok');
    const editTransactionsButtonsCount = (await this.page.$x(`//a[contains(text(),'edit')]`)).length;
    for (let i = 0; i < editTransactionsButtonsCount; i++) {
      if (i !== 0) await this.page.waitForNavigation();
      this.addLog('click to edit ' + this.page.isClosed());
      const btn = (await this.page.$x(`//a[contains(text(),'edit')]`))[i];
      await btn.click();
      const editModal = await this.getNewPageWhenLoaded();
      const teds = this.paymentsData.teds[i];
      this.addLog('teds ' + teds.length);
      if (teds.length === 0) {
        this.addLog('No Corresponding transaction effective date');
        continue;
      }
      // await this.page.waitForSelector('iframe#payerframe');
      const typeSelect = await editModal.$x(`//select[@id="cashReceiptType"]`);
      typeSelect[0].type('eCheck');
      console.log('type selected ok');
      await editModal.evaluate( () => {
        //@ts-ignore
        document.getElementById("effectiveDateInp").value = "";
        //@ts-ignore
        document.getElementById("effectiveDateInp_dummy").value = "";
        //@ts-ignore
        document.querySelector('input[name=cheque_number]').value = "";
      })
      await editModal.waitFor(500);
      await editModal.type('#effectiveDateInp', moment(this.effectiveDate).format('MM/DD/YYYY'));
      await editModal.type('#effectiveDateInp_dummy', moment(this.effectiveDate).format('MM/DD/YYYY'));
      await editModal.waitFor(500);
      await editModal.evaluate( () => {
        //@ts-ignore
        document.querySelector('input[name=cheque_number]').value = "";
      })
      await editModal.type('input[name=cheque_number]', `ZTA-${teds[0].paymentId}-${teds[0].paymentMethodType === 'ECHECK' ? 'eCheck' : 'cc'}-${teds[0].last4Digits}`);
      const methodRadio = await editModal.$x(`//input[@name="ESOLmethod" and @value="P"]`);
      methodRadio[0].click();
      this.addLog('method clicked ok');
      await editModal.waitFor(2000);
      const elementHandle = await editModal.$('#payerframe');
      const frame = await elementHandle.contentFrame();
      const applyRadio = await editModal.$x(`//input[@name="ESOLapply" and @value="M"]`);
      applyRadio[0].click();
      this.addLog('applied ok');
      if (teds[0].payerType === '0') {
        const option = await frame.$x(`//select[@name="payer_id"]/option[text() = "Private Pay"]`);
        const value = await (await option[0].getProperty('value')).jsonValue();
        await frame.select('select[name=payer_id]', value);
      } else {
        await frame.select('select[name=payer_id]', teds[0].payerType)
      }
      await editModal.waitFor(1000);
      const data = await frame.evaluate(() => {
        //@ts-ignore
        return {
          //@ts-ignore
          id: document.querySelector('select[name="payer_id"]').value,
          //@ts-ignore
          text: document.querySelector('select[name="payer_id"] option:checked').textContent
        };
      });
      if (data.id !== teds[0].payerType) {
        throw new Error('can not select payer type');
      }
      const manuallyApplyBtn = await editModal.$x(`//a[@href="javascript:applyPayment();"]`);
      manuallyApplyBtn[0].click();
      this.addLog('selecting manaully');
      const applyModal = await this.getNewPageWhenLoaded();
      this.addLog('apply modal opened');
      await this.setEffeciveDate(applyModal, teds);
      const saveBtn = await editModal.$('#sButton');
      this.addLog('saveBtn' + !!saveBtn);
      saveBtn.click();
      await this.waitUntilPageClosed(editModal);
      this.addLog('done');
    }
    await this.browser.close();
    return true;
  }

  protected async waitUntilPageClosed(page, ticks = 0) {
    if (page.isClosed()) {
      return;
    }
    if (ticks > this.timeoutLimit) {
      await this.browser.close();
      throw Error('Timeout. Process stuck and unable to proceed.');
    }
    await this.sleep(100);
    ticks++;
    return await this.waitUntilPageClosed(page, ticks);
  }

  private async setEffeciveDate(modal, oteds) {
    this.addLog('dates', oteds);
    const previousBalanceTeds = oteds.filter(ted => !ted.effectiveMonth && !ted.isCredit);
    const teds = oteds.filter(ted => !!ted.effectiveMonth || ted.isCredit);
    const allEffectiveDates = teds.map((ted) => (
      {
        date: ted.effectiveMonth ? moment().month(ted.effectiveMonth - 1).year(ted.effectiveYear) : moment(),
        amount: ted.amount,
        isCredit: ted.isCredit
      }
    ));
    const firstMonth = await this.getFirstMonth(modal);
    const futureDate = moment().format('MMM') === firstMonth ? moment().add(1, 'months').startOf('month') : moment().startOf('month');
    
    const effectiveDates = allEffectiveDates.filter(item => !item.date.endOf('month').isAfter(futureDate) && !item.isCredit);
    const futureEffectiveDates = allEffectiveDates.filter(item => item.date.endOf('month').isAfter(futureDate) || item.isCredit);
    this.addLog('futureEffectiveDates', futureEffectiveDates);
    const futureAmount = futureEffectiveDates.reduce((total, futureEffectiveDate) => total + parseFloat(futureEffectiveDate.amount), 0)
    this.addLog('effectiveDates', effectiveDates, futureAmount);
    const saveChanges = async () => {
      const saveBtn = await modal.$('#sButton');
      await saveBtn.click();
      await this.waitUntilPageClosed(modal);
    };
    
    let formattedDates = effectiveDates.map((effectiveDate) => ({
      ...effectiveDate,
      date: effectiveDate.date.format('MMM/YY'),
      realDate: effectiveDate.date
    }));
    this.addLog('formattedDate', formattedDates);
    modal.on('console',  (log) => this.addLog('internal', log._text));
    await modal.waitForSelector('#sButton');
    const clearAllBtn = await modal.$('#cButton');
    await clearAllBtn.click();
    await modal.waitForNavigation({ waitUntil: 'networkidle0'});
    const setToFuture = async (fAmount) => {
      await modal.evaluate(function(futureAmount) {
        // @ts-ignore
        const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(3) input[type=text]`);
        // @ts-ignore
        targetInput.focus();
        // @ts-ignore
        targetInput.value = futureAmount.toFixed(2);
        // @ts-ignore
        targetInput.onchange();
        // @ts-ignore
        targetInput.blur();
        console.log('after input');
      }, fAmount);
    }
    /* tslint:disable */
    if (futureAmount > 0) {
      await setToFuture(futureAmount);
    }
    this.addLog('formattedDates', formattedDates);
    let foundDates;
    while (formattedDates.length !== 0) {
      const findIndex = async () => {
        const founds = await modal.evaluate(function(formattedDates) {
          // @ts-ignore
          let stepFounds: any[] = [];
          const headerRows = document.querySelectorAll('table.aging tr:nth-child(1) td');
          for (let i = 0; i < headerRows.length; i++) {
            const td = headerRows[i];
            const innerHtml = td.innerHTML;
            formattedDates.forEach((formattedDate) => {
              if (innerHtml.includes(formattedDate.date)) {
                stepFounds.push({
                  index: i,
                  amount: formattedDate.amount,
                  date: formattedDate.date,
                  realDate: formattedDate.realDate
                });
              }
            })
          }
          if (stepFounds.length === 0) {
            // @ts-ignore
            document.querySelector('a[href="javascript:goNextPage();"]').click();
          }
          console.log('before input')
          return stepFounds;
        }, formattedDates);
        console.log('found', founds);
        if (founds.length === 0) {
          await modal.waitForNavigation({ waitUntil: 'networkidle0'});
          return await findIndex();
        }
        foundDates = founds;
      }
      await findIndex();
      await modal.evaluate(function(foundDates) {
        // @ts-ignore
        foundDates.forEach((foundDate) => {
          const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(${Number(foundDate.index) + 1}) input[type=text]`);
          // @ts-ignore
          targetInput.focus();
          // @ts-ignore
          targetInput.value = foundDate.amount;
          // @ts-ignore
          targetInput.onchange();
          // @ts-ignore
          targetInput.blur();
          console.log('after input');
        });
      }, foundDates);
      formattedDates = formattedDates.filter((formattedDate) => {
        return !foundDates.find((foundDate) => foundDate.date === formattedDate.date);
      });
    }
    /* tslint:enable */
    this.addLog('formattedDates loop finished')

    if (previousBalanceTeds.length > 0) {
      let prevTotal = previousBalanceTeds.reduce((total, ted) => getDecNumber(total) + getDecNumber(ted.amount), 0);
      const amounts = await this.getAmounts(modal);
      if (!amounts.current) {
        this.addLog('set future for prev no next', prevTotal);
        await setToFuture(prevTotal);
      } else if (amounts.current < prevTotal)  {
        await setToFuture(getDecNumber(prevTotal - amounts.current));
        prevTotal = prevTotal - getDecNumber(prevTotal - amounts.current);
        await this.applyPreviousBalance(modal, prevTotal, amounts.next >= prevTotal);
      } else  {
        await this.applyPreviousBalance(modal, prevTotal, amounts.next >= prevTotal);
      }
    }
    this.addLog('after eval');
    await modal.waitFor(3000);
    await saveChanges();
    this.addLog('setEffeciveDate end');
    return true;
  }

  private async applyPreviousBalance (modal, amount, strict = true) {
    this.addLog('apply previous balance', amount);
    amount = getDecNumber(amount);
    const date = moment(new Date()).subtract(17, 'months');
    this.addLog('date', date);
    const time = date.valueOf();
    let amounts = await this.getAmounts(modal);
    let next = amounts.next;
    while (next > 0 && amount > 0) {
      let foundDates: Array<any> = [];
      const findIndex = async () => {
        const founds = await modal.evaluate(function(time) {
          // @ts-ignore
          let stepFounds: any[] = [];
          const amountColumns = document.querySelectorAll('table.aging tr:nth-child(2) td');
          const dateColumns = document.querySelectorAll('table.aging tr:nth-child(1) td');
          for (let i = 3; i < amountColumns.length - 2; i++) {
            const td = amountColumns[i];
            const dateTd = dateColumns[i]; 
            const innerHtml = td.innerHTML;
            const matches = innerHtml.replace(/\,/g, '').match(/(\$\d+\.\d+)/ig) || [];
            const monthsMap = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11
            };
            const dateMatches = dateTd.innerHTML.match(new RegExp(`((${Object.keys(monthsMap).join('|')})\/[0-9]+)`, 'g')) || []
            this.addLog('reg', `((${Object.keys(monthsMap).join('|')})\/[0-9]+)`);
            this.addLog('innerHtml', dateTd.innerHTML, innerHtml);
            const amount = parseFloat(matches[0].substr(1))
            const dateStr = dateMatches[0].split('\/');
            const date = new Date();
            date.setMonth(monthsMap[dateStr[0]]);
            date.setFullYear(2000 + parseInt(dateStr[1]));
            date.setDate(28);
            this.addLog('date', date.toLocaleDateString(), new Date(time).toLocaleDateString())
            if (date.getTime() > time) {
              continue;
            }
            this.addLog('dateStr', dateStr);
            this.addLog('amount', amount);
            if (amount > 0) {
              stepFounds.push({ index: i, amount });
            }
          }
          if (stepFounds.length === 0) {
            // @ts-ignore
            document.querySelector('a[href="javascript:goNextPage();"]').click();
          }
          this.addLog('before input')
          return stepFounds;
        }, strict ? time : Date.now());
        console.log('previous balance found', founds);
        if (founds.length === 0) {
          await modal.waitForNavigation({ waitUntil: 'networkidle0'});
          return await findIndex();
        }
        foundDates = founds;
      }
      await findIndex();
      const applyableDates: any[] = [];
      for (let i = 0; i < foundDates.length && amount > 0; i++) {
        if (amount - foundDates[i].amount > 0) {
          applyableDates.push(foundDates[i])
          amount -= getDecNumber(foundDates[i].amount)
        } else {
          applyableDates.push({ index: foundDates[i].index, amount });
          amount = 0
        }
      }
      this.addLog('amount left', amount);
      await modal.evaluate(function(applyableDates) {
        // @ts-ignore
        applyableDates.forEach((data) => {
          const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(${Number(data.index) + 1}) input[type=text]`);
          // @ts-ignore
          targetInput.focus();
          // @ts-ignore
          targetInput.value = data.amount;
          // @ts-ignore
          targetInput.onchange();
          // @ts-ignore
          targetInput.blur();
          console.log('after input');
        });
      }, applyableDates);
      let amounts = await this.getAmounts(modal);
      next = amounts.next;
    }
    this.addLog('Previous balance finished');
  }

  private getAmounts(modal) {
    return modal.evaluate(function() {
      const amountColumns = document.querySelectorAll('table.aging tr:nth-child(2) td');
      return {
        //@ts-ignore
        current: parseFloat(amountColumns[1].innerText.replace(/,|\$/g, '')),
        //@ts-ignore
        next: parseFloat(amountColumns[amountColumns.length - 2].innerText.replace(/,|\$/g, ''))
      }
    });
  }

  private async getFirstMonth(modal) {
    const firstDate = await modal.evaluate(function() {
      const dateColumns = document.querySelectorAll('table.aging tr:nth-child(1) td');
      // @ts-ignore
      return dateColumns[3].innerText.replace('Current\n', '')
    });
    const parts = firstDate.split('/')
    return parts[0];
  }
}

function getDecNumber(num: number) {
  if (isNaN(num)) {
    return 0;
  }
  const p = 100;
  return Math.round( num * p ) / p;
}
