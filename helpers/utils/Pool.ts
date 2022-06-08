import { EventEmitter } from "events";

export class Pool extends EventEmitter{
    private pull: Array<Function> = [];
    public state: string = 'wait';
    private size: number;
    private timeout: number;
    private active: number = 0;

    constructor(size: number, timeout?: number){
        super();
        this.timeout = timeout || 1*60*60*1000;
        this.size = size;
        this.done = this.done.bind(this);
    }
    private nextTick(){
        this.runNext();
    }
    private runNext(){
        const fn = this.pull.shift();
        if (fn) {
            this.state = 'in-process';
            this.active++;
            fn(this.done);
            this.emit('next', this.active);    
        }
    }
    private done(){
        this.state = 'wait';
        this.active--;
        this.emit('done', this.active);
        if(this.pull.length){
            this.nextTick();
        }
    }
    public reset(){
        this.pull = [];
        this.state = 'wait';
    }
    public add(func){
        return new Promise((resolve,reject)=>{
            this.pull.push((done)=>{
                const timeoutID = setTimeout(() => {
                    done();
                    reject();
                }, this.timeout)
                let value = func(done);
                if(value instanceof Promise){
                    value.then((arg)=>{
                        clearTimeout(timeoutID);
                        resolve(arg);
                        done();
                    },(arg)=>{
                        clearTimeout(timeoutID);
                        reject(arg);
                        done();
                    });
                } else {
                    clearTimeout(timeoutID);
                    resolve(value);
                    done();
                }
            });
            if(this.size > this.active){
                this.nextTick();
            }
        });
    }

}
