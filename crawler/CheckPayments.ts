import { PccBaseCrawler } from './PccBaseCrawler';
import * as moment from 'moment';

export class CheckPayments extends PccBaseCrawler {
  facilityId: string;
  paymentsData: any;
  effectiveDate: Date;
  syncedPayments: number[] = [];
  constructor(username: string, password: string, facilityId: string, paymentsData: any, effectiveDate: Date | string) {
    super(username, password);
    console.log('init', username, password);
    this.facilityId = facilityId;
    this.name = 'CheckPayments';
    this.paymentsData = paymentsData;
    console.log('paymentsData', paymentsData);
    this.effectiveDate = new Date(effectiveDate);
  }
  async start(): Promise<any> {
    // login
    this.addLog('start');
    await this.enter();
    this.addLog('login ok');
    // select facility
    await this.switchToFacility(this.facilityId);
    this.addLog('switch facility ok');
    // go to billing admin
    await this.goBiilingPage();
    let cashBatchesBtn = await this.page.$x(`//a[contains(text(),'Cash Receipt Batches')]`);

    await cashBatchesBtn[0].click();
    await this.page.waitForNavigation();
    const batchNamePattern = `ePay Zunta Import-`;
    this.addLog('go to batches ok');
    this.addLog('page reload ok');
    const rows = await this.page.$x(`//a[contains(text(),'${batchNamePattern}')]`);
    const batchesNames: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      batchesNames.push(await rows[i].evaluate(el => el.textContent));
    }
    this.addLog('batchesNames', batchesNames)
    for (let i = 0; i < batchesNames.length; i++) {
      if (this.paymentsData.teds.length === 0) break;
      this.addLog(`go to batch ${batchesNames[i]}`)
      await this.waitForFn(async () => {
        return (await this.page.$x(`//a[contains(text(),'${batchesNames[i]}')]`)).length > 0
      })
      const trEl = (await (await (await this.page.$x(`//a[contains(text(),'${batchesNames[i]}')]`))[0].$x('..'))[0].$x('..'))[0];
      const editBtn = (await trEl.$x(`//a[contains(text(),'edit')]`))[0]
      editBtn.click();
      await this.page.waitForNavigation();
      await this.waitForFn(async () => {
        return (await this.page.$x(`//a[contains(text(),'edit')]`)).length > 0
      });
      const editTransactionsButtonsCount = (await this.page.$x(`//a[contains(text(),'edit')]`)).length;
      this.addLog('editTransactionsButtonsCount', editTransactionsButtonsCount);
      for (let i = 0; i < editTransactionsButtonsCount; i++) {
        this.addLog('click to edit', this.page.isClosed(), i);
        const btn = (await this.page.$x(`//a[contains(text(),'edit')]`))[i];
        await btn.click();
        const editModal = await this.getNewPageWhenLoaded();
        const chequeNumber = await editModal.evaluate( () => {
          //@ts-ignore
          return document.querySelector('input[name=cheque_number]').value;
        })
        const paymentId = parseInt(chequeNumber.split('-')[1]);
        const elementHandle = await editModal.$('#payerframe');
        const frame = await elementHandle.contentFrame();
        await this.waitForFn(async () => {
          return !!(await frame.$('select[name="payer_id"]'))
        })
        const data = await frame.evaluate(() => {
          //@ts-ignore
          return {
            //@ts-ignore
            id: document.querySelector('select[name="payer_id"]').value,
            //@ts-ignore
            text: document.querySelector('select[name="payer_id"] option:checked').textContent
          };
        });
        let payerTypeIds: string[] = [];
        if (data.text.trim() === 'Private Pay') {
          payerTypeIds = ['0', data.id];
        } else {
          payerTypeIds = [data.id];
        }
        this.addLog('this.paymentsData.teds', this.paymentsData.teds);
        
        const getCurrentTeds = () => {
          const currentTeds:any[] = [];
          this.paymentsData.teds.forEach((teds) => {
            teds.forEach((ted) => {
              console.log(payerTypeIds, ted.payerType, paymentId, ted.paymentId, ted.paymentId === paymentId && payerTypeIds.includes(ted.payerType.toString()));
              if (ted.paymentId === paymentId && payerTypeIds.includes(ted.payerType.toString())) {
                currentTeds.push(ted);
              }
            });
          });
          return currentTeds;  
        }
        const teds = getCurrentTeds();
        // console.log('paymentId', paymentId, teds, payerTypeIds, data);
        if (!teds.length) {
          this.addLog('No Corresponding payment date');
          const cancelBtn = await editModal.$('#xButton');
          await cancelBtn.click();
          await this.waitUntilPageClosed(editModal);
          continue;
        }
        const manuallyApplyBtn = await editModal.$x(`//a[@href="javascript:applyPayment();"]`);
        manuallyApplyBtn[0].click();
        this.addLog('selecting manaully');
        const applyModal = await this.getNewPageWhenLoaded();
        this.addLog('apply modal opened');
        const isSync = await this.checkEffeciveDate(applyModal, teds);
        const cancelBtn = await editModal.$('#xButton');
        await cancelBtn.click();
        await this.waitUntilPageClosed(editModal);
        if (isSync) {
          for (let i = 0; i < this.paymentsData.teds.length; i++) {
            this.paymentsData.teds[i] = this.paymentsData.teds[i].filter((ted) => {
              return ted.paymentId !== paymentId || (ted.paymentId === paymentId && !payerTypeIds.includes(ted.payerType))
            })
          }
          const paymentTeds:any[] = [];
          this.paymentsData.teds.filter((teds) => {
            teds.forEach((ted) => {
              if (ted.paymentId === paymentId) {
                paymentTeds.push(ted);
              }
            })
          });
          if (paymentTeds.length === 0) {
            this.syncedPayments.push(paymentId);
          }
        }
        this.addLog('done');
      }
      await (await this.page.$x(`//input[@value="Back"]`))[0].click();
      await this.page.waitForNavigation();
    }
    this.addLog('synced payments', this.syncedPayments);
    
    this.browser.close();
    return this.syncedPayments;
  }

  private async checkEffeciveDate(modal, oteds) {
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
    const cancelChanges = async () => {
      modal.close();
      await this.waitUntilPageClosed(modal);
    };
    let isSync = true;
    let formattedDates = effectiveDates.map((effectiveDate) => ({
      ...effectiveDate,
      date: effectiveDate.date.format('MMM/YY'),
      realDate: effectiveDate.date
    }));
    this.addLog('formattedDate', formattedDates);
    modal.on('console',  (log) => this.addLog('internal', log._text));
    const checkToFuture = async (fAmount) => {
      return await modal.evaluate(function(futureAmount) {
        // @ts-ignore
        const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(3) input[type=text]`);
        // @ts-ignore
        return targetInput.value === futureAmount.toFixed(2)
      }, fAmount);
    }
    /* tslint:disable */
    if (futureAmount > 0) {
      if (!(await checkToFuture(futureAmount))) {
        await cancelChanges()
        return false
      }
    }
    let foundDates;
    while (formattedDates.length !== 0) {
      this.addLog('formattedDates', formattedDates);
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
        this.addLog('found', founds);
        if (founds.length === 0) {
          await modal.waitForNavigation({ waitUntil: 'networkidle0'});
          return await findIndex();
        }
        foundDates = founds;
      }
      await findIndex();
      this.addLog('foundDates', foundDates);
      const isRowSync = await modal.evaluate(function(foundDates) {
        // @ts-ignore
        for (let i = 0; i < foundDates.length; i++) {
          const foundDate = foundDates[i];
          const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(${Number(foundDate.index) + 1}) input[type=text]`);
          console.log(targetInput)
          // @ts-ignore
          targetInput.focus();
          // @ts-ignore
          console.log(parseFloat(targetInput.value) + ' ' + parseFloat(foundDate.amount))
          // @ts-ignore
          if (parseFloat(targetInput.value) != parseFloat(foundDate.amount)) {
            return false
          }
        }
        return true;
      }, foundDates);
      this.addLog('isRowSync', isRowSync);
      if (!isRowSync) {
        return false;
      }
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
        isSync = await checkToFuture(prevTotal);
      } else if (amounts.current < prevTotal)  {
        prevTotal = prevTotal - getDecNumber(prevTotal - amounts.current);
        isSync = (await checkToFuture(getDecNumber(prevTotal - amounts.current))) && await this.checkPreviousBalance(modal, prevTotal, amounts.next >= prevTotal);
      } else  {
        isSync = await this.checkPreviousBalance(modal, prevTotal, amounts.next >= prevTotal);
      }
    }
    this.addLog('after check');
    await cancelChanges();
    this.addLog('checkEffeciveDate end');
    return isSync;
  }

  private async checkPreviousBalance (modal, amount, strict = true): Promise<boolean> {
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
            console.log('reg', `((${Object.keys(monthsMap).join('|')})\/[0-9]+)`);
            console.log('innerHtml', dateTd.innerHTML, innerHtml);
            const amount = parseFloat(matches[0].substr(1))
            const dateStr = dateMatches[0].split('\/');
            const date = new Date();
            date.setMonth(monthsMap[dateStr[0]]);
            date.setFullYear(2000 + parseInt(dateStr[1]));
            date.setDate(28);
            console.log('date', date.toLocaleDateString(), new Date(time).toLocaleDateString())
            if (date.getTime() > time) {
              continue;
            }
            console.log('dateStr', dateStr);
            console.log('amount', amount);
            if (amount > 0) {
              stepFounds.push({ index: i, amount });
            }
          }
          if (stepFounds.length === 0) {
            // @ts-ignore
            document.querySelector('a[href="javascript:goNextPage();"]').click();
          }
          console.log('before input')
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
      const isSync = await modal.evaluate(function(applyableDates) {
        for (let i = 0; i < applyableDates.length; i++) {
          const data = applyableDates[i]
          const targetInput = document.querySelector(`table.aging tr:nth-child(3) td:nth-child(${Number(data.index) + 1}) input[type=text]`);
          // @ts-ignore
          targetInput.focus();
          // @ts-ignore
          if (parseFloat(targetInput.value) != parseFloat(data.amount)){
            return false;
          }
          
        }
        return true;
      }, applyableDates);
      if (!isSync) {
        return false;
      }
      let amounts = await this.getAmounts(modal);
      next = amounts.next;
    }
    this.addLog('Previous balance finished');
    return true;
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
