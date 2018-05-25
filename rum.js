(function(){
/**
    Variable declarations
*/
    var isNode = false, hasServiceWorker = false, isServiceWorkerInstalled = false;

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
    var allTypes = {'entryTypes': ['mark', 'longtask', 'frame', 'navigation', 'resource']},
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
	    pushToQueue(perfEntries)
        }
    }
    
    function pushToQueue(list){
        for (var i = 0; i < list.length; i++){
            perfQueue.push(list[i])
        }
    }

    function send(){
        console.log(perfQueue.shift())
    }

    var observerCallback = function(list){
        var perfEntries = list.getEntries();
	pushToQueue(perfEntries)
    }
/**
    Program logic is encapsulated in exportDef which is exposed as a function
*/
    exportDef = function() {
        var hello, options;
        hello = function() {
            console.log('Hello, World!');
        }
        
        /*
        Configurations for Rum accepted as a dictionary.
        */
        config = function(options) {
            options = Object.assign({},options)
        }
        
        print = function(){
            var observer = getObserver(observerCallback)
            observe(observer, {})
        }
        
        /*
        Export functions for call
        */
        exports = {
            hello: hello,
            config: config,
            print: print,
            snapshot: snapshot
        };
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

