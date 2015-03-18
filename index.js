'use strict';

var Promise = require('bluebird');
var portfinder = require('portfinder');
var adb = require('adbkit');
var adbClient = adb.createClient();

portfinder.basePort = 9222;

function discoverDevices() {

    return adbClient.listDevices()
        .then(function(devices) {
            console.log('devices', devices);

            return Promise.reduce(Promise.all(devices.map(findServices)), function(a, b) {
                a.concat(b);
            });
        })
        .then(function(services) {  
            console.log('services:', services); 
            return Promise.all(services.map(setupForward));
        })
        .then(function(forwarded) {
            console.log('forwarded', forwarded);
            return forwarded;
        });
}

function findServices(device) {

    return adbClient.shell(device.id, 'cat /proc/net/unix | grep devtools_remote')
        .then(adb.util.readAll)
        .then(function(output) {
            var response = output.toString('utf8');
            var services = [];

            if(response.length) { 
                var matches = response.match(/@(.+)/gi);
                if(matches.length) {
                    services =  matches;
                }
            };

            return Promise.map(services, function(service) {
                return {
                    device: device,
                    service: service
                };
            });

        });
}

function setupForward(info) {

    return (getPort().then(function(port) {
        var localAddress = 'tcp:' + port;
        var remoteAddress = 'localabstract:' + info.service.replace('@', '');
        return adbClient
            .forward(info.device.id, localAddress, remoteAddress)
            .then(function() {
                return {
                    device: info.device,
                    url: 'http://localhost:' + port,
                };
            });
    }));

}

function getPort() {
    return new Promise(function(resolve, reject) {
        portfinder.getPort(function(err, port) {
            if(err) {
                reject(err);
            } else {
                resolve(port);
            }
        });
    });
}

module.export = discoverDevices;