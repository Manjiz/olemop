const path = require('path')
const Loader = require('../lib/loader')
const testAreaPath = path.join(__dirname, '/mock-remote/area/')
const testConnectorPath = path.join(__dirname, '/mock-remote/connector/')

const WAIT_TIME = 20

describe('loader', () => {
  describe('#load', () => {
    test('should load all modules under the path but sub-directory', () => {
      const services = Loader.load(testAreaPath)
      expect(services).toBeDefined()
      expect(services).toMatchObject({
        addOneRemote: {
          doService: expect.any(Function),
          doAddTwo: expect.any(Function)
        },
        addThreeRemote: {
          doService: expect.any(Function)
        },
        whoAmIRemote: {
          doService: expect.any(Function),
          name: expect.any(String)
        }
      })
    })

    test('should invoke functions of loaded object successfully', (done) => {
      const sid = 'area-server-1'
      const context = { id: sid }
      const services = Loader.load(testAreaPath, context)
      let callbackCount = 0
      expect(services).toBeDefined()

			services.addOneRemote.doService(1, (err, res) => {
        callbackCount++
        expect(res).toBe(2)
			})

			services.addOneRemote.doAddTwo(1, (err, res) => {
				callbackCount++
				expect(res).toBe(3)
			})

			services.addThreeRemote.doService(1, (err, res) => {
				callbackCount++
        expect(res).toBe(4)
			})

			// context should be pass to factory function for each module
			services.whoAmIRemote.doService((err, res) => {
				callbackCount++
        expect(res).toBe(sid)
			})

			setTimeout(() => {
        expect(callbackCount).toBe(4)
				done()
			}, WAIT_TIME)
    })

    test('should warn if the path is empty', () => {
      console.warn = jest.fn()
      Loader.load(testConnectorPath)
      expect(console.warn).toHaveBeenCalled()
		})

		test('should throw exception if the path dose not exist', () => {
			const path = './some/error/path'
			expect(() => {
				Loader.loadPath(path)
			}).toThrow()
		})
  })
})
