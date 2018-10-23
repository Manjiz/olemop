/**
 * add val to list
 */
export const sadd = (key, val) => {
  this.writeToAOF('sadd', [ key, val ])
  const obj = this.lookup(key)
  if (obj) {
	  obj.val.push(val)
	  return true
  }	else {
	  this.set(key, [ val ])
	  return true
  }
}

/**
 * del from list
 */
export const sdel = (key, val) => {
  this.writeToAOF('sdel', [ key, val ])
  const obj = this.lookup(key)
  if (!obj) return false
  const index = obj.val.indexOf(val)
  if (index === -1) return false
  delete obj.val[index]
  return true
}

