(function(){
/**
    Variable declarations
*/
    var isNode = false, hasServiceWorker = false, isServiceWorkerInstalled = false, options = {};

/**
    Check to see if rum is running on a server or a client. All checks should be here.
*/
    isNode = (typeof module !== "undefined" && module !== null) && !(typeof window !== "undefined" && window !== null ? window.module : void 0);
    hasServiceWorker = typeof navigator !== "undefined" && 'serviceWorker' in navigator
    hasBeacon = typeof navigator !== "undefined" && 'sendBeacon' in navigator
    hasFetch = typeof self !== "undefined" && self.fetch !== undefined;
    hasDocument = typeof self !== "undefined" && self.document !== undefined;
    hasWindow = typeof self !== "undefined" && self.window !== undefined;


/*
    Global callables based on server/client
*/
    var performance, performanceObserver
    if (isNode) {
        var {performance, PerformanceObserver} = require('perf_hooks');
	var fetch = require('node-fetch');
    } else {
        var PerformanceObserver = self.PerformanceObserver 
	var performance = self.performance
    }
        
/**
    Register a service worker if the client supports it. This will handle all of aggregation, analytics and telemetry.
*/
    if (!isNode && hasServiceWorker) {
        navigator.serviceWorker.register('/worker.js')
        .then(function(){
            isServiceWorkerInstalled = true;
            console.log('Service worker sucessfully registered!');
        })
        .catch(function(err){
            isServiceWorkerInstalled = false;
            console.error('Service worker registration failed :(', err);
        })
    }

/* Performance API functions [W3C standard]*/
    var allTypes = {'entryTypes': ['mark', 'longtask', 'frame', 'navigation', 'resource', 'paint']},
        perfQueue = [], transmitQueue = [], userQueue = []

    function getObserver(callback){
        var observer = new PerformanceObserver(callback)
        return observer
    }
    
    function observe(observer, entryTypes){
        if (entryTypes === undefined || !entryTypes.hasOwnProperty('entryTypes')){
            entryTypes = allTypes
        }
        observer.observe(entryTypes)
    }
    
    function snapshot(entryTypes){
        if (entryTypes === undefined || !entryTypes.hasOwnProperty('entryTypes') || !entryTypes['entryTypes'] instanceof Array){
            entryTypes = allTypes
        }
        for (var idx in entryTypes['entryTypes']){
            var perfEntries = performance.getEntriesByType(entryTypes['entryTypes'][idx])   
	    pushListToQueue(perfEntries)
        }
    }

    /* Push performance entries into queue */    
    function pushListToQueue(list){
        for (var i = 0; i < list.length; i++){
            var perfData = {};

	    perfData['rumTime'] = new Date(performance.timeOrigin + performance.now()).toISOString()

            options['performance.entry.keys'].forEach(function(attrib){
                if (list[i][attrib] !== undefined){
                    perfData[attrib] = list[i][attrib]
                }
            });
            perfQueue.push({performance:perfData})
	    checkWaterMark();
        }
    }

    function checkWaterMark(){
	if ((userQueue.length + perfQueue.length) >= options['transmit.minRecords']) {
	    transmit();
	}
    }

    function simplePush(data){
        userQueue.push(data);
	checkWaterMark();
    }

    function enrich(){
         var navData = {}, docData = {}
	 options['navigator.keys'].forEach(function(key){
             if (navigator[key] !== undefined){
	          navData[key] = navigator[key]
	     }
	 });

	 options['document.keys'].forEach(function(key){
             if (document[key] !== undefined){
	          docData[key] = document[key]
	     }
	 });

         return {navigator: navData,
	         document: docData}
    }

    function transmit(){
	var enrichData = {}
	if (!isNode) {
	    enrichData = enrich()
	}
	while (perfQueue.length) {
            var perfData = perfQueue.shift()
	    transmitQueue.push(Object.assign(enrichData, perfData))
	}
	while (userQueue.length) {
            var userData = userQueue.shift()
	    transmitQueue.push(Object.assign(enrichData, userData))
	}
	if (transmitQueue.length) {
	    telemetry(JSON.stringify(transmitQueue.splice(0)));
	}
    }

    var observerCallback = function(list){
        var perfEntries = list.getEntries();
	pushListToQueue(perfEntries)
    }

/*
    Event logging. Generic event capture/callback. Additional events can use the same interface. If needed, new data eleements can be added here.
*/
    function eventCapture(event){
        try {
            if ((event.target.tagName !== undefined && options['track.elements'].indexOf(event.target.tagName.toLowerCase()) > -1) || options['track.elements'].indexOf('all') > -1) {
                var eventData = {
                    timestamp: new Date(performance.timeOrigin + performance.now()).toISOString(),
                    id: event.target.id,
                    tagName: event.target.tagName,
                    name: event.target.name,
                    value: event.target.value,
                    innerHTML: event.target.innerHTML.substring(0,10),
                    href: event.target.href,
                    src: event.target.src,
                    baseURI: event.target.baseURI
                };
                simplePush({event: Object.assign({}, eventData)});
            }
        } catch (e) {
            console.error(e);
        }
    }

/*
    Telemetry using Fetch / XHR
*/
    function telemetry(data){
	var body = null, opts = null, url = null, queued = false;
	body = {body: data}
	opts = Object.assign(options['transmit.http.options'], body);
	url = options['transmit.url'];
	try {
	    if (hasBeacon){
	        queued = navigator.sendBeacon(url, data);
	    }
	    if (!queued) {
                if (hasFetch || isNode) {
                    fetch(url, opts);
	        } else {
    
	        }
	    }
	} catch (e) {
            console.error(e)
	}

    }
/**
    Program logic is encapsulated in exportDef which is exposed as a function
*/
    exportDef = function() {
        var hello, timer;
        hello = function() {
            console.log('Hello, World!');
        }
        
        /*
        Configurations for Rum accepted as a dictionary.
        */
        config = function(opt) {

            opt = opt || {}

            var defaults = {
                'performance.entry.keys': ['name', 'entryType', 'startTime', 'duration', 
                                           'initiatorType', 'workerStart', 'containerType', 
                                           'containerName', 'containerId', 'containerSrc'],
                'track.elements': ['all'],
                'transmit.interval': 5000,
                'transmit.minRecords': 100,
                'transmit.url': 'http://104.41.128.30:8000/sensor/hi',
                'transmit.http.options': {
		    'keepalive': true,
		    'method': 'POST',
		    'mode': 'no-cors',
		},
                'navigator.keys': ['userAgent'],
		'document.keys': ['referrer']
            }

            options = Object.assign(defaults,opt)

            stop();

            start(options);
        }
        
        print = function(){
            try {
                var observer = getObserver(observerCallback);
                observe(observer, {});
            } catch (e) {
                console.log(e);
            }
        }
        
        start = function(){
            if (hasDocument) {
                document.addEventListener('click', eventCapture);
            }
            if (hasWindow) {
                window.addEventListener('beforeunload', transmit);
                window.addEventListener('unload', transmit);
            }
            timer = setInterval(transmit, options['transmit.interval'] || 1000)
        }

        stop = function(){
            if (hasDocument) {
                document.removeEventListener('click', eventCapture);
            }
            if (hasWindow) {
                window.removeEventListener('beforeunload', transmit);
                window.removeEventListener('unload', transmit);
            }
            clearInterval(timer)
        }

        send = function(data){
            try {
	        var timestamp = new Date(performance.timeOrigin + performance.now()).toISOString()
		console.log(timestamp, performance.timeOrigin, performance.now());
                simplePush({metric: Object.assign(data,{timestamp: timestamp})});
            } catch (e) {
                console.log(e);
            }
        }

        /*
        Export functions for call
        */
        exports = {
            hello: hello,
            config: config,
            print: print,
            snapshot: snapshot,
            start: start,
            stop: stop,
            send: send
        };

/* Call start to transmit data per the defined interval with default settings */
        config();

        return exports
    }
/** 
    Make Rum available globally for imports and usage
*/
    if (typeof define === 'function' && define.amd) {
      define(exportDef);
    } else if (typeof exports === 'object') {
      module.exports = exportDef();
    } else {
      window.Rum = exportDef();
    }

}).call(this)
