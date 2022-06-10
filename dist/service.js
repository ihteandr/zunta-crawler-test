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
exports.AppService = void 0;
const fs = require("fs");
const path = require("path");
const format_1 = require("@fast-csv/format");
const GetFacilitiesWithDetails_1 = require("./crawler/GetFacilitiesWithDetails");
const GetFacilitiesResidentContactTypes_1 = require("./crawler/GetFacilitiesResidentContactTypes");
const GetFacilitiesPayerTypes_1 = require("./crawler/GetFacilitiesPayerTypes");
const config = require("config");
const request = require("request");
const GetFacilitiesResidentsContactsReports_1 = require("./crawler/GetFacilitiesResidentsContactsReports");
const GetFacilitiesTransactionReports_1 = require("./crawler/GetFacilitiesTransactionReports");
const GetFacilityMedicaidDetailsReport_1 = require("./crawler/GetFacilityMedicaidDetailsReport");
const GetFacilityMedicaidABillingLog_1 = require("./crawler/GetFacilityMedicaidABillingLog");
const UpdatePayments_1 = require("./crawler/UpdatePayments");
const CheckPayments_1 = require("./crawler/CheckPayments");
const DeleteBatch_1 = require("./crawler/DeleteBatch");
const os = require("os");
const uuid = require("uuid");
const Redis = require("ioredis");
const axios = require("axios");
const puppeteer = require("puppeteer");
const GetUBReport_1 = require("./crawler/GetUBReport");
const Pool_1 = require("./helpers/utils/Pool");
const applicationConfigs = config.get('application');
const serverConfigs = config.get('server');
const redisConfig = config.get('redis');
class AppService {
    startFetchingFacilitiesWithDetails(chainId, facilityIds, username, password, dataOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('start crawl facilities details');
            let possibleErrorMessage = '';
            try {
                console.log('crawl facilities');
                possibleErrorMessage = 'Fail Fetching Facilities Details';
                const facilityDetailsCrawler = new GetFacilitiesWithDetails_1.GetFacilitiesWithDetails(username, password, facilityIds);
                const facilityDetails = yield facilityDetailsCrawler.repeatedlyStart();
                console.log('crawl resident contact types 1');
                possibleErrorMessage = 'Fail Fetching Resident Contacts';
                const residentContactTypesCrawler = new GetFacilitiesResidentContactTypes_1.GetFacilitiesResidentContactTypes(username, password, facilityIds);
                const residentContactTypesMap = yield residentContactTypesCrawler.repeatedlyStart();
                console.log('crawl payerTypes');
                possibleErrorMessage = 'Fail Fetching Payer Types';
                const payerTypesCrawler = new GetFacilitiesPayerTypes_1.GetFacilitiesPayerTypes(username, password, facilityIds);
                const payerTypesMap = yield payerTypesCrawler.repeatedlyStart();
                const options = {
                    url: `${applicationConfigs.management}/facilities/importFacilityDetails/${chainId}`,
                    method: 'POST',
                    json: true,
                    body: Object.assign({ username,
                        password, facilitiesList: facilityDetails, payerInfoMap: payerTypesMap, residentContactTypesMap }, dataOptions),
                };
                yield this.sendResponse(options);
            }
            catch (e) {
                console.log('error', e.message);
                yield this.failActivity(dataOptions.activityId, {
                    error: possibleErrorMessage || e.message,
                });
            }
        });
    }
    startFetchFacilityUpdates(chainId, updateFacilityDetails, updateFacilityResidentContactTypes, updateFacilityPayerTypes, updateResidents, facilityId, facilityOriginId, username, password, activityId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let possibleErrorMessage = '';
            try {
                let facilityDetails = null;
                if (updateFacilityDetails) {
                    possibleErrorMessage = 'Fail Fetch Facilities Details';
                    console.log('crawl facilities', username, password, [facilityOriginId]);
                    const facilityDetailsCrawler = new GetFacilitiesWithDetails_1.GetFacilitiesWithDetails(username, password, [facilityOriginId]);
                    facilityDetails = yield facilityDetailsCrawler.repeatedlyStart();
                }
                let residentContactTypesMap = null;
                if (updateFacilityResidentContactTypes) {
                    console.log('crawl resident contact types');
                    possibleErrorMessage = 'Fail Fetch Resident Contact Types';
                    const residentContactTypesCrawler = new GetFacilitiesResidentContactTypes_1.GetFacilitiesResidentContactTypes(username, password, [facilityOriginId]);
                    residentContactTypesMap = yield residentContactTypesCrawler.repeatedlyStart();
                }
                let payerTypesMap = null;
                if (updateFacilityPayerTypes) {
                    console.log('crawl payerTypes');
                    possibleErrorMessage = 'Fail Fetch Facilities Payer Types';
                    const payerTypesCrawler = new GetFacilitiesPayerTypes_1.GetFacilitiesPayerTypes(username, password, [facilityOriginId]);
                    payerTypesMap = yield payerTypesCrawler.repeatedlyStart();
                }
                let residentContactsReport = null;
                if (updateResidents) {
                    console.log('crawl residents');
                    possibleErrorMessage = 'Fail Fetch Resident Contact';
                    const residentContactsReportCrawler = new GetFacilitiesResidentsContactsReports_1.GetFacilitiesResidentsContactsReports(username, password, [facilityOriginId]);
                    residentContactsReport = yield residentContactsReportCrawler.repeatedlyStart();
                }
                const redisKey = uuid.v1();
                const redis = this.connectToRedis();
                yield redis.set(redisKey, residentContactsReport ? residentContactsReport[facilityOriginId] : Buffer.from([]));
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
                yield this.sendWorkerResponse(options);
            }
            catch (e) {
                yield this.failActivity(activityId, {
                    error: possibleErrorMessage,
                });
                console.log('error', e);
            }
        });
    }
    startFetchingFacilityResidents(chainId, facility, username, password, params, silent = false) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('start crawl residents init', facility);
            let possibleErrorMessage = '';
            try {
                possibleErrorMessage = 'Wrong PCC credentials';
                const residentContactsReportCrawler = new GetFacilitiesResidentsContactsReports_1.GetFacilitiesResidentsContactsReports(username, password, [facility]);
                const residentContactsReport = yield residentContactsReportCrawler.repeatedlyStart();
                console.log('residents crawl finished');
                const formData = {
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
                yield redis.set(redisKey, residentContactsReport ? residentContactsReport[facility] : Buffer.from([]));
                console.log('residents formData', formData);
                const options = {
                    method: 'POST',
                    data: {
                        params,
                        redisKey
                    },
                };
                yield this.sendWorkerResponse(options);
            }
            catch (e) {
                console.log('fail fetch resident contact activity', params.activityId, params.failActivityId);
                if (e.message !== 'access denied') {
                    throw new Error('Timeout');
                }
                if (params.activityId || params.failActivityId) {
                    yield this.failActivity(params.activityId || params.failActivityId, {
                        error: possibleErrorMessage,
                    });
                }
                console.log('error with fetch residents', e);
            }
        });
    }
    startFetchingFacilityStatementsToUpdate(chainId, batchId, facility, dateFrom, dateTo, payerTypes, username, password, activityId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('start crawl statmenets to update');
            let possibleErrorMessage = '';
            try {
                possibleErrorMessage = 'Fail Fetch Transactions Report';
                const transactionsReportCrawler = new GetFacilitiesTransactionReports_1.GetFacilitiesTransactionReports(username, password, [facility], dateFrom, dateTo, payerTypes);
                const transactionsReports = yield transactionsReportCrawler.repeatedlyStart();
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
                yield this.sendResponse(options, true);
            }
            catch (e) {
                yield this.failActivity(activityId, {
                    error: possibleErrorMessage,
                });
                console.log('error with update statements', e);
            }
        });
    }
    fetchFacilityTransactions(chainId, facilityId, dateFrom, dateTo, payerTypes, username, password, params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transactionsReportCrawler = new GetFacilitiesTransactionReports_1.GetFacilitiesTransactionReports(username, password, [facilityId], dateFrom, dateTo, payerTypes);
                console.log('dates', dateFrom, dateTo, payerTypes);
                const transactionsReports = yield transactionsReportCrawler.repeatedlyStart();
                console.log('transactionsReports', transactionsReports);
                const redisKey = uuid.v1();
                const redis = this.connectToRedis();
                yield redis.set(redisKey, transactionsReports ? transactionsReports[facilityId] : Buffer.from([]));
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
                yield this.sendWorkerResponse(options);
            }
            catch (e) {
                if (e instanceof puppeteer.errors.TimeoutError) {
                    throw new Error('Timeout');
                }
                if (params.activityId) {
                    yield this.failActivity(params.activityId, {
                        error: 'Fail Fetch Transactions',
                    });
                }
                console.log('error with create statement', e);
            }
        });
    }
    startFetchingFacilityStatementsToCreate(chainId, facility, dateFrom, dateTo, payerTypes, username, password, batchId, activityId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('start crawl statements to create');
            let possibleErrorMessage = '';
            try {
                possibleErrorMessage = 'Fail Fetch Transactions Report';
                const transactionsReportCrawler = new GetFacilitiesTransactionReports_1.GetFacilitiesTransactionReports(username, password, [facility], dateFrom, dateTo, payerTypes);
                console.log('dates', dateFrom, dateTo, payerTypes);
                const transactionsReport = yield transactionsReportCrawler.repeatedlyStart();
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
                yield this.sendResponse(options, true);
            }
            catch (e) {
                yield this.failActivity(activityId, {
                    error: possibleErrorMessage,
                });
                console.log('error with create statement', e);
            }
        });
    }
    failActivity(activityId, body) {
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
            }, (err, response, body) => {
                console.log('fail Activity body', body, err, `${applicationConfigs.management}/activities/failActivity/${activityId}`);
                resolve(true);
            });
        });
    }
    notifyActivity(activityId, body) {
        return new Promise((resolve) => {
            request({
                url: `${applicationConfigs.management}/activities/updateActivity/${activityId}`,
                method: 'POST',
                headers: {
                    apikey: applicationConfigs.managementKey,
                },
                json: true,
                body,
            }, (err, response, body) => {
                resolve(true);
            });
        });
    }
    updatePayments(numTries, chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate, activityId, errorsStack = []) {
        return __awaiter(this, void 0, void 0, function* () {
            let updatePaymentsCrawler;
            try {
                const fileName = `payments-${chainId}-${facilityId}-${Date.now()}`;
                console.log('paymentsData', paymentsData.teds);
                const filePath = yield this.generateCsv(fileName, paymentsData.csvData);
                updatePaymentsCrawler = new UpdatePayments_1.UpdatePayments(username, password, facilityId, willowDepositId, paymentsData, effectiveDate, filePath);
                yield updatePaymentsCrawler.start();
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
                yield this.sendResponse(options, true);
            }
            catch (e) {
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
                });
                console.log('error with update payments', e);
            }
            return;
        });
    }
    checkPayments(chainId, username, password, facilityRealId, facilityId, willowDepositId, paymentsData, effectiveDate) {
        return __awaiter(this, void 0, void 0, function* () {
            let checkPaymentsCrawler;
            try {
                checkPaymentsCrawler = new CheckPayments_1.CheckPayments(username, password, facilityId, paymentsData, effectiveDate);
                const paymentIds = yield checkPaymentsCrawler.start();
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
                yield this.sendResponse(options, true);
            }
            catch (e) {
                console.log('error with check payments', e);
                this.failActivity(0, {
                    error: e.message,
                    depositOptions: {
                        errorLogs: checkPaymentsCrawler.logs.concat([e.message]),
                        willowDepositId,
                        type: 'deposit'
                    }
                });
            }
            return;
        });
    }
    deleteFailedBatch(chainId, username, password, facilityId, depositId, activityId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deleteBatchCrawler = new DeleteBatch_1.DeleteBatch(username, password, facilityId, depositId);
                yield deleteBatchCrawler.start();
            }
            catch (e) {
                console.log('error with deleting unsuccessful batch', e);
            }
            return;
        });
    }
    startFetchFacilityMedicaidDetailsReport(chainId, facility, username, password, activityId, failActivityId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const medicaidCrawler = new GetFacilityMedicaidDetailsReport_1.GetFacilityMedicaidDetailsReports(username, password, facility);
                const medicaidReport = yield medicaidCrawler.repeatedlyStart();
                const formData = {
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
                yield this.sendResponse(options);
            }
            catch (e) {
                console.log(e);
                yield this.failActivity(activityId, {
                    error: e.message,
                });
            }
        });
    }
    startFetchFacilityMedicareABillingLog(chainId, facility, username, password, reportMonth, activityId, failActivityId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const billingLogCrawler = new GetFacilityMedicaidABillingLog_1.GetFacilityMedicareABillingLog(username, password, facility, reportMonth);
                const billingLog = yield billingLogCrawler.repeatedlyStart();
                console.log('billing log', billingLog);
                const body = {
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
                yield this.sendResponse(options);
            }
            catch (e) {
                yield this.failActivity(activityId, {
                    error: e.message,
                });
                console.log('error', e);
            }
            return 'OK';
        });
    }
    fetchUBReport(username, password, facilityOriginId, facilityId, rowNum) {
        return __awaiter(this, void 0, void 0, function* () {
            let fetchUBReportCrawler;
            try {
                const pool = new Pool_1.Pool(1);
                fetchUBReportCrawler = new GetUBReport_1.GetUBReport(username, password, facilityOriginId, rowNum, ({ rowNum, buffer }) => {
                    pool.add(() => __awaiter(this, void 0, void 0, function* () {
                        //send rowNum, buffer and facilityId to management via Pool
                        const formData = {
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
                        yield this.sendResponse(options);
                    }));
                });
                yield fetchUBReportCrawler.repeatedlyStart();
            }
            catch (e) {
                console.log('error', e);
                fetchUBReportCrawler.browser.close();
            }
        });
    }
    sendResponse(options, silent = false) {
        return new Promise((resolve) => {
            options.headers = {
                apikey: applicationConfigs.managementKey,
            };
            console.log('request to', options.url);
            request(options, (err, response, body) => __awaiter(this, void 0, void 0, function* () {
                resolve(true);
            }));
        });
    }
    generateCsv(fileName, csvData) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const filePath = path.resolve(`${os.tmpdir()}/${fileName}.csv`);
                const writeStream = fs.createWriteStream(filePath);
                const csvStream = format_1.format({ headers: true });
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
        });
    }
    sendWorkerResponse(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                options.headers = {
                    apikey: '847ae2df-41ed-4d3c-a5fd-63749b168e31'
                };
                options.url = `${applicationConfigs.management}/activities/functionsMiddleware/workers`;
                options.method = 'post';
                // @ts-ignore
                yield axios(options);
            }
            catch (e) {
                console.error('Callback error', e.message);
            }
        });
    }
    connectToRedis() {
        return new Redis({
            port: redisConfig.port,
            host: redisConfig.host,
            family: 4,
            password: redisConfig.password,
            db: 0,
        });
    }
}
exports.AppService = AppService;
//# sourceMappingURL=service.js.map