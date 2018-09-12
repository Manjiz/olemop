/**
 * Count down to zero and invoke cb finally.
 */
class CountDownLatch {
  constructor (count, cb) {
    this.count = count
    this.cb = cb
  }

  done () {
    if (this.count <= 0) {
      throw new Error('illegal state.')
    }
    this.count--
    if (this.count === 0) {
      this.cb()
    }
  }
}

/**
 * create a count down latch
 */
exports.createCountDownLatch = (count, cb) => {
  if (!count || count <= 0) {
    throw new Error('count should be positive.')
  }
  if (typeof cb !== 'function') {
    throw new Error('cb should be a function.')
  }
  return new CountDownLatch(count, cb)
}
