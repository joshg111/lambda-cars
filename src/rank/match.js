
class Match {
    constructor(source, matches=[]) {
        this.source = source;
        this.matches = matches;
    }

    toString() {
        return "source = " + this.source.toString() + ", matchWords = " + this.matches.toString();
    }
}

module.exports = {Match};