'use strict';
'require view';
'require form';
'require uci';

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

	group: function(section, title, description) {
		var option = section.option(form.DummyValue, '_group_' + title.replace(/\W/g, '_'), title);
		option.default = description;
		option.renderWidget = function() {
			return E('div', { 'class': 'pwmfan-group-heading' }, [ E('h3', {}, title), E('p', {}, description) ]);
		};
	},

	style: function() {
		return E('style', {}, '.pwmfan-advanced .cbi-section{border:1px solid var(--v-line,var(--border-color-medium,#d8dce0));border-radius:5px;background:var(--v-surface,var(--background-color-high,#fff));padding:14px}.pwmfan-group-heading{border-top:1px solid var(--v-line,var(--border-color-medium,#d8dce0));padding-top:15px;margin:4px 0 12px}.pwmfan-group-heading h3{font-size:16px;margin:0}.pwmfan-group-heading p{font-size:12px;color:var(--v-text-2,var(--text-color-medium,#737a80));margin:5px 0 0}.pwmfan-advanced .cbi-value-description{max-width:70ch}.pwmfan-advanced .cbi-page-actions{position:static}');
	},

	form: function() {
		var map = new form.Map(CONFIG, _('Advanced fan settings'));
		var section = map.section(form.NamedSection, SECTION, 'settings');
		section.anonymous = true;
		this.group(section, _('Protection'), _('Kernel thermal protection stays enabled. This package does not change CPU passive, hot, or critical trips.'));
		var enabled = section.option(form.Flag, 'enabled', _('Enable fan control'));
		enabled.default = '0'; enabled.rmempty = false;
		enabled.description = _('When disabled, the controller releases PWM ownership and keeps status visible.');
		this.percentOption(section, 'min_pwm', _('Minimum fan output'), 20);
		this.percentOption(section, 'max_pwm', _('Maximum curve output'), 100);
		var safety = section.option(form.Value, 'safety_temp', _('Full-speed temperature threshold (°C)'));
		safety.datatype = 'range(40,125)'; safety.default = '85'; safety.rmempty = false;
		this.group(section, _('Downshift hysteresis'), _('Avoid rapid fan-speed drops when temperature fluctuates near a curve point.'));
		var hysteresis = section.option(form.Value, 'hysteresis', _('Temperature hysteresis (°C)'));
		hysteresis.datatype = 'range(0,30)'; hysteresis.default = '3'; hysteresis.rmempty = false;
		var delay = section.option(form.Value, 'down_delay', _('Downshift delay (seconds)'));
		delay.datatype = 'range(0,600)'; delay.default = '10'; delay.rmempty = false;
		this.group(section, _('Startup boost'), _('Briefly raise output when the fan starts, then return to the selected curve.'));
		this.percentOption(section, 'kick_pwm', _('Startup boost output'), 100);
		var kick = section.option(form.Value, 'kick_ms', _('Startup boost duration (milliseconds)'));
		kick.datatype = 'range(0,5000)'; kick.default = '750'; kick.rmempty = false;
		this.group(section, _('Fault response'), _('Invalid temperature data or a failed PWM write requests full output.'));
		var failure = section.option(form.DummyValue, '_failsafe', _('Sensor or controller fault'));
		failure.default = _('Request 100% output; kernel thermal safeguards remain active.');
		this.group(section, _('Sampling and source'), _('The controller reads one sensor snapshot per control cycle. Sensors not selected for curve control still participate in the safety maximum.'));
		var interval = section.option(form.Value, 'poll_interval', _('Control interval (seconds)'));
		interval.datatype = 'range(1,30)'; interval.default = '2'; interval.rmempty = false;
		var source = section.option(form.Value, 'sensor_sources', _('Curve sensor source'));
		source.value('auto', _('Hottest valid sensor'));
		source.default = 'auto'; source.rmempty = false;
		return map;
	},

	render: function() {
		return this.form().render().then(L.bind(function(formNode) {
			return E('div', { 'class': 'pwmfan-advanced' }, [
				this.style(),
				E('header', { 'class': 'pwmfan-header' }, [
					E('div', {}, [ E('h2', {}, _('Advanced settings')), E('p', {}, _('Fan policy grouped by behavior')) ]),
					E('a', { 'class': 'btn', 'href': L.url('admin/system/h5000m_pwmfan/dashboard') }, _('Back to dashboard'))
				]),
				formNode
			]);
		}, this));
	}
});
