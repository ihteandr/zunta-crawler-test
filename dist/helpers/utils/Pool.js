"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pool = void 0;
const events_1 = require("events");
class Pool extends events_1.EventEmitter {
    constructor(size, timeout) {
        super();
        this.pull = [];
        this.state = 'wait';
        this.active = 0;
        this.timeout = timeout || 1 * 60 * 60 * 1000;
        this.size = size;
        this.done = this.done.bind(this);
    }
    nextTick() {
        this.runNext();
    }
    runNext() {
        const fn = this.pull.shift();
        if (fn) {
            this.state = 'in-process';
            this.active++;
            fn(this.done);
            this.emit('next', this.active);
        }
    }
    done() {
        this.state = 'wait';
        this.active--;
        this.emit('done', this.active);
        if (this.pull.length) {
            this.nextTick();
        }
    }
    reset() {
        this.pull = [];
        this.state = 'wait';
    }
    add(func) {
        return new Promise((resolve, reject) => {
            this.pull.push((done) => {
                const timeoutID = setTimeout(() => {
                    done();
                    reject();
                }, this.timeout);
                let value = func(done);
                if (value instanceof Promise) {
                    value.then((arg) => {
                        clearTimeout(timeoutID);
                        resolve(arg);
                        done();
                    }, (arg) => {
                        clearTimeout(timeoutID);
                        reject(arg);
                        done();
                    });
                }
                else {
                    clearTimeout(timeoutID);
                    resolve(value);
                    done();
                }
            });
            if (this.size > this.active) {
                this.nextTick();
            }
        });
    }
}
exports.Pool = Pool;
//# sourceMappingURL=Pool.js.map