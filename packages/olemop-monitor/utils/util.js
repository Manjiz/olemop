/**
 * convert Date as yyyy-mm-dd hh:mm:ss
 */
const formatTime = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString()}`

module.exports = {
  formatTime
}
