function insequenceMatch(a, b, i, j, count) {

	if i >= len(a) or j >= len(b):
		return count

	if a[i] == b[j]:
		count += 1
		count = insequenceMatch(a, b, i+1, j+1, count)

	else:
		count = max(insequenceMatch(a, b, i, j+1, count), insequenceMatch(a, b, i+1, j, count))

	return count
}

function match(a, b) {
  return insequenceMatch(a, b, 0, 0, 0)
}

module.exports = {insequenceCount: match};
