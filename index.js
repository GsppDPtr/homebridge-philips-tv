var Service;
var Characteristic;
var request = require("request");
var pollingtoevent = require('polling-to-event');
var wol = require('wake_on_lan');
var exec = require("child_process").exec;

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-philips-tv", "HomebridgePhilipsTV", HomebridgePhilipsTV);
}

function HomebridgePhilipsTV(log, config, api) {
	
	this.log = log;
	this.name = config["name"];
	this.baseURL = config["baseURL"];
	this.username = config["username"];
	this.password = config["password"];

	this.ambilightStyles = [{
		"name": "Standard",
		"value": "STANDARD",
	},{
		"name": "Naturel",
		"value": "NATURAL",
	},{
		"name": "Football",
		"value": "FOOTBALL",
	},{
		"name": "Vif",
		"value": "VIVID",
	},{
		"name": "Jeu",
		"value": "GAME",
	},{
		"name": "Confort",
		"value": "COMFORT",
	},{
		"name": "Relax",
		"value": "RELAX",
	},]

	this.services = [];

	// Information service
	var informationService = new Service.AccessoryInformation();
	informationService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.Manufacturer, 'Philips')
		.setCharacteristic(Characteristic.Model, "58PUS7304")
		.setCharacteristic(Characteristic.SerialNumber, "833")
		.setCharacteristic(Characteristic.FirmwareRevision, '1.0.0');
	this.services.push(informationService);

	// Television service
	var tvService = new Service.Television(this.name, 'TV Service ' + this.name);
	tvService
		.setCharacteristic(Characteristic.Name, this.name)
		.setCharacteristic(Characteristic.ConfiguredName, this.name)
		.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
		.setCharacteristic(Characteristic.ActiveIdentifier, 0)
		.setCharacteristic(Characteristic.Active, false);
	tvService.getCharacteristic(Characteristic.Active)
		.on('get', this.getPowerState.bind(this))
		.on('set', this.setPowerState.bind(this));

	for (var i = 0; i < this.ambilightStyles.length; i++) {
		var ambilightStyle = this.ambilightStyles[i];
		var inputSourceService = this.createInputSourceService(i, ambilightStyle.name);
		tvService.addLinkedService(inputSourceService);
		this.services.push(inputSourceService);
	}

	tvService.getCharacteristic(Characteristic.ActiveIdentifier)
		.on('get', this.getAmbilightStyle.bind(this))
		.on('set', this.setAmbilightStyle.bind(this));
	this.services.push(tvService);

	// Abilight Powestate and brightness
	var ambilightBrightnessService = new Service.Lightbulb("Luminosité Ambilight", 'brightness');
	ambilightBrightnessService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getAmbilightPowerState.bind(this))
		.on('set', this.setAmbilightPowerState.bind(this));
	ambilightBrightnessService
		.getCharacteristic(Characteristic.Brightness)
		.on('get', this.getAmbilightBrightness.bind(this))
		.on('set', this.setAmbilightBrightness.bind(this));
	this.services.push(ambilightBrightnessService);

	// Abilight Powestate and saturation
	var ambilightSaturationService = new Service.Lightbulb("Saturation Ambilight", 'saturation');
	ambilightSaturationService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getAmbilightPowerState.bind(this))
		.on('set', (value, callback) => callback(null));
	ambilightSaturationService
		.getCharacteristic(Characteristic.Brightness)
		.on('get', this.getAmbilightSaturation.bind(this))
		.on('set', this.setAmbilightSaturation.bind(this));
	this.services.push(ambilightSaturationService);

}

HomebridgePhilipsTV.prototype.createInputSourceService = function(id, name) {
	var inputSourceService = new Service.InputSource(name, 'InputSource'+ id);            
	inputSourceService
		.setCharacteristic(Characteristic.Name, name)
		.setCharacteristic(Characteristic.Identifier, id)
		.setCharacteristic(Characteristic.ConfiguredName, name)
		.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
		.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN)
		.setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN)
		.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
		.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI);
	return inputSourceService;
}

HomebridgePhilipsTV.prototype.getServices = function() {
	return this.services;
}

HomebridgePhilipsTV.prototype.info = function(str) {
	this.log(str);
}

HomebridgePhilipsTV.prototype.getPowerState = function(callback) {
	this.log("Getting power state...");
	let url = this.baseURL+"/6/powerstate";
	this.get(url, function(result) {
		var powerstate = result.powerstate == "On" ? 1 : 0
		callback(null, powerstate);
	}, function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.setPowerState = function(value, callback) {
	this.log("Setting power state to "+value);
	let url = this.baseURL+"/6/powerstate";
	var powerstate = value ? "On" : "Standby";
	var powerstateObject = {
		"powerstate": powerstate
	};
	this.post(url, powerstateObject, function(result) {
		this.log("Power state set");
		callback(null);
	}.bind(this), function(error) {
		callback(error);
	});
}

HomebridgePhilipsTV.prototype.getAmbilightStyle = function(callback) {
	this.log("Getting ambilight style...");
	let url = this.baseURL+"/6/ambilight/currentconfiguration";
	this.get(url, function(result) {
		var normalizedAmbilightStyleValue = result.menuSetting;
		var ambilightStyleValue = -1;
		for (var i = 0; i < this.ambilightStyles.length; i++) {
			var ambilightStyle = this.ambilightStyles[i];
			if (ambilightStyle.value == normalizedAmbilightStyleValue) {
				ambilightStyleValue = i;
			}
		}
		callback(null, ambilightStyleValue);
	}.bind(this), function(error) {
		callback(null, -1);
	});
}

HomebridgePhilipsTV.prototype.setAmbilightStyle = function(value, callback) {
	var normalizedValue = this.ambilightStyles[value].value;
	this.log("Setting ambilight style to "+normalizedValue);
	let url = this.baseURL+"/6/ambilight/currentconfiguration";
	let requestBody = {
		"styleName": "FOLLOW_VIDEO",
		"isExpert": "false",
		"menuSetting": normalizedValue
	};
	this.post(url, requestBody, function(result) {
		this.log("Ambilight style set");
		callback(null);
	}.bind(this), function(error) {
		callback(error);
	});
}

HomebridgePhilipsTV.prototype.getAmbilightPowerState = function(callback) {
	this.log("Getting ambilight power state...");
	let url = this.baseURL+"/6/ambilight/power";
	this.get(url, function(result) {
		var power = result.power == "On" ? 1 : 0
		callback(null, power);
	}, function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.setAmbilightPowerState = function(value, callback) {
	this.log("Setting ambilight power state to "+value);
	let url = this.baseURL+"/6/ambilight/power";
	let powerstate = value ? "On" : "Off";
	let requestBody = {
		"power": powerstate
	};
	this.post(url, requestBody, function(result) {
		this.log("Ambilight power state set");
		callback(null);
	}.bind(this), function(error) {
		callback(error);
	});
}

HomebridgePhilipsTV.prototype.getAmbilightBrightness = function(callback) {
	this.log("Getting ambilight brightness...");
	let url = this.baseURL+"/6/menuitems/settings/current";
	let requestBody = {
		"nodes": [
			{
				"nodeid": 2131230773
			}
		]
	};
	this.post(url, requestBody, function(result) {
		let brightness = result.values[0].value.data.value;
		let normalizedBrightness = brightness * 10;
		callback(null, normalizedBrightness);
	}, function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.setAmbilightBrightness = function(value, callback) {
	var normalizedValue = Math.round(value / 10);
	this.log("Setting ambilight brightness to "+normalizedValue);
	let url = this.baseURL+"/6/menuitems/settings/update";
	let requestBody = {
		"values": [{
			"value": {
				"Nodeid": 2131230773,
				"data": {
					"value": normalizedValue
				}
			}
		}]
	};
	this.post(url, requestBody, function(result) {
		this.log("Ambilight brightness set");
		callback(null);
	}.bind(this), function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.getAmbilightSaturation = function(callback) {
	this.log("Getting ambilight saturation...");
	let url = this.baseURL+"/6/menuitems/settings/current";
	let requestBody = {
		"nodes": [
			{
				"nodeid": 2131230775
			}
		]
	};
	this.post(url, requestBody, function(result) {
		let saturation = result.values[0].value.data.value;
		let normalizedSaturation = (saturation + 2) * 25;
		callback(null, normalizedSaturation);
	}, function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.setAmbilightSaturation = function(value, callback) {
	var normalizedValue = Math.round(value / 25) - 2;
	this.log("Setting ambilight saturation to "+normalizedValue);
	let url = this.baseURL+"/6/menuitems/settings/update";
	let requestBody = {
		"values": [{
			"value": {
				"Nodeid": 2131230775,
				"data": {
					"value": normalizedValue
				}
			}
		}]
	};
	this.post(url, requestBody, function(result) {
		this.log("Ambilight saturation set");
		callback(null);
	}.bind(this), function(error) {
		callback(null, 0);
	});
}

HomebridgePhilipsTV.prototype.get = function(url, onSuccess, onError) {
	this.log("GET "+url);
	var options = {
		url: url,
		method: "GET",
		rejectUnauthorized: false,
		timeout: 2000,
		forever: true,
		followAllRedirects: true,
		auth: {
			user: this.username,
			pass: this.password,
			sendImmediately: false
		}
	};
	request(options, function(err, response, body) {
	  if (!err && response.statusCode == 200) {
		var bodyObject = JSON.parse(body);
		onSuccess(bodyObject);
	  } else {
		this.log("Error calling get %s (status code %s): %s", url, response, err);
		onError(err);
	  }
	}.bind(this));
}

HomebridgePhilipsTV.prototype.post = function(url, body, onSuccess, onError) {
	this.log("POST "+url);
	this.log("Body "+JSON.stringify(body));
	var options = {
		url: url,
		method: "POST",
		body: JSON.stringify(body),
		rejectUnauthorized: false,
		timeout: 2000,
		forever: true,
		followAllRedirects: true,
		auth: {
			user: this.username,
			pass: this.password,
			sendImmediately: false
		}
	};
	request(options, function(err, response, body) {
	  if (!err && response.statusCode == 200) {
		  if (body) {
			this.log("Response body "+body);
			var bodyObject = JSON.parse(body);
			onSuccess(bodyObject);
		  } else {
			onSuccess();
		  }
	  } else if (response) {
		this.log("Error calling post %s (status code %s): %s", url, response.statusCode, err);
		onError(err);
	  } else {
		this.log("Error calling post %s : %s", url, err);
		onError(err);		  
	  }
	}.bind(this));
}

