


class RankedTarget {

  constructor(target) {
    this.target = target;
    this.rank = 0;
  }

  getTarget() {
    return this.target;
  }

  getRank() {
    return this.rank;
  }

  setRank(rank) {
    this.rank = rank;
  }

  incrementRank(rank) {
    this.rank += rank;
  }

  decrementRank(rank) {
    this.rank -= rank;
  }

}


module.exports = {RankedTarget};
