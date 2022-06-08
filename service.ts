import * as fs from 'fs';
import * as path from 'path';
import { format } from '@fast-csv/format';
import { GetFacilitiesWithDetails } from './crawler/GetFacilitiesWithDetails';
import { GetFacilitiesResidentContactTypes } from './crawler/GetFacilitiesResidentContactTypes';
import { GetFacilitiesPayerTypes } from './crawler/GetFacilitiesPayerTypes';
import * as config from 'config';
import * as request from 'request';
import { GetFacilitiesResidentsContactsReports } from './crawler/GetFacilitiesResidentsContactsReports';
import { GetFacilitiesTransactionReports } from './crawler/GetFacilitiesTransactionReports';
import { GetFacilityMedicaidDetailsReports } from './crawler/GetFacilityMedicaidDetailsReport';
import { GetFacilityMedicareABillingLog } from './crawler/GetFacilityMedicaidABillingLog';
import { UpdatePayments } from './crawler/UpdatePayments';
import { CheckPayments } from './crawler/CheckPayments';
import { DeleteBatch } from "./crawler/DeleteBatch";
import * as os from 'os';
import * as uuid from 'uuid';
import * as Redis from 'ioredis';
import * as axios from 'axios';
import * as puppeteer from 'puppeteer';
import { GetUBReport } from './crawler/GetUBReport';
import { Pool } from './helpers/utils/Pool';
const applicationConfigs = config.get('application');
const serverConfigs = config.get('server');
const redisConfig = config.get('redis');



export class AppService {

    async startFetchingFacilitiesWithDetails(chainId: number, facilityIds: string[], username: string, password: string, dataOptions: any) {
        console.log('start crawl facilities details');
        let possibleErrorMessage = '';
        try {
            console.log('crawl facilities');
            possibleErrorMessage = 'Fail Fetching Facilities Details';
            const facilityDetailsCrawler = new GetFacilitiesWithDetails(username, password, facilityIds);
            const facilityDetails = await facilityDetailsCrawler.repeatedlyStart();
            console.log('crawl resident contact types 1');
            possibleErrorMessage = 'Fail Fetching Resident Contacts';
            const residentContactTypesCrawler = new GetFacilitiesResidentContactTypes(username, password, facilityIds);
            const residentContactTypesMap = await residentContactTypesCrawler.repeatedlyStart();
            console.log('crawl payerTypes');
            possibleErrorMessage = 'Fail Fetching Payer Types';
            const payerTypesCrawler = new GetFacilitiesPayerTypes(username, password, facilityIds);
            const payerTypesMap = await payerTypesCrawler.repeatedlyStart();
            const options = {
                url: `${applicationConfigs.management}/facilities/importFacilityDetails/${chainId}`,
                method: 'POST',
                json: true,
                body: {
                    username,
                    password,
                    facilitiesList: facilityDetails,
                    payerInfoMap: payerTypesMap,
                    residentContactTypesMap,
                    ...dataOptions,
                },
            };
            await this.sendResponse(options);
        } catch (e) {
            console.log('error', e.message)
            await this.failActivity(dataOptions.activityId, {
                error: possibleErrorMessage || e.message,
            });
        }
    }

    async startFetchFacilityUpdates(
        chainId: number,
        updateFacilityDetails: boolean,
        updateFacilityResidentContactTypes: boolean,
        updateFacilityPayerTypes: boolean,
        updateResidents: boolean,
        facilityId: number,
        facilityOriginId: string,
        username: string,
        password: string,
        activityId: number,
        params: any
    ): Promise<void> {
        let possibleErrorMessage = '';
        try {
            let facilityDetails = null;
            if (updateFacilityDetails) {
                possibleErrorMessage = 'Fail Fetch Facilities Details';
                console.log('crawl facilities', username, password, [facilityOriginId]);
                const facilityDetailsCrawler = new GetFacilitiesWithDetails(username, password, [facilityOriginId]);
                facilityDetails = await facilityDetailsCrawler.repeatedlyStart();
            }
            let residentContactTypesMap = null;
            if (updateFacilityResidentContactTypes) {
                console.log('crawl resident contact types');
                possibleErrorMessage = 'Fail Fetch Resident Contact Types';
                const residentContactTypesCrawler = new GetFacilitiesResidentContactTypes(username, password, [facilityOriginId]);
                residentContactTypesMap = await residentContactTypesCrawler.repeatedlyStart();
            }
            let payerTypesMap = null;
            if (updateFacilityPayerTypes) {
                console.log('crawl payerTypes');
                possibleErrorMessage = 'Fail Fetch Facilities Payer Types';
                const payerTypesCrawler = new GetFacilitiesPayerTypes(username, password, [facilityOriginId]);
                payerTypesMap = await payerTypesCrawler.repeatedlyStart();
            }
            let residentContactsReport = null;
            if (updateResidents) {
                console.log('crawl residents');
                possibleErrorMessage = 'Fail Fetch Resident Contact';
                const residentContactsReportCrawler = new GetFacilitiesResidentsContactsReports(username, password, [facilityOriginId]);
                residentContactsReport = await residentContactsReportCrawler.repeatedlyStart();
            }

            const redisKey = uuid.v1();
            const redis = this.connectToRedis();
            await redis.set(redisKey, residentContactsReport ? residentContactsReport[facilityOriginId] : Buffer.from([]));

            const options = {
                data: {
                    params,
                    redisKey,
                    username,
                    password,
                    facilityId: facilityId.toString(),
                    options: {
                        updateFacilityDetails,
                        updateFacilityPayerTypes,
                        updateFacilityResidentContactTypes,
                        updateResidents,
                    },
                    activityId,
                    facilityDetails: facilityDetails ? facilityDetails[0] : null,
                    payerInfoMap: payerTypesMap,
                    residentContactTypesMap: residentContactTypesMap,
                },
            };
            // await this.sendResponse(options, true);
            await this.sendWorkerResponse(options)
        } catch (e) {
            await this.failActivity(activityId, {
                error: possibleErrorMessage,
            });
            console.log('error', e);
        }
    }

    async startFetchingFacilityResidents(chainId: number, facility: string, username: string, password: string, params, silent: boolean = false) {
        console.log('start crawl residents init', facility);
        let possibleErrorMessage = '';
        try {
            possibleErrorMessage = 'Wrong PCC credentials';
            const residentContactsReportCrawler = new GetFacilitiesResidentsContactsReports(username, password, [facility]);
            const residentContactsReport = await residentContactsReportCrawler.repeatedlyStart();
            console.log('residents crawl finished');
            const formData: any = {
                residents: {
                    value: residentContactsReport[facility],
                    options: {
                        filename: 'residents.csv',
                        contentType: 'text/csv',
                    },
                },
            };
            const redisKey = uuid.v1();
            const redis = this.connectToRedis();
            await redis.set(redisKey, residentContactsReport ? residentContactsReport[facility] : Buffer.from([]));
            console.log('residents formData', formData);
            const options = {
                method: 'POST',
                data: {
                    params,
                    redisKey
                },
            };
            await this.sendWorkerResponse(options);
        } catch (e) {
            console.log('fail fetch resident contact activity', params.activityId, params.failActivityId);
            if (e.message !== 'access denied') {
                throw new Error('Timeout');
            }
            if (params.activityId || params.failActivityId) {
                await this.failActivity(params.activityId || params.failActivityId, {
                    error: possibleErrorMessage,
                });
            }
            console.log('error with fetch residents', e);
        }
    }


    async startFetchingFacilityStatementsToUpdate(chainId: number, batchId: number, facility: string, dateFrom: string, dateTo: string, payerTypes: string[], username: string, password: string, activityId: number) {
        console.log('start crawl statmenets to update');
        let possibleErrorMessage = '';
        try {
            possibleErrorMessage = 'Fail Fetch Transactions Report';
            const transactionsReportCrawler = new GetFacilitiesTransactionReports(
                username,
                password,
                [facility],
                dateFrom,
                dateTo,
                payerTypes,
            );
            const transactionsReports = await transactionsReportCrawler.repeatedlyStart();
            const options = {
                url: `${applicationConfigs.management}/statements/updateBatch/${chainId}`,
                method: 'POST',
                formData: {
                    activityId,
                    dateFrom,
                    dateTo,
                    batchId,
                    statements: {
                        value: transactionsReports[facility],
                        options: {
                            filename: 'statements.csv',
                            contentType: 'text/csv',
                        },
                    },
                },
            };
            await this.sendResponse(options, true);
        } catch (e) {
            await this.failActivity(activityId, {
                error: possibleErrorMessage,
            });
            console.log('error with update statements', e);
        }
    }

    async fetchFacilityTransactions(chainId: number, facilityId: string, dateFrom: string, dateTo: string, payerTypes: string[], username: string, password: string, params: any) {
        try {
            const transactionsReportCrawler = new GetFacilitiesTransactionReports(
                username,
                password,
                [facilityId],
                dateFrom,
                dateTo,
                payerTypes,
            );
            console.log('dates', dateFrom, dateTo, payerTypes);

            const transactionsReports = await transactionsReportCrawler.repeatedlyStart();
            console.log('transactionsReports', transactionsReports);
            const redisKey = uuid.v1();
            const redis = this.connectToRedis();
            await redis.set(redisKey, transactionsReports ? transactionsReports[facilityId] : Buffer.from([]));

            const options = {
                method: 'POST',
                data: {
                    params,
                    redisKey,
                    facilityId,
                    dateFrom,
                    dateTo
                },
            };
            await this.sendWorkerResponse(options);
        } catch (e) {
            if (e instanceof puppeteer.errors.TimeoutError) {
                throw new Error('Timeout');
            }
            if (params.activityId) {
                await this.failActivity(params.activityId, {
                    error: 'Fail Fetch Transactions',
                });
            }
            console.log('error with create statement', e);
        }
}

    async startFetchingFacilityStatementsToCreate(chainId: number, facility: string, dateFrom: string, dateTo: string, payerTypes: string[], username: string, password: string, batchId: number, activityId: number) {
        console.log('start crawl statements to create');
        let possibleErrorMessage = '';
        try {
            possibleErrorMessage = 'Fail Fetch Transactions Report';
            const transactionsReportCrawler = new GetFacilitiesTransactionReports(
                username,
                password,
                [facility],
                dateFrom,
                dateTo,
                payerTypes,
            );
            console.log('dates', dateFrom, dateTo, payerTypes);
            const transactionsReport = await transactionsReportCrawler.repeatedlyStart();
            const options = {
                url: `${applicationConfigs.management}/statements/createBatch/${chainId}`,
                method: 'POST',
                formData: {
                    dateFrom,
                    dateTo,
                    batchId: batchId.toString(),
                    activityId: activityId.toString(),
                    statements: {
                        value: transactionsReport[facility],
                        options: {
                            filename: 'statements.csv',
                            contentType: 'text/csv',
                        },
                    },
                },
            };
            await this.sendResponse(options, true);
        } catch (e) {
            await this.failActivity(activityId, {
                error: possibleErrorMessage,
            });
            console.log('error with create statement', e);
        }
    }

    public failActivity(activityId: number, body: any) {
        return new Promise((resolve) => {
            console.log('FAIL ACTIVITY');
            request({
                url: `${applicationConfigs.management}/activities/failActivity/${activityId}`,
                method: 'POST',
                headers: {
                    apikey: applicationConfigs.managementKey,
                },
                json: true,
                body,
            }, (err: any, response: any, body: any) => {
                console.log('fail Activity body', body, err, `${applicationConfigs.management}/activities/failActivity/${activityId}`);
                resolve(true);
            });
        });
    }

    public notifyActivity(activityId: number, body: any) {
        return new Promise((resolve) => {
            request({
                url: `${applicationConfigs.management}/activities/updateActivity/${activityId}`,
                method: 'POST',
                headers: {
                    apikey: applicationConfigs.managementKey,
                },
                json: true,
                body,
            }, (err: any, response: any, body: any) => {
                resolve(true);
            });
        });
    }

    public async updatePayments(numTries, chainId, username: string, password: string, facilityRealId, facilityId: string, willowDepositId: string, paymentsData: any, effectiveDate: Date | string, activityId: number, errorsStack: any[] = []): Promise<void> {
        let updatePaymentsCrawler
        try {
            const fileName = `payments-${chainId}-${facilityId}-${Date.now()}`;
            console.log('paymentsData', paymentsData.teds);
            const filePath = await this.generateCsv(fileName, paymentsData.csvData);
            updatePaymentsCrawler = new UpdatePayments(username, password, facilityId, willowDepositId, paymentsData, effectiveDate, filePath);
            await updatePaymentsCrawler.start();
            const options = {
                url: `${applicationConfigs.management}/payments/pcc/imported/${chainId}`,
                method: 'POST',
                json: true,
                headers: {
                    apikey: applicationConfigs.managementKey,
                },
                body: {
                    paymentsIds: paymentsData.payments.map((p) => p.payment.id),
                    facilityId: facilityRealId,
                    activityId,
                    willowDepositId
                },
            };
            await this.sendResponse(options, true);
        } catch (e) {
            // const error = {message: e.message, stack: e.stack, time: new Date()};
            // errorsStack.push(error)
            // const options = {
            //     url: `${applicationConfigs.management}/payments/pcc/import-fails/${chainId}`,
            //     method: 'POST',
            //     json: true,
            //     headers: {
            //         apikey: applicationConfigs.managementKey,
            //     },
            //     body: {
            //         numTries,
            //         error,
            //         errorsStack,
            //         willowDepositId,
            //         username,
            //         password,
            //         facilityId,
            //         ...paymentsData,
            //         effectiveDate,
            //         activityId
            //     },
            // };
            // await this.sendResponse(options, true);
            this.failActivity(activityId, {
                error: e.message,
                depositOptions: {
                    errorLogs: updatePaymentsCrawler.logs.concat([e.message]),
                    willowDepositId,
                    type: 'deposit'    
                }
            })
            console.log('error with update payments', e);
        }
        return;
    }
    
    public async checkPayments(chainId, username: string, password: string, facilityRealId: number, facilityId: string, willowDepositId: number, paymentsData: any, effectiveDate: Date | string): Promise<void> {
        let checkPaymentsCrawler;
        try {
            checkPaymentsCrawler = new CheckPayments(username, password, facilityId, paymentsData, effectiveDate);
            const paymentIds = await checkPaymentsCrawler.start();
            const options = {
                url: `${applicationConfigs.management}/payments/pcc/mark-sync/${chainId}`,
                method: 'POST',
                json: true,
                headers: {
                    apikey: applicationConfigs.managementKey,
                },
                body: {
                    paymentsIds: paymentIds,
                    facilityId: facilityRealId
                },
            };
            await this.sendResponse(options, true);
        } catch (e) {
            console.log('error with check payments', e);
            this.failActivity(0, {
                error: e.message,
                depositOptions: {
                    errorLogs: checkPaymentsCrawler.logs.concat([e.message]),
                    willowDepositId,
                    type: 'deposit'    
                }
            })
        }
        return;
    }

    public async deleteFailedBatch(chainId, username: string, password: string, facilityId: string, depositId: string, activityId: string) {
        try {
            const deleteBatchCrawler = new DeleteBatch(username, password, facilityId, depositId);
            await deleteBatchCrawler.start();
        } catch (e) {
            console.log('error with deleting unsuccessful batch', e);
        }
        return;
    }

    public async startFetchFacilityMedicaidDetailsReport(chainId, facility, username, password, activityId, failActivityId = null) {
        try {
            const medicaidCrawler = new GetFacilityMedicaidDetailsReports(username, password, facility);
            const medicaidReport = await medicaidCrawler.repeatedlyStart();
            const formData: any = {
                residents: {
                    value: medicaidReport,
                    options: {
                        filename: 'report.csv',
                        contentType: 'text/csv',
                    },
                },
                facilityId: facility
            };
            if (activityId) {
                formData.activityId = activityId;
            }
            const options = {
                url: `${applicationConfigs.management}/reports/importResidentsMedicaidReport/${chainId}`,
                method: 'POST',
                formData,
            };
            console.log('before request', options);
            await this.sendResponse(options);
        } catch (e) {
            console.log(e);
            await this.failActivity(activityId, {
                error: e.message,
            });
        }
    }

    public async startFetchFacilityMedicareABillingLog(chainId, facility, username, password, reportMonth, activityId, failActivityId = null) {
        try {
            const billingLogCrawler = new GetFacilityMedicareABillingLog(username, password, facility, reportMonth);
            const billingLog = await billingLogCrawler.repeatedlyStart();
            console.log('billing log', billingLog);
            const body: any = {
                billingLog: billingLog,
                facilityId: facility
            };
            if (activityId) {
                body.activityId = activityId;
            }
            const options = {
                url: `${applicationConfigs.management}/reports/importBillingLogReport/${chainId}`,
                method: 'POST',
                json: true,
                body,
            };
            console.log('before request', options);
            await this.sendResponse(options);
        } catch (e) {
            await this.failActivity(activityId, {
                error: e.message,
            });
            console.log('error', e);
        }
        return 'OK';
    }

    async fetchUBReport (username: string, password: string, facilityOriginId: string, facilityId: number, rowNum: number) {
        let fetchUBReportCrawler;
        try {
            const pool = new Pool(1);
            fetchUBReportCrawler = new GetUBReport(username, password, facilityOriginId, rowNum, ({ rowNum, buffer }) => {
                pool.add(async () => {
                    //send rowNum, buffer and facilityId to management via Pool
                    const formData: any = {
                        file: {
                            value: buffer,
                            options: {
                                filename: 'file.text',
                                contentType: 'text/plain',
                            },
                        },
                        // fileNumber: rowNum,
                        // facilityId: facilityId,
                    };
                    
                    const options = {
                        url: `${applicationConfigs.management}/claim/processClaimFile?fileNumber=${rowNum}&facilityId=${facilityId}`,
                        method: 'POST',
                        formData,
                    };
                    await this.sendResponse(options);
                })
            });
            await fetchUBReportCrawler.repeatedlyStart();
        } catch (e) {
            console.log('error', e);
            fetchUBReportCrawler.browser.close();
        }
    }


    private sendResponse(options: any, silent: boolean = false) {
        return new Promise((resolve) => {
            options.headers = {
                apikey: applicationConfigs.managementKey,
            };
            console.log('request to', options.url);
            request(options, async (err, response, body) => {
                resolve(true);
            });
        });
    }

    private async generateCsv(fileName: string, csvData: any[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const filePath = path.resolve(`${os.tmpdir()}/${fileName}.csv`);
            const writeStream = fs.createWriteStream(filePath);
            const csvStream = format({ headers: true });
            csvStream.pipe(writeStream).on('finish', () => {
                console.log('pipe end');
                resolve(filePath);
            });
            csvData.forEach((row) => {
                console.log('row', row);
                csvStream.write(row);
            });
            console.log('after loop');
            csvStream.end();
        });
    }

    private async sendWorkerResponse(options) {
        try {
            options.headers = {
                apikey: '847ae2df-41ed-4d3c-a5fd-63749b168e31'
            }
            options.url = `${applicationConfigs.management}/activities/functionsMiddleware/workers`;
            options.method = 'post';
            // @ts-ignore
            await axios(options);
        } catch (e) {
            console.error('Callback error', e.message)
        }

    }
    connectToRedis() {
        return new Redis({
            port: redisConfig.port, // Redis port
            host: redisConfig.host, // Redis host
            family: 4, // 4 (IPv4) or 6 (IPv6)
            password: redisConfig.password,
            db: 0,
        });
    }
}
