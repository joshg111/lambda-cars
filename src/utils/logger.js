function makeLogger(isLog) {
    return new Logger(isLog);
}

class Logger {

    constructor(isLog) {
        this.isLog = isLog;
    }

    log(...msg) {
        if (this.isLog) {
            console.log(...msg);
        }
    }
}

module.exports = {makeLogger};
