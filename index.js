'use strict';

var Promise = require('bluebird');
var portfinder = require('portfinder');
var adb = require('adbkit');
var adbClient = adb.createClient();

portfinder.basePort = 9222;

function getTargets() {

	return adbClient.listDevices()
		.then(function(devices) {
			console.log('found', devices.length, 'devices');
			return Promise.all(devices.map(findServices));
		})
		.then(function(services) {		
			console.log('services:', services);
			return Promise.all(services.map(setupDeviceForward));
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

			return {
				device: device.id,
				services: services
			};
		});
}

function setupDeviceForward(serviceInfo) {

	return Promise.map(serviceInfo.services, function(service) {

		return (getPort().then(function(port) {
			var localAddress = 'tcp:' + port;
			var remoteAddress = 'localabstract:' + service.replace('@', '');
			return adbClient
				.forward(serviceInfo.device, localAddress, remoteAddress)
				.then(function() {
					return {
						id: serviceInfo.device,
						port: port,
						local: localAddress,
						remote: remoteAddress
					};
				});
		}));

	});
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

module.export = getTargets;