const sequeue = require('./sequeue')

const timeout = 3000
const queues = {}

/**
 * Add tasks into task group. Create the task group if it dose not exist.
 *
 * @param {string}   key       task key
 * @param {Function} fn        task callback
 * @param {Function} ontimeout task timeout callback
 * @param {number}   timeout   timeout for task
 */
const addTask = (key, fn, ontimeout, timeout) => {
  let queue = queues[key]
  if (!queue) {
    queue = sequeue.createQueue(timeout)
    queues[key] = queue
  }
  return queue.push(fn, ontimeout, timeout)
}

/**
 * Destroy task group
 *
 * @param {string} key   task key
 * @param  {Boolean} force whether close task group directly
 */
const closeQueue = (key, force) => {
  // ignore illeagle key
  if (!queues[key]) return

  queues[key].close(force)
  delete queues[key]
}

module.exports = {
  timeout,
  addTask,
  closeQueue
}
