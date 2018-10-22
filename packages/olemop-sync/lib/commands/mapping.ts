import fs from 'fs'
var path = require('path')

/**
 * Auto-load bundled components with getters.
 * @return {Object} mapping
 */
export const loadMapping = (mappingPath: string) => {
  const mapping = {}
  const logger = this.log
  mappingPath += '/'

  this.debug && logger.info(`[data sync compoment] load mapping file ${mappingPath}`)

  fs.readdirSync(mappingPath).forEach((filename) => {
    if (!/\.js$/.test(filename)) return
    const name = path.basename(filename, '.js')
    const fullPath = mappingPath + name

    this.debug && logger.log(`loading ${fullPath}`)

    const pro = require(fullPath)

    for (let key in pro) {
      const fullKey = `${name}.${key}`
      if (mapping[fullKey]) {
        logger.error(`[data sync component] exist duplicated key map function ${key} ignore it now.`)
      } else {
        mapping[fullKey] = pro[key]
      }
    }
  })
  this.debug && logger.info('[data sync component] load mapping file done.' )
  return mapping
}
