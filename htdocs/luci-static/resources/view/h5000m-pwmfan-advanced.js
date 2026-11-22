'use strict';
'require view';
'require form';
'require uci';
'require ui';

var CONFIG = 'h5000m_pwmfan';
var SECTION = 'main';

return view.extend({
	load: function() {
		return uci.load(CONFIG);
	},

	percentOption: function(section, key, title, fallback) {
		var option = section.option(form.Value, key, title);
		option.datatype = 'range(0,100)';
		option.default = '' + fallback;
		option.rmempty = false;
		option.cfgvalue = function(sectionId) {
			var value = parseInt(uci.get(CONFIG, sectionId, key), 10);
			return isNaN(value) ? '' + fallback : '' + Math.round(value * 100 / 255);
		};
		option.write = function(sectionId, value) {
			uci.set(CONFIG, sectionId, key, '' + Math.round(parseInt(value, 10) * 255 / 100));
		};
		return option;
	},

	group: function(section, key, title, description) {
		var option = section.option(form.DummyValue, '_group_' + key, title);
		option.default = description;
		option.title = '';
		option.optional = true;
		option.renderWidget = function() {
			return E('div', { 'class': 'pwmfan-group-heading' }, [ E('h3', {}, title), E('p', {}, description) ]);
		};
	},

	style: function() {
		var line = 'var(--v-line,var(--line,var(--border-color-medium,#d8dce0)))';
		var text = 'var(--v-text,var(--text,var(--text-color-high,#171d27)))';
		var muted = 'var(--v-text-2,var(--text-2,var(--text-color-medium,#737a80)))';
		return E('style', {}, [
			'.pwmfan-advanced .cbi-value-field{min-width:0;max-width:460px}',
			'.pwmfan-advanced .cbi-value-field select,.pwmfan-advanced .cbi-dropdown{width:100%;max-width:100%;box-sizing:border-box}',
			'.pwmfan-advanced .cbi-value-description{max-width:70ch}',
			'.pwmfan-advanced .cbi-map > h2{font-size:21px;margin:0 0 4px}',
			'.pwmfan-advanced .cbi-map-descr{margin:0 0 14px;font-size:13px}',
			'.pwmfan-advanced .cbi-value{scroll-margin-bottom:24px}',
			/* Dock the LuCI command bar: while it floats it covers the field row beneath it. */
			'.cbi-page-actions{position:static;bottom:auto;margin:18px 0 0 auto}',
			'.pwmfan-group-heading{margin:18px 0 10px}',
			'.pwmfan-group-heading h3{font-size:15px;font-weight:650;margin:0}',
			'.pwmfan-group-heading p{font-size:12px;color:' + muted + ';margin:5px 0 0}',
			'.pwmfan-advanced .cbi-value:first-child .pwmfan-group-heading{margin-top:0}'
		].join(''));
	},

	form: function() {
		var map = new form.Map(CONFIG, _('Advanced fan settings'), _('Fan policy grouped by behavior'));
		var section = map.section(form.NamedSection, SECTION, 'settings');
		section.anonymous = true;
		this.group(section, 'kernel', _('Kernel protection'), '');
		var takeover = section.option(form.Flag, 'kernel_takeover', _('Take over kernel protection'));
		takeover.default = '0'; takeover.rmempty = false;
		takeover.readonly = true;
		takeover.description = _('When enabled, the plugin owns CPU fan control from −20 °C through 100 °C. Kernel thermal-zone control above 100 °C remains active. Hardware verification is pending.');
		var enabled = section.option(form.Flag, 'enabled', _('Enable fan control'));
		enabled.default = '0'; enabled.rmempty = false;
		enabled.description = _('When disabled, the controller releases PWM ownership and keeps status visible.');
		this.percentOption(section, 'min_pwm', _('Minimum fan output'), 20);
		this.percentOption(section, 'max_pwm', _('Maximum curve output'), 100);
		this.group(section, 'temperature', _('Temperature protection'), _('Protection ramps up before the threshold, locks at 100%, and releases below the threshold by the configured hysteresis.'));
		var safety = section.option(form.Value, 'protection_temp', _('Full-speed temperature threshold (°C)'));
		safety.datatype = 'range(80,100)'; safety.default = '90'; safety.rmempty = false;
		safety.validate = function(sectionId, value) {
			return uci.get(CONFIG, sectionId, 'mode') !== 'target' || Number(value) >= Number(uci.get(CONFIG, sectionId, 'target_temp') || 85) || _('The protection threshold must be at or above the target.');
		};
		var radius = section.option(form.Value, 'protection_radius', _('Acceleration radius (°C)'));
		radius.datatype = 'range(15,140)'; radius.default = '15'; radius.rmempty = false;
		radius.validate = function(sectionId, value) {
			return Number(value) <= Number(safety.formvalue(sectionId) || 90) + 40 || _('The acceleration start must be at least −40 °C.');
		};
		var release = section.option(form.Value, 'protection_release', _('Release hysteresis (°C)'));
		release.datatype = 'range(2,100)'; release.default = '5'; release.rmempty = false;
		this.group(section, 'downshift', _('Downshift hysteresis'), _('Avoid rapid fan-speed drops when temperature fluctuates near a curve point.'));
		var hysteresis = section.option(form.Value, 'hysteresis', _('Temperature hysteresis (°C)'));
		hysteresis.datatype = 'range(0,30)'; hysteresis.default = '3'; hysteresis.rmempty = false;
		var delay = section.option(form.Value, 'down_delay', _('Downshift delay (seconds)'));
		delay.datatype = 'range(0,600)'; delay.default = '10'; delay.rmempty = false;
		this.group(section, 'boost', _('Startup boost'), _('Briefly raise output when the fan starts, then return to the selected curve.'));
		this.percentOption(section, 'kick_pwm', _('Startup boost output'), 100);
		var kick = section.option(form.Value, 'kick_ms', _('Startup boost duration (milliseconds)'));
		kick.datatype = 'range(0,5000)'; kick.default = '750'; kick.rmempty = false;
		this.group(section, 'fault', _('Fault response'), _('Invalid temperature data or a failed PWM write requests full output.'));
		var failure = section.option(form.DummyValue, '_failsafe', _('Sensor or controller fault'));
		failure.default = _('Request 100% output; kernel thermal safeguards remain active.');
		this.group(section, 'sampling', _('Controller sampling and curve source'), _('The controller reads one sensor snapshot per control cycle. This is separate from the dashboard history sampling interval. Sensors not selected for curve control still participate in the safety maximum.'));
		var interval = section.option(form.Value, 'poll_interval', _('Control interval (seconds)'));
		interval.datatype = 'range(1,30)'; interval.default = '2'; interval.rmempty = false;
		var source = section.option(form.Value, 'sensor_sources', _('Curve sensor source'));
		source.width = '100%';
		source.value('auto', _('Hottest valid sensor'));
		source.default = 'auto'; source.rmempty = false;
		return map;
	},

	handleSave: function() {
		return this.map.save();
	},

	handleSaveApply: function() {
		return this.handleSave().then(function() { return uci.apply(); }).then(function() {
			ui.addNotification(null, E('p', {}, _('Settings applied.')), 'info');
		});
	},

	handleReset: function() {
		return this.map.reset();
	},

	render: function() {
		this.map = this.form();
		return this.map.render().then(L.bind(function(formNode) {
			return E('div', { 'class': 'pwmfan-advanced' }, [this.style(), formNode]);
		}, this));
	}
});
