const fs = require('fs')
const path = require('path')

const loadFile = (fp, context) => {
	let m = requireUncached(fp)

	if (!m) return

  // if the module provides a factory function
  // then invoke it to get a instance
	if (typeof m === 'function') {
		m = m(context)
	}

	return m
}

const loadPath = (mpath, context) => {
  let files = fs.readdirSync(mpath)

	if (mpath.charAt(mpath.length - 1) !== '/') {
		mpath += '/'
  }

  // only load js file type
  files = files.filter((fn) => {
    const fp = mpath + fn
    return fs.statSync(fp).isFile() && path.extname(fn) === '.js'
  })

  if (files.length === 0) {
		console.warn(`There is no JS file in: ${mpath}`)
		return
	}

	const res = {}
	for (let i = 0; i < files.length; i++) {
		const fn = files[i]
		const fp = mpath + fn

		const m = loadFile(fp, context)

		if (!m) continue

    const name = m.name || path.basename(fp, '.js')
		res[name] = m
	}

	return res
}

const requireUncached = (m) => require(m)

/**
 * Load modules under the path.
 * If the module is a function, loader would treat it as a factory function
 * and invoke it with the context parameter to get a instance of the module.
 * Else loader would just require the module.
 * Module instance can specify a name property and it would use file name as
 * the default name if there is no name property. All loaded modules under the
 * path would be add to an empty root object with the name as the key.
 *
 * @param  {string} mpath    the path of modules. Load all the files under the
 *                           path, but *not* recursively if the path contain
 *                           any sub-directory.
 * @param  {object} context  the context parameter that would be pass to the
 *                           module factory function.
 * @return {object}          module that has loaded.
 */
module.exports.load = function (mpath, context) {
	if (!mpath) {
		throw new Error('opts or opts.path should not be empty.')
	}

  try {
    mpath = fs.realpathSync(mpath)
  } catch (err) {
    throw err
  }

  if (!fs.statSync(mpath).isDirectory()) {
		throw new Error('path should be directory.')
	}

	return loadPath(mpath, context)
}
