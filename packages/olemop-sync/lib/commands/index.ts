import * as keys from './keys'
import * as string from './string'
import * as list from './list'
import * as hash from './hash'
import * as server from './server'
import * as mapping from './mapping'

export default class Commands {
  constructor () {
    Object.assign(this, {
      ...keys,
      ...string,
      ...list,
      ...hash,
      ...server,
      ...mapping
    })
  }
}
