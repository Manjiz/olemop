// 由 @olemop/client-js 修改所得

const WebSocket = require('ws')
let olemop
const window = {};

/////////////////////////////////////////////////////////////
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

  var EventEmitter = __webpack_require__(1);

  var Protocol = __webpack_require__(2);

  var protobuf = __webpack_require__(9); // const rsa = require('./olemop-rsasign/rsa')


  var envUtil = __webpack_require__(10); // @todo const


  var rsa;
  var JS_WS_CLIENT_TYPE = 'js-websocket';
  var JS_WS_CLIENT_VERSION = '0.0.1';
  var Package = Protocol.Package;
  var Message = Protocol.Message;
  var RES_OK = 200; // const RES_FAIL = 500

  var RES_OLD_CLIENT = 501;
  olemop = Object.create(EventEmitter.prototype);
  var socket = null;
  var callbacks = {};
  var handlers = {}; // Map from request id to route

  var routeMap = {}; // // route string to code
  // olemop.dict = {}
  // // code to route string
  // olemop.abbrs = {}

  var serverProtos = {};
  var clientProtos = {};
  var protoVersion = 0;
  var heartbeatInterval = 0;
  var heartbeatTimeout = 0;
  var nextHeartbeatTimeout = 0; // heartbeat gap threashold

  var gapThreshold = 100;
  var heartbeatId = null;
  var heartbeatTimeoutId = null;
  var handshakeCallback = null;
  var decode = null;
  var encode = null;
  var useCrypto;
  var preventReconnect = false;
  var reconnect = false;
  var reconncetTimer = null;
  var reconnectUrl = null;
  var reconnectAttempts = 0;
  var reconnectionDelay = 5000;
  var DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
  var handshakeBuffer = {
    sys: {
      type: JS_WS_CLIENT_TYPE,
      version: JS_WS_CLIENT_VERSION,
      rsa: {}
    },
    user: {}
  };
  var initCallback = null;

  olemop.init = function (params, cb) {
    initCallback = cb;
    encode = params.encode || defaultEncode;
    decode = params.decode || defaultDecode;
    var url = envUtil.formatURI(params.host, params.port);
    handshakeBuffer.user = params.user;

    if (params.encrypt) {
      useCrypto = true;
      rsa.generate(1024, '10001');
      handshakeBuffer.sys.rsa = {
        rsa_n: rsa.n.toString(16),
        rsa_e: rsa.e
      };
    }

    handshakeCallback = params.handshakeCallback;
    connect(params, url, cb);
  };

  var defaultDecode = olemop.decode = function (data) {
    // probuff decode
    var msg = Message.decode(data);

    if (msg.id > 0) {
      msg.route = routeMap[msg.id];
      delete routeMap[msg.id];
      if (!msg.route) return;
    }

    msg.body = deCompose(msg);
    return msg;
  };

  var defaultEncode = olemop.encode = function (reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY; // compress message by protobuf

    if (protobuf && clientProtos[route]) {
      msg = protobuf.encode(route, msg);
    } else {
      msg = Protocol.strencode(JSON.stringify(msg));
    }

    var compressRoute = 0;

    if (olemop.dict && olemop.dict[route]) {
      route = olemop.dict[route];
      compressRoute = 1;
    }

    return Message.encode(reqId, type, compressRoute, route, msg);
  };

  var connect = function connect(params, url, cb) {
    console.log("connect to ".concat(url));
    params = params || {};
    var maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
    reconnectUrl = url; // Add protobuf version

    if (protoVersion === 0) {
      var protos = envUtil.getStorageProtos();

      if (protos) {
        protos = JSON.parse(protos);
        protoVersion = protos.version || 0;
        serverProtos = protos.server || {};
        clientProtos = protos.client || {};

        if (protobuf) {
          protobuf.init({
            encoderProtos: clientProtos,
            decoderProtos: serverProtos
          });
        }
      }
    } // Set protoversion


    handshakeBuffer.sys.protoVersion = protoVersion;

    var onopen = function onopen(event) {
      if (reconnect) {
        olemop.emit('reconnect');
      }

      reset();
      send(Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer))));
    };

    var onmessage = function onmessage(event) {
      processPackage(Package.decode(event.data), cb); // new package arrived, update the heartbeat timeout

      if (heartbeatTimeout) {
        nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      }
    };

    var onerror = function onerror(event) {
      olemop.emit('io-error', event);
      console.error('socket error: ', event);
    };

    var onclose = function onclose(event) {
      olemop.emit('close', event);
      olemop.emit('disconnect', event);

      if (event.code !== 1000) {
        console.error('socket close: ', event);
      }

      if (!preventReconnect && params.reconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnect = true;
        reconnectAttempts++;
        reconncetTimer = setTimeout(function () {
          connect(params, reconnectUrl, cb);
        }, reconnectionDelay);
        reconnectionDelay *= 2;
      }
    };

    socket = envUtil.initSocket(url, onopen, onmessage, onerror, onclose);
  };

  olemop.preventReconnect = function () {
    preventReconnect = true;
  };

  olemop.disconnect = function (code, reason) {
    if (socket) {
      envUtil.closeConnection(socket, code, reason);
      console.log('disconnect');
      socket = null;
    }

    if (heartbeatId) {
      clearTimeout(heartbeatId);
      heartbeatId = null;
    }

    if (heartbeatTimeoutId) {
      clearTimeout(heartbeatTimeoutId);
      heartbeatTimeoutId = null;
    }
  };

  var reset = function reset() {
    preventReconnect = false;
    reconnect = false;
    reconnectionDelay = 1000 * 5;
    reconnectAttempts = 0;
    clearTimeout(reconncetTimer);
  };

  var reqId = 0;

  olemop.request = function (route, msg, cb) {
    if (arguments.length === 2 && typeof msg === 'function') {
      cb = msg;
      msg = {};
    } else {
      msg = msg || {};
    }

    route = route || msg.route;
    if (!route) return;
    reqId++;
    sendMessage(reqId, route, msg);
    callbacks[reqId] = cb;
    routeMap[reqId] = route;
  };

  olemop.notify = function (route) {
    var msg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    sendMessage(0, route, msg);
  };

  var sendMessage = function sendMessage(reqId, route, msg) {
    if (useCrypto) {
      msg = JSON.stringify(msg);
      var sig = rsa.signString(msg, 'sha256');
      msg = JSON.parse(msg);
      msg['__crypto__'] = sig;
    }

    if (encode) {
      msg = encode(reqId, route, msg);
    }

    send(Package.encode(Package.TYPE_DATA, msg));
  };

  var send = function send(packet) {
    envUtil.send(socket, packet.buffer);
  };

  var handshake = function handshake(data) {
    data = JSON.parse(Protocol.strdecode(data));

    if (data.code === RES_OLD_CLIENT) {
      olemop.emit('error', 'client version not fullfill');
      return;
    }

    if (data.code !== RES_OK) {
      olemop.emit('error', 'handshake fail');
      return;
    }

    handshakeInit(data);
    send(Package.encode(Package.TYPE_HANDSHAKE_ACK));

    if (initCallback) {
      initCallback(socket);
    }
  };

  var heartbeatTimeoutCb = function heartbeatTimeoutCb() {
    var gap = nextHeartbeatTimeout - Date.now();

    if (gap > gapThreshold) {
      heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap);
    } else {
      console.error('server heartbeat timeout');
      olemop.emit('heartbeat timeout');
      olemop.disconnect();
    }
  };

  var heartbeat = function heartbeat(data) {
    // no heartbeat
    if (!heartbeatInterval) return;

    if (heartbeatTimeoutId) {
      clearTimeout(heartbeatTimeoutId);
      heartbeatTimeoutId = null;
    } // already in a heartbeat interval


    if (heartbeatId) return;
    heartbeatId = setTimeout(function () {
      heartbeatId = null;
      send(Package.encode(Package.TYPE_HEARTBEAT));
      nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout);
    }, heartbeatInterval);
  };

  var onData = function onData(msg) {
    if (decode) {
      msg = decode(msg);
    }

    processMessage(olemop, msg);
  };

  var onKick = function onKick(data) {
    data = JSON.parse(Protocol.strdecode(data));
    olemop.emit('onKick', data);
  };

  handlers[Package.TYPE_HANDSHAKE] = handshake;
  handlers[Package.TYPE_HEARTBEAT] = heartbeat;
  handlers[Package.TYPE_DATA] = onData;
  handlers[Package.TYPE_KICK] = onKick;

  var processPackage = function processPackage(msgs) {
    if (Array.isArray(msgs)) {
      msgs.forEach(function (msg) {
        handlers[msg.type](msg.body);
      });
    } else {
      handlers[msgs.type](msgs.body);
    }
  };

  var processMessage = function processMessage(olemop, msg) {
    if (!msg.id) {
      // server push message
      olemop.emit(msg.route, msg.body);
      return;
    } // if have a id then find the callback function with the request


    var cb = callbacks[msg.id];
    delete callbacks[msg.id];
    if (typeof cb !== 'function') return;
    cb(msg.body);
  };

  var processMessageBatch = function processMessageBatch(olemop, msgs) {
    msgs.forEach(function (msg) {
      processMessage(olemop, msg);
    });
  };

  var deCompose = function deCompose(msg) {
    var route = msg.route; // Decompose route from dict

    if (msg.compressRoute) {
      if (!olemop.abbrs[route]) {
        return {};
      }

      route = msg.route = olemop.abbrs[route];
    }

    if (protobuf && serverProtos[route]) {
      return protobuf.decodeStr(route, msg.body);
    } else {
      return JSON.parse(Protocol.strdecode(msg.body));
    }
  };

  var handshakeInit = function handshakeInit(data) {
    if (data.sys && data.sys.heartbeat) {
      // heartbeat interval
      heartbeatInterval = data.sys.heartbeat * 1000; // max heartbeat timeout

      heartbeatTimeout = heartbeatInterval * 2;
    } else {
      heartbeatInterval = 0;
      heartbeatTimeout = 0;
    }

    initData(data);

    if (typeof handshakeCallback === 'function') {
      handshakeCallback(data.user);
    }
  }; // Initilize data used in olemop client


  var initData = function initData(data) {
    if (!data || !data.sys) return;
    var dict = data.sys.dict;
    var protos = data.sys.protos; // Init compress dict

    if (dict) {
      olemop.dict = dict;
      olemop.abbrs = {};

      for (var route in dict) {
        olemop.abbrs[dict[route]] = route;
      }
    } // Init protobuf protos


    if (protos) {
      protoVersion = protos.version || 0;
      serverProtos = protos.server || {};
      clientProtos = protos.client || {}; // Save protobuf protos as key-value somewhere

      envUtil.setStorageProtos(JSON.stringify(protos));

      if (protobuf) {
        protobuf.init({
          encoderProtos: protos.client,
          decoderProtos: protos.server
        });
      }
    }
  };

  module.exports = olemop;

  /***/ }),
  /* 1 */
  /***/ (function(module, exports, __webpack_require__) {

  var __WEBPACK_AMD_DEFINE_RESULT__;/*!
   * EventEmitter v5.2.5 - git.io/ee
   * Unlicense - http://unlicense.org/
   * Oliver Caldwell - http://oli.me.uk/
   * @preserve
   */

  ;(function (exports) {
      'use strict';

      /**
       * Class for managing events.
       * Can be extended to provide event functionality in other classes.
       *
       * @class EventEmitter Manages event registering and emitting.
       */
      function EventEmitter() {}

      // Shortcuts to improve speed and size
      var proto = EventEmitter.prototype;
      var originalGlobalValue = exports.EventEmitter;

      /**
       * Finds the index of the listener for the event in its storage array.
       *
       * @param {Function[]} listeners Array of listeners to search through.
       * @param {Function} listener Method to look for.
       * @return {Number} Index of the specified listener, -1 if not found
       * @api private
       */
      function indexOfListener(listeners, listener) {
          var i = listeners.length;
          while (i--) {
              if (listeners[i].listener === listener) {
                  return i;
              }
          }

          return -1;
      }

      /**
       * Alias a method while keeping the context correct, to allow for overwriting of target method.
       *
       * @param {String} name The name of the target method.
       * @return {Function} The aliased method
       * @api private
       */
      function alias(name) {
          return function aliasClosure() {
              return this[name].apply(this, arguments);
          };
      }

      /**
       * Returns the listener array for the specified event.
       * Will initialise the event object and listener arrays if required.
       * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
       * Each property in the object response is an array of listener functions.
       *
       * @param {String|RegExp} evt Name of the event to return the listeners from.
       * @return {Function[]|Object} All listener functions for the event.
       */
      proto.getListeners = function getListeners(evt) {
          var events = this._getEvents();
          var response;
          var key;

          // Return a concatenated array of all matching events if
          // the selector is a regular expression.
          if (evt instanceof RegExp) {
              response = {};
              for (key in events) {
                  if (events.hasOwnProperty(key) && evt.test(key)) {
                      response[key] = events[key];
                  }
              }
          }
          else {
              response = events[evt] || (events[evt] = []);
          }

          return response;
      };

      /**
       * Takes a list of listener objects and flattens it into a list of listener functions.
       *
       * @param {Object[]} listeners Raw listener objects.
       * @return {Function[]} Just the listener functions.
       */
      proto.flattenListeners = function flattenListeners(listeners) {
          var flatListeners = [];
          var i;

          for (i = 0; i < listeners.length; i += 1) {
              flatListeners.push(listeners[i].listener);
          }

          return flatListeners;
      };

      /**
       * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
       *
       * @param {String|RegExp} evt Name of the event to return the listeners from.
       * @return {Object} All listener functions for an event in an object.
       */
      proto.getListenersAsObject = function getListenersAsObject(evt) {
          var listeners = this.getListeners(evt);
          var response;

          if (listeners instanceof Array) {
              response = {};
              response[evt] = listeners;
          }

          return response || listeners;
      };

      function isValidListener (listener) {
          if (typeof listener === 'function' || listener instanceof RegExp) {
              return true
          } else if (listener && typeof listener === 'object') {
              return isValidListener(listener.listener)
          } else {
              return false
          }
      }

      /**
       * Adds a listener function to the specified event.
       * The listener will not be added if it is a duplicate.
       * If the listener returns true then it will be removed after it is called.
       * If you pass a regular expression as the event name then the listener will be added to all events that match it.
       *
       * @param {String|RegExp} evt Name of the event to attach the listener to.
       * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.addListener = function addListener(evt, listener) {
          if (!isValidListener(listener)) {
              throw new TypeError('listener must be a function');
          }

          var listeners = this.getListenersAsObject(evt);
          var listenerIsWrapped = typeof listener === 'object';
          var key;

          for (key in listeners) {
              if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
                  listeners[key].push(listenerIsWrapped ? listener : {
                      listener: listener,
                      once: false
                  });
              }
          }

          return this;
      };

      /**
       * Alias of addListener
       */
      proto.on = alias('addListener');

      /**
       * Semi-alias of addListener. It will add a listener that will be
       * automatically removed after its first execution.
       *
       * @param {String|RegExp} evt Name of the event to attach the listener to.
       * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.addOnceListener = function addOnceListener(evt, listener) {
          return this.addListener(evt, {
              listener: listener,
              once: true
          });
      };

      /**
       * Alias of addOnceListener.
       */
      proto.once = alias('addOnceListener');

      /**
       * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
       * You need to tell it what event names should be matched by a regex.
       *
       * @param {String} evt Name of the event to create.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.defineEvent = function defineEvent(evt) {
          this.getListeners(evt);
          return this;
      };

      /**
       * Uses defineEvent to define multiple events.
       *
       * @param {String[]} evts An array of event names to define.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.defineEvents = function defineEvents(evts) {
          for (var i = 0; i < evts.length; i += 1) {
              this.defineEvent(evts[i]);
          }
          return this;
      };

      /**
       * Removes a listener function from the specified event.
       * When passed a regular expression as the event name, it will remove the listener from all events that match it.
       *
       * @param {String|RegExp} evt Name of the event to remove the listener from.
       * @param {Function} listener Method to remove from the event.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.removeListener = function removeListener(evt, listener) {
          var listeners = this.getListenersAsObject(evt);
          var index;
          var key;

          for (key in listeners) {
              if (listeners.hasOwnProperty(key)) {
                  index = indexOfListener(listeners[key], listener);

                  if (index !== -1) {
                      listeners[key].splice(index, 1);
                  }
              }
          }

          return this;
      };

      /**
       * Alias of removeListener
       */
      proto.off = alias('removeListener');

      /**
       * Adds listeners in bulk using the manipulateListeners method.
       * If you pass an object as the first argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
       * You can also pass it a regular expression to add the array of listeners to all events that match it.
       * Yeah, this function does quite a bit. That's probably a bad thing.
       *
       * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
       * @param {Function[]} [listeners] An optional array of listener functions to add.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.addListeners = function addListeners(evt, listeners) {
          // Pass through to manipulateListeners
          return this.manipulateListeners(false, evt, listeners);
      };

      /**
       * Removes listeners in bulk using the manipulateListeners method.
       * If you pass an object as the first argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
       * You can also pass it an event name and an array of listeners to be removed.
       * You can also pass it a regular expression to remove the listeners from all events that match it.
       *
       * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
       * @param {Function[]} [listeners] An optional array of listener functions to remove.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.removeListeners = function removeListeners(evt, listeners) {
          // Pass through to manipulateListeners
          return this.manipulateListeners(true, evt, listeners);
      };

      /**
       * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
       * The first argument will determine if the listeners are removed (true) or added (false).
       * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
       * You can also pass it an event name and an array of listeners to be added/removed.
       * You can also pass it a regular expression to manipulate the listeners of all events that match it.
       *
       * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
       * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
       * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
          var i;
          var value;
          var single = remove ? this.removeListener : this.addListener;
          var multiple = remove ? this.removeListeners : this.addListeners;

          // If evt is an object then pass each of its properties to this method
          if (typeof evt === 'object' && !(evt instanceof RegExp)) {
              for (i in evt) {
                  if (evt.hasOwnProperty(i) && (value = evt[i])) {
                      // Pass the single listener straight through to the singular method
                      if (typeof value === 'function') {
                          single.call(this, i, value);
                      }
                      else {
                          // Otherwise pass back to the multiple function
                          multiple.call(this, i, value);
                      }
                  }
              }
          }
          else {
              // So evt must be a string
              // And listeners must be an array of listeners
              // Loop over it and pass each one to the multiple method
              i = listeners.length;
              while (i--) {
                  single.call(this, evt, listeners[i]);
              }
          }

          return this;
      };

      /**
       * Removes all listeners from a specified event.
       * If you do not specify an event then all listeners will be removed.
       * That means every event will be emptied.
       * You can also pass a regex to remove all events that match it.
       *
       * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.removeEvent = function removeEvent(evt) {
          var type = typeof evt;
          var events = this._getEvents();
          var key;

          // Remove different things depending on the state of evt
          if (type === 'string') {
              // Remove all listeners for the specified event
              delete events[evt];
          }
          else if (evt instanceof RegExp) {
              // Remove all events matching the regex.
              for (key in events) {
                  if (events.hasOwnProperty(key) && evt.test(key)) {
                      delete events[key];
                  }
              }
          }
          else {
              // Remove all listeners in all events
              delete this._events;
          }

          return this;
      };

      /**
       * Alias of removeEvent.
       *
       * Added to mirror the node API.
       */
      proto.removeAllListeners = alias('removeEvent');

      /**
       * Emits an event of your choice.
       * When emitted, every listener attached to that event will be executed.
       * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
       * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
       * So they will not arrive within the array on the other side, they will be separate.
       * You can also pass a regular expression to emit to all events that match it.
       *
       * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
       * @param {Array} [args] Optional array of arguments to be passed to each listener.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.emitEvent = function emitEvent(evt, args) {
          var listenersMap = this.getListenersAsObject(evt);
          var listeners;
          var listener;
          var i;
          var key;
          var response;

          for (key in listenersMap) {
              if (listenersMap.hasOwnProperty(key)) {
                  listeners = listenersMap[key].slice(0);

                  for (i = 0; i < listeners.length; i++) {
                      // If the listener returns true then it shall be removed from the event
                      // The function is executed either with a basic call or an apply if there is an args array
                      listener = listeners[i];

                      if (listener.once === true) {
                          this.removeListener(evt, listener.listener);
                      }

                      response = listener.listener.apply(this, args || []);

                      if (response === this._getOnceReturnValue()) {
                          this.removeListener(evt, listener.listener);
                      }
                  }
              }
          }

          return this;
      };

      /**
       * Alias of emitEvent
       */
      proto.trigger = alias('emitEvent');

      /**
       * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
       * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
       *
       * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
       * @param {...*} Optional additional arguments to be passed to each listener.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.emit = function emit(evt) {
          var args = Array.prototype.slice.call(arguments, 1);
          return this.emitEvent(evt, args);
      };

      /**
       * Sets the current value to check against when executing listeners. If a
       * listeners return value matches the one set here then it will be removed
       * after execution. This value defaults to true.
       *
       * @param {*} value The new value to check for when executing listeners.
       * @return {Object} Current instance of EventEmitter for chaining.
       */
      proto.setOnceReturnValue = function setOnceReturnValue(value) {
          this._onceReturnValue = value;
          return this;
      };

      /**
       * Fetches the current value to check against when executing listeners. If
       * the listeners return value matches this one then it should be removed
       * automatically. It will return true by default.
       *
       * @return {*|Boolean} The current value to check for or the default, true.
       * @api private
       */
      proto._getOnceReturnValue = function _getOnceReturnValue() {
          if (this.hasOwnProperty('_onceReturnValue')) {
              return this._onceReturnValue;
          }
          else {
              return true;
          }
      };

      /**
       * Fetches the events object and creates one if required.
       *
       * @return {Object} The events storage object.
       * @api private
       */
      proto._getEvents = function _getEvents() {
          return this._events || (this._events = {});
      };

      /**
       * Reverts the global {@link EventEmitter} to its previous value and returns a reference to this version.
       *
       * @return {Function} Non conflicting EventEmitter class.
       */
      EventEmitter.noConflict = function noConflict() {
          exports.EventEmitter = originalGlobalValue;
          return EventEmitter;
      };

      // Expose the class either via AMD, CommonJS or the global object
      if (true) {
          !(__WEBPACK_AMD_DEFINE_RESULT__ = (function () {
              return EventEmitter;
          }).call(exports, __webpack_require__, exports, module),
          __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
      }
      else {}
  }(typeof window !== 'undefined' ? window : this || {}));


  /***/ }),
  /* 2 */
  /***/ (function(module, exports, __webpack_require__) {

  module.exports = __webpack_require__(3);

  /***/ }),
  /* 3 */
  /***/ (function(module, exports, __webpack_require__) {

  /* WEBPACK VAR INJECTION */(function(Buffer) {(function (exports, ByteArray, global) {
    var Protocol = exports;
    var PKG_HEAD_BYTES = 4;
    var MSG_FLAG_BYTES = 1;
    var MSG_ROUTE_CODE_BYTES = 2;
    var MSG_ID_MAX_BYTES = 5;
    var MSG_ROUTE_LEN_BYTES = 1;
    var MSG_ROUTE_CODE_MAX = 0xffff;
    var MSG_COMPRESS_ROUTE_MASK = 0x1;
    var MSG_COMPRESS_GZIP_MASK = 0x1;
    var MSG_COMPRESS_GZIP_ENCODE_MASK = 1 << 4;
    var MSG_TYPE_MASK = 0x7;
    var Package = Protocol.Package = {};
    var Message = Protocol.Message = {};
    Package.TYPE_HANDSHAKE = 1;
    Package.TYPE_HANDSHAKE_ACK = 2;
    Package.TYPE_HEARTBEAT = 3;
    Package.TYPE_DATA = 4;
    Package.TYPE_KICK = 5;
    Message.TYPE_REQUEST = 0;
    Message.TYPE_NOTIFY = 1;
    Message.TYPE_RESPONSE = 2;
    Message.TYPE_PUSH = 3;
    /**
     * pomele client encode
     * id message id
     * route message route
     * msg message body
     * socketio current support string
     */

    Protocol.strencode = function (str) {
      if (typeof Buffer !== "undefined" && ByteArray === Buffer) {
        // encoding defaults to 'utf8'
        return new Buffer(str);
      } else {
        var byteArray = new ByteArray(str.length * 3);
        var offset = 0;

        for (var i = 0; i < str.length; i++) {
          var charCode = str.charCodeAt(i);
          var codes = null;

          if (charCode <= 0x7f) {
            codes = [charCode];
          } else if (charCode <= 0x7ff) {
            codes = [0xc0 | charCode >> 6, 0x80 | charCode & 0x3f];
          } else {
            codes = [0xe0 | charCode >> 12, 0x80 | (charCode & 0xfc0) >> 6, 0x80 | charCode & 0x3f];
          }

          for (var j = 0; j < codes.length; j++) {
            byteArray[offset] = codes[j];
            ++offset;
          }
        }

        var _buffer = new ByteArray(offset);

        copyArray(_buffer, 0, byteArray, 0, offset);
        return _buffer;
      }
    };
    /**
     * client decode
     * msg String data
     * return Message Object
     */


    Protocol.strdecode = function (buffer) {
      if (typeof Buffer !== "undefined" && ByteArray === Buffer) {
        // encoding defaults to 'utf8'
        return buffer.toString();
      } else {
        var bytes = new ByteArray(buffer);
        var array = [];
        var offset = 0;
        var charCode = 0;
        var end = bytes.length;

        while (offset < end) {
          if (bytes[offset] < 128) {
            charCode = bytes[offset];
            offset += 1;
          } else if (bytes[offset] < 224) {
            charCode = ((bytes[offset] & 0x1f) << 6) + (bytes[offset + 1] & 0x3f);
            offset += 2;
          } else {
            charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
            offset += 3;
          }

          array.push(charCode);
        }

        return String.fromCharCode.apply(null, array); // -===== for ws: DIFF by @olemop/core template build.js/build.js.wss，除协议符，两者就这里不同，实际上，上面就够了 =====-
        // let res = ''
        // const chunk = 8 * 1024
        // for (let i = 0; i < array.length / chunk; i++) {
        //   res += String.fromCharCode.apply(null, array.slice(i * chunk, (i + 1) * chunk))
        // }
        // res += String.fromCharCode.apply(null, array.slice(i * chunk))
        // return res
      }
    };
    /**
     * Package protocol encode.
     *
     * Olemop package format:
     * +------+-------------+------------------+
     * | type | body length |       body       |
     * +------+-------------+------------------+
     *
     * Head: 4bytes
     *   0: package type,
     *      1 - handshake,
     *      2 - handshake ack,
     *      3 - heartbeat,
     *      4 - data
     *      5 - kick
     *   1 - 3: big-endian body length
     * Body: body length bytes
     *
     * @param  {number}    type   package type
     * @param  {ByteArray} body   body content in bytes
     * @returns {ByteArray}        new byte array that contains encode result
     */


    Package.encode = function (type, body) {
      var length = body ? body.length : 0;
      var buffer = new ByteArray(PKG_HEAD_BYTES + length);
      var index = 0;
      buffer[index++] = type & 0xff;
      buffer[index++] = length >> 16 & 0xff;
      buffer[index++] = length >> 8 & 0xff;
      buffer[index++] = length & 0xff;

      if (body) {
        copyArray(buffer, index, body, 0, length);
      }

      return buffer;
    };
    /**
     * Package protocol decode.
     * See encode for package format.
     *
     * @param  {ByteArray} buffer byte array containing package content
     * @returns {Object}           {type: package type, buffer: body byte array}
     */


    Package.decode = function (buffer) {
      var offset = 0;
      var bytes = new ByteArray(buffer);
      var length = 0;
      var rs = [];

      while (offset < bytes.length) {
        var type = bytes[offset++];
        length = (bytes[offset++] << 16 | bytes[offset++] << 8 | bytes[offset++]) >>> 0;
        var body = length ? new ByteArray(length) : null;

        if (body) {
          copyArray(body, 0, bytes, offset, length);
        }

        offset += length;
        rs.push({
          'type': type,
          'body': body
        });
      }

      return rs.length === 1 ? rs[0] : rs;
    };
    /**
     * Message protocol encode.
     *
     * @param  {number} id            message id
     * @param  {number} type          message type
     * @param  {number} compressRoute whether compress route
     * @param  {number|string} route  route code or route string
     * @param  {Buffer} msg           message body bytes
     * @returns {Buffer}               encode result
     */


    Message.encode = function (id, type, compressRoute, route, msg, compressGzip) {
      // caculate message max length
      var idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0;
      var msgLen = MSG_FLAG_BYTES + idBytes;

      if (msgHasRoute(type)) {
        if (compressRoute) {
          if (typeof route !== 'number') {
            throw new Error('error flag for number route!');
          }

          msgLen += MSG_ROUTE_CODE_BYTES;
        } else {
          msgLen += MSG_ROUTE_LEN_BYTES;

          if (route) {
            route = Protocol.strencode(route);

            if (route.length > 255) {
              throw new Error('route maxlength is overflow');
            }

            msgLen += route.length;
          }
        }
      }

      if (msg) {
        msgLen += msg.length;
      }

      var buffer = new ByteArray(msgLen);
      var offset = 0; // add flag

      offset = encodeMsgFlag(type, compressRoute, buffer, offset, compressGzip); // add message id

      if (msgHasId(type)) {
        offset = encodeMsgId(id, buffer, offset);
      } // add route


      if (msgHasRoute(type)) {
        offset = encodeMsgRoute(compressRoute, route, buffer, offset);
      } // add body


      if (msg) {
        offset = encodeMsgBody(msg, buffer, offset);
      }

      return buffer;
    };
    /**
     * Message protocol decode.
     *
     * @param  {Buffer|Uint8Array} buffer message bytes
     * @returns {Object}            message object
     */


    Message.decode = function (buffer) {
      var bytes = new ByteArray(buffer);
      var bytesLen = bytes.length || bytes.byteLength;
      var offset = 0;
      var id = 0;
      var route = null; // parse flag

      var flag = bytes[offset++];
      var compressRoute = flag & MSG_COMPRESS_ROUTE_MASK;
      var type = flag >> 1 & MSG_TYPE_MASK;
      var compressGzip = flag >> 4 & MSG_COMPRESS_GZIP_MASK; // parse id

      if (msgHasId(type)) {
        var m = 0;
        var i = 0;

        do {
          m = parseInt(bytes[offset]);
          id += (m & 0x7f) << 7 * i;
          offset++;
          i++;
        } while (m >= 128);
      } // parse route


      if (msgHasRoute(type)) {
        if (compressRoute) {
          route = bytes[offset++] << 8 | bytes[offset++];
        } else {
          var routeLen = bytes[offset++];

          if (routeLen) {
            route = new ByteArray(routeLen);
            copyArray(route, 0, bytes, offset, routeLen);
            route = Protocol.strdecode(route);
          } else {
            route = '';
          }

          offset += routeLen;
        }
      } // parse body


      var bodyLen = bytesLen - offset;
      var body = new ByteArray(bodyLen);
      copyArray(body, 0, bytes, offset, bodyLen);
      return {
        'id': id,
        'type': type,
        'compressRoute': compressRoute,
        'route': route,
        'body': body,
        'compressGzip': compressGzip
      };
    };

    var copyArray = function (dest, doffset, src, soffset, length) {
      if ('function' === typeof src.copy) {
        // Buffer
        src.copy(dest, doffset, soffset, soffset + length);
      } else {
        // Uint8Array
        for (var index = 0; index < length; index++) {
          dest[doffset++] = src[soffset++];
        }
      }
    };

    var msgHasId = function (type) {
      return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
    };

    var msgHasRoute = function (type) {
      return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY || type === Message.TYPE_PUSH;
    };

    var caculateMsgIdBytes = function (id) {
      var len = 0;

      do {
        len += 1;
        id >>= 7;
      } while (id > 0);

      return len;
    };

    var encodeMsgFlag = function (type, compressRoute, buffer, offset, compressGzip) {
      if (type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY && type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) {
        throw new Error('unkonw message type: ' + type);
      }

      buffer[offset] = type << 1 | (compressRoute ? 1 : 0);

      if (compressGzip) {
        buffer[offset] = buffer[offset] | MSG_COMPRESS_GZIP_ENCODE_MASK;
      }

      return offset + MSG_FLAG_BYTES;
    };

    var encodeMsgId = function (id, buffer, offset) {
      do {
        var tmp = id % 128;
        var next = Math.floor(id / 128);

        if (next !== 0) {
          tmp = tmp + 128;
        }

        buffer[offset++] = tmp;
        id = next;
      } while (id !== 0);

      return offset;
    };

    var encodeMsgRoute = function (compressRoute, route, buffer, offset) {
      if (compressRoute) {
        if (route > MSG_ROUTE_CODE_MAX) {
          throw new Error('route number is overflow');
        }

        buffer[offset++] = route >> 8 & 0xff;
        buffer[offset++] = route & 0xff;
      } else {
        if (route) {
          buffer[offset++] = route.length & 0xff;
          copyArray(buffer, offset, route, 0, route.length);
          offset += route.length;
        } else {
          buffer[offset++] = 0;
        }
      }

      return offset;
    };

    var encodeMsgBody = function (msg, buffer, offset) {
      copyArray(buffer, offset, msg, 0, msg.length);
      return offset + msg.length;
    };

    module.exports = Protocol;

    if (typeof window != "undefined") {
      window.Protocol = Protocol;
    }
  })(typeof window == "undefined" ? module.exports : this.Protocol = {}, typeof window == "undefined" ? Buffer : Uint8Array, this);
  /* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(4).Buffer))

  /***/ }),
  /* 4 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";
  /* WEBPACK VAR INJECTION */(function(global) {/*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */



  var base64 = __webpack_require__(6)
  var ieee754 = __webpack_require__(7)
  var isArray = __webpack_require__(8)

  exports.Buffer = Buffer
  exports.SlowBuffer = SlowBuffer
  exports.INSPECT_MAX_BYTES = 50

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.

   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
    ? global.TYPED_ARRAY_SUPPORT
    : typedArraySupport()

  /*
   * Export kMaxLength after typed array support is determined.
   */
  exports.kMaxLength = kMaxLength()

  function typedArraySupport () {
    try {
      var arr = new Uint8Array(1)
      arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
      return arr.foo() === 42 && // typed array instances can be augmented
          typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
          arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
    } catch (e) {
      return false
    }
  }

  function kMaxLength () {
    return Buffer.TYPED_ARRAY_SUPPORT
      ? 0x7fffffff
      : 0x3fffffff
  }

  function createBuffer (that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length)
      that.__proto__ = Buffer.prototype
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer(length)
      }
      that.length = length
    }

    return that
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer (arg, encodingOrOffset, length) {
    if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
      return new Buffer(arg, encodingOrOffset, length)
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(this, arg)
    }
    return from(this, arg, encodingOrOffset, length)
  }

  Buffer.poolSize = 8192 // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer._augment = function (arr) {
    arr.__proto__ = Buffer.prototype
    return arr
  }

  function from (that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset)
    }

    return fromObject(that, value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    Buffer.prototype.__proto__ = Uint8Array.prototype
    Buffer.__proto__ = Uint8Array
    if (typeof Symbol !== 'undefined' && Symbol.species &&
        Buffer[Symbol.species] === Buffer) {
      // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
      Object.defineProperty(Buffer, Symbol.species, {
        value: null,
        configurable: true
      })
    }
  }

  function assertSize (size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc (that, size, fill, encoding) {
    assertSize(size)
    if (size <= 0) {
      return createBuffer(that, size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(that, size).fill(fill, encoding)
        : createBuffer(that, size).fill(fill)
    }
    return createBuffer(that, size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  }

  function allocUnsafe (that, size) {
    assertSize(size)
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
    if (!Buffer.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  }
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  }

  function fromString (that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8'
    }

    if (!Buffer.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength(string, encoding) | 0
    that = createBuffer(that, length)

    var actual = that.write(string, encoding)

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual)
    }

    return that
  }

  function fromArrayLike (that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0
    that = createBuffer(that, length)
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255
    }
    return that
  }

  function fromArrayBuffer (that, array, byteOffset, length) {
    array.byteLength // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('\'offset\' is out of bounds')
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('\'length\' is out of bounds')
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array)
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset)
    } else {
      array = new Uint8Array(array, byteOffset, length)
    }

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array
      that.__proto__ = Buffer.prototype
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array)
    }
    return that
  }

  function fromObject (that, obj) {
    if (Buffer.isBuffer(obj)) {
      var len = checked(obj.length) | 0
      that = createBuffer(that, len)

      if (that.length === 0) {
        return that
      }

      obj.copy(that, 0, 0, len)
      return that
    }

    if (obj) {
      if ((typeof ArrayBuffer !== 'undefined' &&
          obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0)
        }
        return fromArrayLike(that, obj)
      }

      if (obj.type === 'Buffer' && isArray(obj.data)) {
        return fromArrayLike(that, obj.data)
      }
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
  }

  function checked (length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                           'size: 0x' + kMaxLength().toString(16) + ' bytes')
    }
    return length | 0
  }

  function SlowBuffer (length) {
    if (+length != length) { // eslint-disable-line eqeqeq
      length = 0
    }
    return Buffer.alloc(+length)
  }

  Buffer.isBuffer = function isBuffer (b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer.compare = function compare (a, b) {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length
    var y = b.length

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i]
        y = b[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  Buffer.isEncoding = function isEncoding (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  }

  Buffer.concat = function concat (list, length) {
    if (!isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer.alloc(0)
    }

    var i
    if (length === undefined) {
      length = 0
      for (i = 0; i < list.length; ++i) {
        length += list[i].length
      }
    }

    var buffer = Buffer.allocUnsafe(length)
    var pos = 0
    for (i = 0; i < list.length; ++i) {
      var buf = list[i]
      if (!Buffer.isBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos)
      pos += buf.length
    }
    return buffer
  }

  function byteLength (string, encoding) {
    if (Buffer.isBuffer(string)) {
      return string.length
    }
    if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
        (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string
    }

    var len = string.length
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }
  Buffer.byteLength = byteLength

  function slowToString (encoding, start, end) {
    var loweredCase = false

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0
    start >>>= 0

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8'

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase()
          loweredCase = true
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer.prototype._isBuffer = true

  function swap (b, n, m) {
    var i = b[n]
    b[n] = b[m]
    b[m] = i
  }

  Buffer.prototype.swap16 = function swap16 () {
    var len = this.length
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1)
    }
    return this
  }

  Buffer.prototype.swap32 = function swap32 () {
    var len = this.length
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3)
      swap(this, i + 1, i + 2)
    }
    return this
  }

  Buffer.prototype.swap64 = function swap64 () {
    var len = this.length
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7)
      swap(this, i + 1, i + 6)
      swap(this, i + 2, i + 5)
      swap(this, i + 3, i + 4)
    }
    return this
  }

  Buffer.prototype.toString = function toString () {
    var length = this.length | 0
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  }

  Buffer.prototype.equals = function equals (b) {
    if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer.compare(this, b) === 0
  }

  Buffer.prototype.inspect = function inspect () {
    var str = ''
    var max = exports.INSPECT_MAX_BYTES
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
      if (this.length > max) str += ' ... '
    }
    return '<Buffer ' + str + '>'
  }

  Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
    if (!Buffer.isBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0
    }
    if (end === undefined) {
      end = target ? target.length : 0
    }
    if (thisStart === undefined) {
      thisStart = 0
    }
    if (thisEnd === undefined) {
      thisEnd = this.length
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0
    end >>>= 0
    thisStart >>>= 0
    thisEnd >>>= 0

    if (this === target) return 0

    var x = thisEnd - thisStart
    var y = end - start
    var len = Math.min(x, y)

    var thisCopy = this.slice(thisStart, thisEnd)
    var targetCopy = target.slice(start, end)

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i]
        y = targetCopy[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset
      byteOffset = 0
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000
    }
    byteOffset = +byteOffset  // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : (buffer.length - 1)
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding)
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (Buffer.isBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xFF // Search for a byte value [0-255]
      if (Buffer.TYPED_ARRAY_SUPPORT &&
          typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
    var indexSize = 1
    var arrLength = arr.length
    var valLength = val.length

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase()
      if (encoding === 'ucs2' || encoding === 'ucs-2' ||
          encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2
        arrLength /= 2
        valLength /= 2
        byteOffset /= 2
      }
    }

    function read (buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i
    if (dir) {
      var foundIndex = -1
      for (i = byteOffset; i < arrLength; i++) {
        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex
          foundIndex = -1
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
      for (i = byteOffset; i >= 0; i--) {
        var found = true
        for (var j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  }

  Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  }

  Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  }

  function hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0
    var remaining = buf.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }

    // must be an even number of digits
    var strLen = string.length
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16)
      if (isNaN(parsed)) return i
      buf[offset + i] = parsed
    }
    return i
  }

  function utf8Write (buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  }

  function asciiWrite (buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write (buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write (buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write (buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  }

  Buffer.prototype.write = function write (string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8'
      length = this.length
      offset = 0
    // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset
      length = this.length
      offset = 0
    // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0
      if (isFinite(length)) {
        length = length | 0
        if (encoding === undefined) encoding = 'utf8'
      } else {
        encoding = length
        length = undefined
      }
    // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset
    if (length === undefined || length > remaining) length = remaining

    if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8'

    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }

  Buffer.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  }

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return base64.fromByteArray(buf)
    } else {
      return base64.fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice (buf, start, end) {
    end = Math.min(buf.length, end)
    var res = []

    var i = start
    while (i < end) {
      var firstByte = buf[i]
      var codePoint = null
      var bytesPerSequence = (firstByte > 0xEF) ? 4
        : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
        : 1

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte
            }
            break
          case 2:
            secondByte = buf[i + 1]
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint
              }
            }
            break
          case 3:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint
              }
            }
            break
          case 4:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            fourthByte = buf[i + 3]
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD
        bytesPerSequence = 1
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000
        res.push(codePoint >>> 10 & 0x3FF | 0xD800)
        codePoint = 0xDC00 | codePoint & 0x3FF
      }

      res.push(codePoint)
      i += bytesPerSequence
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000

  function decodeCodePointsArray (codePoints) {
    var len = codePoints.length
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = ''
    var i = 0
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
      )
    }
    return res
  }

  function asciiSlice (buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F)
    }
    return ret
  }

  function latin1Slice (buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i])
    }
    return ret
  }

  function hexSlice (buf, start, end) {
    var len = buf.length

    if (!start || start < 0) start = 0
    if (!end || end < 0 || end > len) end = len

    var out = ''
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i])
    }
    return out
  }

  function utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end)
    var res = ''
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
    }
    return res
  }

  Buffer.prototype.slice = function slice (start, end) {
    var len = this.length
    start = ~~start
    end = end === undefined ? len : ~~end

    if (start < 0) {
      start += len
      if (start < 0) start = 0
    } else if (start > len) {
      start = len
    }

    if (end < 0) {
      end += len
      if (end < 0) end = 0
    } else if (end > len) {
      end = len
    }

    if (end < start) end = start

    var newBuf
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end)
      newBuf.__proto__ = Buffer.prototype
    } else {
      var sliceLen = end - start
      newBuf = new Buffer(sliceLen, undefined)
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start]
      }
    }

    return newBuf
  }

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset (offset, ext, length) {
    if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }

    return val
  }

  Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length)
    }

    var val = this[offset + --byteLength]
    var mul = 1
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul
    }

    return val
  }

  Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length)
    return this[offset]
  }

  Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    return this[offset] | (this[offset + 1] << 8)
  }

  Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    return (this[offset] << 8) | this[offset + 1]
  }

  Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  }

  Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  }

  Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var i = byteLength
    var mul = 1
    var val = this[offset + --i]
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length)
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  }

  Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset] | (this[offset + 1] << 8)
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  }

  Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset + 1] | (this[offset] << 8)
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  }

  Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  }

  Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  }

  Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)
    return ieee754.read(this, offset, true, 23, 4)
  }

  Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)
    return ieee754.read(this, offset, false, 23, 4)
  }

  Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length)
    return ieee754.read(this, offset, true, 52, 8)
  }

  Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length)
    return ieee754.read(this, offset, false, 52, 8)
  }

  function checkInt (buf, value, offset, ext, max, min) {
    if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var mul = 1
    var i = 0
    this[offset] = value & 0xFF
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var i = byteLength - 1
    var mul = 1
    this[offset + i] = value & 0xFF
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
    this[offset] = (value & 0xff)
    return offset + 1
  }

  function objectWriteUInt16 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        (littleEndian ? i : 1 - i) * 8
    }
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff)
      this[offset + 1] = (value >>> 8)
    } else {
      objectWriteUInt16(this, value, offset, true)
    }
    return offset + 2
  }

  Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8)
      this[offset + 1] = (value & 0xff)
    } else {
      objectWriteUInt16(this, value, offset, false)
    }
    return offset + 2
  }

  function objectWriteUInt32 (buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
    }
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = (value >>> 24)
      this[offset + 2] = (value >>> 16)
      this[offset + 1] = (value >>> 8)
      this[offset] = (value & 0xff)
    } else {
      objectWriteUInt32(this, value, offset, true)
    }
    return offset + 4
  }

  Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24)
      this[offset + 1] = (value >>> 16)
      this[offset + 2] = (value >>> 8)
      this[offset + 3] = (value & 0xff)
    } else {
      objectWriteUInt32(this, value, offset, false)
    }
    return offset + 4
  }

  Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = 0
    var mul = 1
    var sub = 0
    this[offset] = value & 0xFF
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = byteLength - 1
    var mul = 1
    var sub = 0
    this[offset + i] = value & 0xFF
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1
      }
      this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
    }

    return offset + byteLength
  }

  Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
    if (value < 0) value = 0xff + value + 1
    this[offset] = (value & 0xff)
    return offset + 1
  }

  Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff)
      this[offset + 1] = (value >>> 8)
    } else {
      objectWriteUInt16(this, value, offset, true)
    }
    return offset + 2
  }

  Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8)
      this[offset + 1] = (value & 0xff)
    } else {
      objectWriteUInt16(this, value, offset, false)
    }
    return offset + 2
  }

  Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff)
      this[offset + 1] = (value >>> 8)
      this[offset + 2] = (value >>> 16)
      this[offset + 3] = (value >>> 24)
    } else {
      objectWriteUInt32(this, value, offset, true)
    }
    return offset + 4
  }

  Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    if (value < 0) value = 0xffffffff + value + 1
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24)
      this[offset + 1] = (value >>> 16)
      this[offset + 2] = (value >>> 8)
      this[offset + 3] = (value & 0xff)
    } else {
      objectWriteUInt32(this, value, offset, false)
    }
    return offset + 4
  }

  function checkIEEE754 (buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
    }
    ieee754.write(buf, value, offset, littleEndian, 23, 4)
    return offset + 4
  }

  Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  }

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
    }
    ieee754.write(buf, value, offset, littleEndian, 52, 8)
    return offset + 8
  }

  Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  }

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function copy (target, targetStart, start, end) {
    if (!start) start = 0
    if (!end && end !== 0) end = this.length
    if (targetStart >= target.length) targetStart = target.length
    if (!targetStart) targetStart = 0
    if (end > 0 && end < start) end = start

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start
    }

    var len = end - start
    var i

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start]
      }
    } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start]
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, start + len),
        targetStart
      )
    }

    return len
  }

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer.prototype.fill = function fill (val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start
        start = 0
        end = this.length
      } else if (typeof end === 'string') {
        encoding = end
        end = this.length
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0)
        if (code < 256) {
          val = code
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
    } else if (typeof val === 'number') {
      val = val & 255
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0
    end = end === undefined ? this.length : end >>> 0

    if (!val) val = 0

    var i
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val
      }
    } else {
      var bytes = Buffer.isBuffer(val)
        ? val
        : utf8ToBytes(new Buffer(val, encoding).toString())
      var len = bytes.length
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len]
      }
    }

    return this
  }

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

  function base64clean (str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '')
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '='
    }
    return str
  }

  function stringtrim (str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (string, units) {
    units = units || Infinity
    var codePoint
    var length = string.length
    var leadSurrogate = null
    var bytes = []

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i)

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
            continue
          }

          // valid lead
          leadSurrogate = codePoint

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      }

      leadSurrogate = null

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint)
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push(
          codePoint >> 0x6 | 0xC0,
          codePoint & 0x3F | 0x80
        )
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          codePoint >> 0xC | 0xE0,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        )
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          codePoint >> 0x12 | 0xF0,
          codePoint >> 0xC & 0x3F | 0x80,
          codePoint >> 0x6 & 0x3F | 0x80,
          codePoint & 0x3F | 0x80
        )
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes (str) {
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF)
    }
    return byteArray
  }

  function utf16leToBytes (str, units) {
    var c, hi, lo
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i)
      hi = c >> 8
      lo = c % 256
      byteArray.push(lo)
      byteArray.push(hi)
    }

    return byteArray
  }

  function base64ToBytes (str) {
    return base64.toByteArray(base64clean(str))
  }

  function blitBuffer (src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if ((i + offset >= dst.length) || (i >= src.length)) break
      dst[i + offset] = src[i]
    }
    return i
  }

  function isnan (val) {
    return val !== val // eslint-disable-line no-self-compare
  }

  /* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(5)))

  /***/ }),
  /* 5 */
  /***/ (function(module, exports) {

  var g;

  // This works in non-strict mode
  g = (function() {
    return this;
  })();

  try {
    // This works if eval is allowed (see CSP)
    g = g || Function("return this")() || (1, eval)("this");
  } catch (e) {
    // This works if the window reference is available
    if (typeof window === "object") g = window;
  }

  // g can still be undefined, but nothing to do about it...
  // We return undefined, instead of nothing here, so it's
  // easier to handle this case. if(!global) { ...}

  module.exports = g;


  /***/ }),
  /* 6 */
  /***/ (function(module, exports, __webpack_require__) {

  "use strict";


  exports.byteLength = byteLength
  exports.toByteArray = toByteArray
  exports.fromByteArray = fromByteArray

  var lookup = []
  var revLookup = []
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  // Support decoding URL-safe base64 strings, as Node.js does.
  // See: https://en.wikipedia.org/wiki/Base64#URL_applications
  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63

  function getLens (b64) {
    var len = b64.length

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // Trim off extra bytes after placeholder bytes are found
    // See: https://github.com/beatgammit/base64-js/issues/42
    var validLen = b64.indexOf('=')
    if (validLen === -1) validLen = len

    var placeHoldersLen = validLen === len
      ? 0
      : 4 - (validLen % 4)

    return [validLen, placeHoldersLen]
  }

  // base64 is 4/3 + up to two characters of the original data
  function byteLength (b64) {
    var lens = getLens(b64)
    var validLen = lens[0]
    var placeHoldersLen = lens[1]
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function _byteLength (b64, validLen, placeHoldersLen) {
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function toByteArray (b64) {
    var tmp
    var lens = getLens(b64)
    var validLen = lens[0]
    var placeHoldersLen = lens[1]

    var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

    var curByte = 0

    // if there are placeholders, only get up to the last complete 4 chars
    var len = placeHoldersLen > 0
      ? validLen - 4
      : validLen

    for (var i = 0; i < len; i += 4) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 18) |
        (revLookup[b64.charCodeAt(i + 1)] << 12) |
        (revLookup[b64.charCodeAt(i + 2)] << 6) |
        revLookup[b64.charCodeAt(i + 3)]
      arr[curByte++] = (tmp >> 16) & 0xFF
      arr[curByte++] = (tmp >> 8) & 0xFF
      arr[curByte++] = tmp & 0xFF
    }

    if (placeHoldersLen === 2) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 2) |
        (revLookup[b64.charCodeAt(i + 1)] >> 4)
      arr[curByte++] = tmp & 0xFF
    }

    if (placeHoldersLen === 1) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 10) |
        (revLookup[b64.charCodeAt(i + 1)] << 4) |
        (revLookup[b64.charCodeAt(i + 2)] >> 2)
      arr[curByte++] = (tmp >> 8) & 0xFF
      arr[curByte++] = tmp & 0xFF
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] +
      lookup[num >> 12 & 0x3F] +
      lookup[num >> 6 & 0x3F] +
      lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp
    var output = []
    for (var i = start; i < end; i += 3) {
      tmp =
        ((uint8[i] << 16) & 0xFF0000) +
        ((uint8[i + 1] << 8) & 0xFF00) +
        (uint8[i + 2] & 0xFF)
      output.push(tripletToBase64(tmp))
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    var tmp
    var len = uint8.length
    var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
    var parts = []
    var maxChunkLength = 16383 // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(
        uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
      ))
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1]
      parts.push(
        lookup[tmp >> 2] +
        lookup[(tmp << 4) & 0x3F] +
        '=='
      )
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1]
      parts.push(
        lookup[tmp >> 10] +
        lookup[(tmp >> 4) & 0x3F] +
        lookup[(tmp << 2) & 0x3F] +
        '='
      )
    }

    return parts.join('')
  }


  /***/ }),
  /* 7 */
  /***/ (function(module, exports) {

  exports.read = function (buffer, offset, isLE, mLen, nBytes) {
    var e, m
    var eLen = (nBytes * 8) - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var nBits = -7
    var i = isLE ? (nBytes - 1) : 0
    var d = isLE ? -1 : 1
    var s = buffer[offset + i]

    i += d

    e = s & ((1 << (-nBits)) - 1)
    s >>= (-nBits)
    nBits += eLen
    for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1)
    e >>= (-nBits)
    nBits += mLen
    for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen)
      e = e - eBias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c
    var eLen = (nBytes * 8) - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
    var i = isLE ? 0 : (nBytes - 1)
    var d = isLE ? 1 : -1
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

    value = Math.abs(value)

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0
      e = eMax
    } else {
      e = Math.floor(Math.log(value) / Math.LN2)
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--
        c *= 2
      }
      if (e + eBias >= 1) {
        value += rt / c
      } else {
        value += rt * Math.pow(2, 1 - eBias)
      }
      if (value * c >= 2) {
        e++
        c /= 2
      }

      if (e + eBias >= eMax) {
        m = 0
        e = eMax
      } else if (e + eBias >= 1) {
        m = ((value * c) - 1) * Math.pow(2, mLen)
        e = e + eBias
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
        e = 0
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m
    eLen += mLen
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128
  }


  /***/ }),
  /* 8 */
  /***/ (function(module, exports) {

  var toString = {}.toString;

  module.exports = Array.isArray || function (arr) {
    return toString.call(arr) == '[object Array]';
  };


  /***/ }),
  /* 9 */
  /***/ (function(module, exports) {

  /* ProtocolBuffer client 0.1.0*/

  /**
   * olemop-protobuf
   */

  /**
   * Protocol buffer root
   * In browser, it will be window.protbuf
   */
  (function (exports, global) {
    var Protobuf = exports;

    Protobuf.init = function (opts) {
      // On the serverside, use serverProtos to encode messages send to client
      Protobuf.encoder.init(opts.encoderProtos); // On the serverside, user clientProtos to decode messages receive from clients

      Protobuf.decoder.init(opts.decoderProtos);
    };

    Protobuf.encode = function (key, msg) {
      return Protobuf.encoder.encode(key, msg);
    };

    Protobuf.decode = function (key, msg) {
      return Protobuf.decoder.decode(key, msg);
    }; // exports to support for components


    module.exports = Protobuf;

    if (typeof window != "undefined") {
      window.protobuf = Protobuf;
    }
  })(typeof window == "undefined" ? module.exports : this.protobuf = {}, this);
  /**
   * constants
   */


  (function (exports, global) {
    var constants = exports.constants = {};
    constants.TYPES = {
      uInt32: 0,
      sInt32: 0,
      int32: 0,
      double: 1,
      string: 2,
      message: 2,
      float: 5
    };
  })('undefined' !== typeof protobuf ? protobuf : module.exports, this);
  /**
   * util module
   */


  (function (exports, global) {
    var Util = exports.util = {};

    Util.isSimpleType = function (type) {
      return type === 'uInt32' || type === 'sInt32' || type === 'int32' || type === 'uInt64' || type === 'sInt64' || type === 'float' || type === 'double';
    };
  })('undefined' !== typeof protobuf ? protobuf : module.exports, this);
  /**
   * codec module
   */


  (function (exports, global) {
    var Codec = exports.codec = {};
    var buffer = new ArrayBuffer(8);
    var float32Array = new Float32Array(buffer);
    var float64Array = new Float64Array(buffer);
    var uInt8Array = new Uint8Array(buffer);

    Codec.encodeUInt32 = function (n) {
      var n = parseInt(n);

      if (isNaN(n) || n < 0) {
        return null;
      }

      var result = [];

      do {
        var tmp = n % 128;
        var next = Math.floor(n / 128);

        if (next !== 0) {
          tmp = tmp + 128;
        }

        result.push(tmp);
        n = next;
      } while (n !== 0);

      return result;
    };

    Codec.encodeSInt32 = function (n) {
      var n = parseInt(n);

      if (isNaN(n)) {
        return null;
      }

      n = n < 0 ? Math.abs(n) * 2 - 1 : n * 2;
      return Codec.encodeUInt32(n);
    };

    Codec.decodeUInt32 = function (bytes) {
      var n = 0;

      for (var i = 0; i < bytes.length; i++) {
        var m = parseInt(bytes[i]);
        n = n + (m & 0x7f) * Math.pow(2, 7 * i);

        if (m < 128) {
          return n;
        }
      }

      return n;
    };

    Codec.decodeSInt32 = function (bytes) {
      var n = this.decodeUInt32(bytes);
      var flag = n % 2 === 1 ? -1 : 1;
      n = (n % 2 + n) / 2 * flag;
      return n;
    };

    Codec.encodeFloat = function (float) {
      float32Array[0] = float;
      return uInt8Array;
    };

    Codec.decodeFloat = function (bytes, offset) {
      if (!bytes || bytes.length < offset + 4) {
        return null;
      }

      for (var i = 0; i < 4; i++) {
        uInt8Array[i] = bytes[offset + i];
      }

      return float32Array[0];
    };

    Codec.encodeDouble = function (double) {
      float64Array[0] = double;
      return uInt8Array.subarray(0, 8);
    };

    Codec.decodeDouble = function (bytes, offset) {
      if (!bytes || bytes.length < offset + 8) {
        return null;
      }

      for (var i = 0; i < 8; i++) {
        uInt8Array[i] = bytes[offset + i];
      }

      return float64Array[0];
    };

    Codec.encodeStr = function (bytes, offset, str) {
      for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        var codes = encode2UTF8(code);

        for (var j = 0; j < codes.length; j++) {
          bytes[offset] = codes[j];
          offset++;
        }
      }

      return offset;
    };
    /**
     * Decode string from utf8 bytes
     */


    Codec.decodeStr = function (bytes, offset, length) {
      var array = [];
      var end = offset + length;

      while (offset < end) {
        var code = 0;

        if (bytes[offset] < 128) {
          code = bytes[offset];
          offset += 1;
        } else if (bytes[offset] < 224) {
          code = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
          offset += 2;
        } else {
          code = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
          offset += 3;
        }

        array.push(code);
      }

      var str = '';

      for (var i = 0; i < array.length;) {
        str += String.fromCharCode.apply(null, array.slice(i, i + 10000));
        i += 10000;
      }

      return str;
    };
    /**
     * Return the byte length of the str use utf8
     */


    Codec.byteLength = function (str) {
      if (typeof str !== 'string') {
        return -1;
      }

      var length = 0;

      for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        length += codeLength(code);
      }

      return length;
    };
    /**
     * Encode a unicode16 char code to utf8 bytes
     */


    function encode2UTF8(charCode) {
      if (charCode <= 0x7f) {
        return [charCode];
      } else if (charCode <= 0x7ff) {
        return [0xc0 | charCode >> 6, 0x80 | charCode & 0x3f];
      } else {
        return [0xe0 | charCode >> 12, 0x80 | (charCode & 0xfc0) >> 6, 0x80 | charCode & 0x3f];
      }
    }

    function codeLength(code) {
      if (code <= 0x7f) {
        return 1;
      } else if (code <= 0x7ff) {
        return 2;
      } else {
        return 3;
      }
    }
  })('undefined' !== typeof protobuf ? protobuf : module.exports, this);
  /**
   * encoder module
   */


  (function (exports, global) {
    var protobuf = exports;
    var MsgEncoder = exports.encoder = {};
    var codec = protobuf.codec;
    var constant = protobuf.constants;
    var util = protobuf.util;

    MsgEncoder.init = function (protos) {
      this.protos = protos || {};
    };

    MsgEncoder.encode = function (route, msg) {
      // Get protos from protos map use the route as key
      var protos = this.protos[route]; // Check msg

      if (!checkMsg(msg, protos)) {
        return null;
      } // Set the length of the buffer 2 times bigger to prevent overflow


      var length = codec.byteLength(JSON.stringify(msg)); // Init buffer and offset

      var buffer = new ArrayBuffer(length);
      var uInt8Array = new Uint8Array(buffer);
      var offset = 0;

      if (protos) {
        offset = encodeMsg(uInt8Array, offset, protos, msg);

        if (offset > 0) {
          return uInt8Array.subarray(0, offset);
        }
      }

      return null;
    };
    /**
     * Check if the msg follow the defination in the protos
     */


    function checkMsg(msg, protos) {
      if (!protos) {
        return false;
      }

      for (var name in protos) {
        var proto = protos[name]; // All required element must exist

        switch (proto.option) {
          case 'required':
            if (typeof msg[name] === 'undefined') {
              console.warn('no property exist for required! name: %j, proto: %j, msg: %j', name, proto, msg);
              return false;
            }

          case 'optional':
            if (typeof msg[name] !== 'undefined') {
              var message = protos.__messages[proto.type] || MsgEncoder.protos['message ' + proto.type];

              if (message && !checkMsg(msg[name], message)) {
                console.warn('inner proto error! name: %j, proto: %j, msg: %j', name, proto, msg);
                return false;
              }
            }

            break;

          case 'repeated':
            // Check nest message in repeated elements
            var message = protos.__messages[proto.type] || MsgEncoder.protos['message ' + proto.type];

            if (msg[name] && message) {
              for (var i = 0; i < msg[name].length; i++) {
                if (!checkMsg(msg[name][i], message)) {
                  return false;
                }
              }
            }

            break;
        }
      }

      return true;
    }

    function encodeMsg(buffer, offset, protos, msg) {
      for (var name in msg) {
        if (protos[name]) {
          var proto = protos[name];

          switch (proto.option) {
            case 'required':
            case 'optional':
              offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
              offset = encodeProp(msg[name], proto.type, offset, buffer, protos);
              break;

            case 'repeated':
              if (msg[name].length > 0) {
                offset = encodeArray(msg[name], proto, offset, buffer, protos);
              }

              break;
          }
        }
      }

      return offset;
    }

    function encodeProp(value, type, offset, buffer, protos) {
      switch (type) {
        case 'uInt32':
          offset = writeBytes(buffer, offset, codec.encodeUInt32(value));
          break;

        case 'int32':
        case 'sInt32':
          offset = writeBytes(buffer, offset, codec.encodeSInt32(value));
          break;

        case 'float':
          writeBytes(buffer, offset, codec.encodeFloat(value));
          offset += 4;
          break;

        case 'double':
          writeBytes(buffer, offset, codec.encodeDouble(value));
          offset += 8;
          break;

        case 'string':
          var length = codec.byteLength(value); // Encode length

          offset = writeBytes(buffer, offset, codec.encodeUInt32(length)); // write string

          codec.encodeStr(buffer, offset, value);
          offset += length;
          break;

        default:
          var message = protos.__messages[type] || MsgEncoder.protos['message ' + type];

          if (message) {
            // Use a tmp buffer to build an internal msg
            var tmpBuffer = new ArrayBuffer(codec.byteLength(JSON.stringify(value)) * 2);
            var length = 0;
            length = encodeMsg(tmpBuffer, length, message, value); // Encode length

            offset = writeBytes(buffer, offset, codec.encodeUInt32(length)); // contact the object

            for (var i = 0; i < length; i++) {
              buffer[offset] = tmpBuffer[i];
              offset++;
            }
          }

          break;
      }

      return offset;
    }
    /**
     * Encode reapeated properties, simple msg and object are decode differented
     */


    function encodeArray(array, proto, offset, buffer, protos) {
      var i = 0;

      if (util.isSimpleType(proto.type)) {
        offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
        offset = writeBytes(buffer, offset, codec.encodeUInt32(array.length));

        for (i = 0; i < array.length; i++) {
          offset = encodeProp(array[i], proto.type, offset, buffer);
        }
      } else {
        for (i = 0; i < array.length; i++) {
          offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
          offset = encodeProp(array[i], proto.type, offset, buffer, protos);
        }
      }

      return offset;
    }

    function writeBytes(buffer, offset, bytes) {
      for (var i = 0; i < bytes.length; i++, offset++) {
        buffer[offset] = bytes[i];
      }

      return offset;
    }

    function encodeTag(type, tag) {
      var value = constant.TYPES[type] || 2;
      return codec.encodeUInt32(tag << 3 | value);
    }
  })('undefined' !== typeof protobuf ? protobuf : module.exports, this);
  /**
   * decoder module
   */


  (function (exports, global) {
    var protobuf = exports;
    var MsgDecoder = exports.decoder = {};
    var codec = protobuf.codec;
    var util = protobuf.util;
    var buffer;
    var offset = 0;

    MsgDecoder.init = function (protos) {
      this.protos = protos || {};
    };

    MsgDecoder.setProtos = function (protos) {
      if (protos) {
        this.protos = protos;
      }
    };

    MsgDecoder.decode = function (route, buf) {
      var protos = this.protos[route];
      buffer = buf;
      offset = 0;

      if (protos) {
        return decodeMsg({}, protos, buffer.length);
      }

      return null;
    };

    function decodeMsg(msg, protos, length) {
      while (offset < length) {
        var head = getHead();
        var type = head.type;
        var tag = head.tag;
        var name = protos.__tags[tag];

        switch (protos[name].option) {
          case 'optional':
          case 'required':
            msg[name] = decodeProp(protos[name].type, protos);
            break;

          case 'repeated':
            if (!msg[name]) {
              msg[name] = [];
            }

            decodeArray(msg[name], protos[name].type, protos);
            break;
        }
      }

      return msg;
    }
    /**
     * Test if the given msg is finished
     */


    function isFinish(msg, protos) {
      return !protos.__tags[peekHead().tag];
    }
    /**
     * Get property head from protobuf
     */


    function getHead() {
      var tag = codec.decodeUInt32(getBytes());
      return {
        type: tag & 0x7,
        tag: tag >> 3
      };
    }
    /**
     * Get tag head without move the offset
     */


    function peekHead() {
      var tag = codec.decodeUInt32(peekBytes());
      return {
        type: tag & 0x7,
        tag: tag >> 3
      };
    }

    function decodeProp(type, protos) {
      switch (type) {
        case 'uInt32':
          return codec.decodeUInt32(getBytes());

        case 'int32':
        case 'sInt32':
          return codec.decodeSInt32(getBytes());

        case 'float':
          var float = codec.decodeFloat(buffer, offset);
          offset += 4;
          return float;

        case 'double':
          var double = codec.decodeDouble(buffer, offset);
          offset += 8;
          return double;

        case 'string':
          var length = codec.decodeUInt32(getBytes());
          var str = codec.decodeStr(buffer, offset, length);
          offset += length;
          return str;

        default:
          var message = protos && (protos.__messages[type] || MsgDecoder.protos['message ' + type]);

          if (message) {
            var length = codec.decodeUInt32(getBytes());
            var msg = {};
            decodeMsg(msg, message, offset + length);
            return msg;
          }

          break;
      }
    }

    function decodeArray(array, type, protos) {
      if (util.isSimpleType(type)) {
        var length = codec.decodeUInt32(getBytes());

        for (var i = 0; i < length; i++) {
          array.push(decodeProp(type));
        }
      } else {
        array.push(decodeProp(type, protos));
      }
    }

    function getBytes(flag) {
      var bytes = [];
      var pos = offset;
      flag = flag || false;
      var b;

      do {
        b = buffer[pos];
        bytes.push(b);
        pos++;
      } while (b >= 128);

      if (!flag) {
        offset = pos;
      }

      return bytes;
    }

    function peekBytes() {
      return getBytes(true);
    }
  })('undefined' !== typeof protobuf ? protobuf : module.exports, this);

  /***/ }),
  /* 10 */
  /***/ (function(module, exports) {

  exports.formatURI = function (host, port) {
    return "ws://".concat(host).concat(port ? ":".concat(port) : '');
  };

  exports.getStorageProtos = function () {
    // return window.localStorage.getItem('protos');
  };

  exports.setStorageProtos = function (data) {
    // window.localStorage.setItem('protos', data);
  };

  exports.initSocket = function (uri, onopen, onmessage, onerror, onclose) {
    var socket = new WebSocket(uri);
    socket.binaryType = 'arraybuffer';
    socket.onopen = onopen;
    socket.onmessage = onmessage;
    socket.onerror = onerror;
    socket.onclose = onclose;
    return socket;
  };
  /**
   * @param {Object} socket
   * @param {number} [code] 默认会是 1005 @see https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   * @param {string} [reason] close reason
   */


  exports.closeConnection = function (socket, code, reason) {
    if (!socket) return;
    if (socket.disconnect) socket.disconnect();
    if (socket.close) socket.close(code, reason);
  };

  exports.send = function (socket, arrayBuf) {
    if (!socket) return;
    socket.send(arrayBuf);
  };

  /***/ })
  /******/ ]);
/////////////////////////////////////////////////////////////

const monitor = (() => {
  return typeof actor !== 'undefined' ? function (type, name, reqId) {
    actor.emit(type, name, reqId)
  } : function () {
    console.error(Array.prototype.slice.call(arguments, 0))
  }
})()

const SERVERS  = {
  REMOTE_HOST_TX: 'collie.manjiz.com',
  REMOTE_HOST_PRE: 'precollie-main.jd.com',
  REMOTE_HOST_PRO: 'collie-gate.jd.com'
}
const QZONE_OPENID = 'DFB2FD9A2A7745F056EC95AF49102A0F'
const QZONE_OPENKEY = '5EC1ABF5834949C2DDB80E5A73D861BE'

function login ({
  local = true,
  // tx | pre | pro
  server = 'tx',
  debug = false,
  debugPlayerId,
  openid = QZONE_OPENID,
  openkey = QZONE_OPENKEY,
  dogName,
  inviter,
  test = '123456'
} = {}) {
  if (!local && !['tx', 'pre', 'pro', 'TX', 'PRE', 'PRO'].includes(server)) return new Error('指向了错误的服务器')

  window.isLocal = local

  const REMOTE_HOST = SERVERS[`REMOTE_HOST_${server.toUpperCase()}`]

  olemop.init({ host: local ? '127.0.0.1' : REMOTE_HOST, port: 3014, log: true }, () => {
    monitor('start', 'gate', 0)

    // console.log('- gate initial -')
    olemop.request('gate.gateHandler.queryEntry', { openid: test }, (ret) => {
      monitor('end', 'gate', 0)

      olemop.disconnect(1000)
      // console.log('- gate entry -', ret)
      if (ret.code !== 0) return
      // 调试处理
      if (!window.isLocal && ret.host === '127.0.0.1') {
        ret.host = REMOTE_HOST
      }
      // console.log(ret.host, ret.port)
      olemop.init({ host: ret.host, port: ret.port, log: true, reconnect: true, maxReconnectAttempts: 10 }, () => {
        monitor('start', 'entry', 1)

        // console.log('- connector init -')
        olemop.request('connector.entryHandler.entry', {
          debug,
          debugPlayerId,
          openid,
          openkey,
          dogName,
          inviter
        }, (ret) => {
          monitor('end', 'entry', 1)

          setInterval(() => {
            monitor('start', 'missionList', 2)
            olemop.request('connector.missionHandler.list', () => {
              monitor('end', 'missionList', 2)
            })
          }, Math.floor(Math.random()*3000 + 2000))

          setInterval(() => {
            monitor('start', 'friendList', 3)
            olemop.request('connector.socialHandler.list', () => {
              monitor('end', 'friendList', 3)
            })
          }, Math.floor(Math.random()*3000 + 2000))
        })
      })
    })
  })
}

// olemop.on('disconnect', (event) => {
//   if (event.code !== 1000) {
//     console.log('掉线了', event)
//   }
// })
// olemop.on('onKick', (ret) => {
//   if (ret && ret.reason === 'multiSessions') {
//     olemop.preventReconnect()
//     console.log('用户在别处登录')
//   }
// })

// // 事件监听
// olemop.on('onRipeRemind', (data) => console.log('菜地时间刷新', data))
// olemop.on('onSeedChange', (data) => console.log('种子状态变更', data))
// olemop.on('onVitChange', (data) => console.log('体力变更', data))
// olemop.on('onDanmaku', (data) => console.log('弹幕', data))
// olemop.on('onMission', (data) => console.log('任务推送', data))
// olemop.on('onAchievement', (data) => console.log('成就', data))
// olemop.on('onChat', (data) => console.log('聊天~', data))
// olemop.on('onMessage', (data) => console.log('消息', data))
// olemop.on('onDailyLoginExp', (data) => console.log('每日登录经验', data))
// olemop.on('onSuitFullfill', (data) => console.log('套装集齐', data))

// olemop.on('heartbeat timeout', function () {
//   console.log('心跳超时')
// })
// olemop.on('reconnect', function () {
//   console.log('断线重连')
// })

login({ local: true, debug: true, debugPlayerId: playerId })
