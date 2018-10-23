import fs from 'fs'
import path from 'path'

/**
 * Auto-load bundled components with getters.
 * @return {Object} mapping
 */
export const loadMapping = (mappingPath: string) => {
  const mapping = {}
  mappingPath += '/'

  this.debug && this.logger.info(`[data sync compoment] load mapping file ${mappingPath}`)

  fs.readdirSync(mappingPath).forEach((filename) => {
    if (!/\.js$/.test(filename)) return
    const name = path.basename(filename, '.js')
    const fullPath = mappingPath + name

    this.debug && this.logger.log(`loading ${fullPath}`)

    const pro = require(fullPath)

    for (let key in pro) {
      const fullKey = `${name}.${key}`
      if (mapping[fullKey]) {
        this.debug && this.logger.error(`[data sync component] exist duplicated key map function ${key} ignore it now.`)
      } else {
        mapping[fullKey] = pro[key]
      }
    }
  })
  this.debug && this.logger.info('[data sync component] load mapping file done.' )
  return mapping
}
