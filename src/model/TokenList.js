class TokenList {
    constructor(tokens=[]) {
        this.tokens = tokens
        this.tokenMatches = [];
        this.tokenWeights = [];
        for (let token of tokens) {
            this.tokenMatches.push(token.match);
            this.tokenWeights.push(token.weight);
        }
    }

    joinMatch() {
        return this.tokenMatches.join(' ');
    }

    averageWeight() {
        var sum = this.tokenWeights.reduce(function (accumulator, currentValue) {
            return accumulator + (currentValue > .4 ? currentValue : 0);
        }, 0);
        return sum / this.tokenWeights.length;
    }

    toString() {
        return "Matches = " + this.joinMatch() + ", averageWeight = " + this.averageWeight();
    }
}

module.exports = {TokenList};