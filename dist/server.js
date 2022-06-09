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
const express = require("express");
const bodyParser = require("body-parser");
const controller_1 = require("./controller");
const config = require("config");
const serverConfigs = config.get('server');
const functionsConfig = config.get('functions');
const server = express();
server.use(bodyParser.json());
server.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const action = req.query.action;
    console.log('action', action);
    if (!action) {
        res.send('Action is not specified');
        return;
    }
    console.log('key', functionsConfig.key, req.headers.apikey, req.headers);
    if (req.headers.apikey !== functionsConfig.key) {
        res.status(401);
        res.send('Access denied');
        return;
    }
    const param = req.query.param || '';
    try {
        const result = yield controller_1.default[action](param, req.body);
        res.send(result);
    }
    catch (e) {
        console.log('Error', e.message);
        if (e.message === 'Timeout') {
            res.status(429);
        }
        else {
            res.status(422);
        }
        res.send(e.message);
    }
}));
server.listen(serverConfigs.port, () => {
    console.log('server started', serverConfigs.port);
});
//# sourceMappingURL=server.js.map