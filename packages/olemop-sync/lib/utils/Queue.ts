/**
 * queue for sync deleted data
 */

class Queue {
  tail: any[] = []
  head: any[] = []
  offset: number = 0

  get length () {
    return this.getLength()
  }

  shift () {
    if (this.offset !== this.head.length) return this.head[this.offset++]
    const tmp = this.head
    tmp.length = 0
    this.head = this.tail
    this.tail = tmp
    this.offset = 0
  }

  push (item) {
    return this.tail.push(item)
  }

  forEach (fn) {
    const array = this.head.slice(this.offset)
    array.forEach((item) => fn(item))
    return array
  }

  shiftEach (fn) {
    while (this.tail.length > 0) {
      fn(this.tail.shift())
    }
  }

  getLength () {
    return this.head.length - this.offset + this.tail.length
  }
}

export default Queue
