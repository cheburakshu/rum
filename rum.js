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


/*
    Global callables based on server/client
*/
    var performance, performanceObserver
    if (isNode) {
        var {performance, PerformanceObserver} = require('perf_hooks');
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
        perfQueue = []

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
            options['performance.entry.keys'].forEach(function(attrib){
                if (list[i][attrib] !== undefined){
                    perfData[attrib] = list[i][attrib]
                }
            });
            perfQueue.push({performance:perfData})
        }
    }

    function simplePush(data){
        perfQueue.push(data)
    }

    function transmit(){
        console.log(perfQueue.shift())
    }

    var observerCallback = function(list){
        var perfEntries = list.getEntries();
	pushListToQueue(perfEntries)
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
                'transmit.interval': 1000,
                'transmit.url': 'https://google.com',
                'navigator.keys': []
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

            timer = setInterval(transmit, options['transmit.interval'] || 1000)
        }

        stop = function(){
            clearInterval(timer)
        }

        send = function(data){
            try {
                simplePush(data);
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
