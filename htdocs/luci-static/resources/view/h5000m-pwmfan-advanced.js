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
			'.pwmfan-advanced{font-family:var(--v-font,var(--font,system-ui,-apple-system,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,sans-serif))}',
			'.pwmfan-advanced .cbi-value-field{min-width:0;max-width:460px}',
			'.pwmfan-advanced .cbi-value-field select,.pwmfan-advanced .cbi-dropdown{width:100%;max-width:100%;box-sizing:border-box}',
			'.pwmfan-advanced .cbi-value-description{display:block;max-width:70ch}',
			'.pwmfan-advanced .cbi-map > h2{font-size:21px;margin:0 0 4px}',
			'.pwmfan-advanced .cbi-map-descr{margin:0 0 14px;font-size:13px}',
			'.pwmfan-advanced .cbi-value{scroll-margin-bottom:24px}',
			/* Dock the LuCI command bar: while it floats it covers the field row beneath it. */
			'.cbi-page-actions{position:static;bottom:auto;margin:18px 0 0 auto}',
			/* Each behavior group becomes its own card so the six blocks read as sections. */
			'.pwmfan-advanced .cbi-map > .cbi-section{padding:0;background:none;border:0;box-shadow:none}',
			'.pwmfan-advanced .cbi-section-node{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start;padding:0}',
			'.pwmfan-advanced .pf-group{background:var(--v-surface,var(--s1,light-dark(#ffffff,#1c2129)));border-radius:8px;padding:12px 14px 14px}',
			'@media (min-width: 992px){.pwmfan-advanced .cbi-section-node{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}',
			'.pwmfan-advanced{--sw-on:var(--accent,#8db20f);--sw-off:color-mix(in srgb,var(--text-2,#4a515a) 24%,var(--s3,#eef0f3));--sw-thumb:var(--s2,#ffffff)}',
			/* Flag rows put the checkbox in a 16px gutter; the description must sit under the label, not under the box. */
			'.pwmfan-advanced .cbi-value:has(> .cbi-value-field > .cbi-checkbox) > .cbi-value-field > .cbi-value-description{grid-column:2 / -1}',
			'.pwmfan-advanced .cbi-value{padding:8px 0;row-gap:8px}',
			/* Boolean rows: label and help on the left, one switch pinned to the right edge. */
			'.pwmfan-advanced .pf-flag-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:8px 0}',
			'.pwmfan-advanced .pf-flag-main{flex:1 1 auto;min-width:0}',
			'.pwmfan-advanced .pf-flag-main .cbi-value-title{display:block}',
			'.pwmfan-advanced .pf-flag-main .cbi-value-description{margin-top:5px;max-width:60ch}',
			'.pwmfan-advanced .pf-switch{position:relative;display:inline-flex;flex:none;margin-top:1px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
			'.pwmfan-advanced .pf-switch input{position:absolute;width:0;height:0;opacity:0}',
			'.pwmfan-advanced .pf-switch .pf-track{position:relative;display:block;width:46px;height:26px;border-radius:7px;background:var(--sw-off);transition:background .28s ease}',
			'.pwmfan-advanced .pf-switch .pf-thumb{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:5px;background:var(--sw-thumb);box-shadow:0 1px 2px rgba(0,0,0,.28);transition:transform .28s cubic-bezier(.22,1,.36,1)}',
			'.pwmfan-advanced .pf-switch input:checked + .pf-track{background:var(--sw-on)}',
			'.pwmfan-advanced .pf-switch input:checked + .pf-track .pf-thumb{transform:translateX(20px)}',
			'.pwmfan-advanced .pf-switch input:focus-visible + .pf-track{outline:2px solid var(--accent-line,var(--accent));outline-offset:2px}',
			'.pwmfan-advanced .pf-switch input:disabled + .pf-track{opacity:.45}',
			'.pwmfan-advanced .pf-switch:has(input:disabled){cursor:not-allowed}',
			'.pwmfan-advanced .cbi-value.pf-note-row{padding:4px 0}',
			'.pwmfan-advanced .cbi-value.pf-note-row > .cbi-value-title{font-weight:500;color:' + muted + '}',
			'.pwmfan-advanced .cbi-value.pf-note-row > .cbi-value-field{color:' + muted + ';font-size:12.5px}',
			'@media (prefers-reduced-motion: reduce){.pwmfan-advanced .pf-switch .pf-track,.pwmfan-advanced .pf-switch .pf-thumb{transition:none}}',
			'.pwmfan-group-heading{margin:0 0 10px}',
			'.pwmfan-group-heading h3{font-size:15.5px;font-weight:650;margin:0}',
			'.pwmfan-group-heading p{font-size:12px;color:' + muted + ';margin:5px 0 0}'
		].join(''));
	},

	form: function() {
		var map = new form.Map(CONFIG, _('Advanced fan settings'), _('Fan policy grouped by behavior'));
		var section = map.section(form.NamedSection, SECTION, 'settings');
		section.anonymous = true;
		this.group(section, 'kernel', _('Kernel protection'), '');
		var takeover = section.option(form.Flag, 'enabled', _('Take over fan control'));
		takeover.default = '0'; takeover.rmempty = false;
		var verified = uci.get(CONFIG, SECTION, 'takeover_verified') === '1';
		takeover.description = verified
			? _('Drives the fan from the plugin; the kernel keeps throttling and the critical shutdown.')
			: _('Drives the fan from the plugin; not verified yet, so it stays off.');
		takeover.cfgvalue = function(sectionId) {
			return (uci.get(CONFIG, sectionId, 'enabled') === '1' && uci.get(CONFIG, sectionId, 'kernel_takeover') === '1') ? '1' : null;
		};
		takeover.readonly = !verified;
		this.percentOption(section, 'min_pwm', _('Minimum fan output'), 20);
		this.percentOption(section, 'max_pwm', _('Maximum curve output'), 100);
		this.group(section, 'temperature', _('Temperature protection'), _('Protection ramps up before the threshold, locks at 100%, and releases below the threshold by the configured hysteresis.'));
		var safety = section.option(form.Value, 'protection_temp', _('Full-speed temperature threshold (°C)'));
		safety.datatype = 'range(80,100)'; safety.default = '90'; safety.rmempty = false;
		safety.validate = function(sectionId, value) {
			return uci.get(CONFIG, sectionId, 'mode') !== 'target' || Number(value) >= Number(uci.get(CONFIG, sectionId, 'target_temp') || 85) || _('The protection threshold must be at or above the target.');
		};
		var radius = section.option(form.Value, 'protection_radius', _('Early ramp window (°C)'));
		radius.datatype = 'range(15,140)'; radius.default = '15'; radius.rmempty = false;
		radius.validate = function(sectionId, value) {
			return Number(value) <= Number(safety.formvalue(sectionId) || 90) + 40 || _('The early ramp window can reach at most 40 °C below the threshold.');
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
		// One switch owns both uci keys: the daemon needs them to agree.
		var input = document.querySelector('.pf-switch input');
		if (input) {
			var on = input.checked ? '1' : '0';
			uci.set(CONFIG, SECTION, 'enabled', on);
			uci.set(CONFIG, SECTION, 'kernel_takeover', on);
		}
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

	decorateNotes: function(formNode) {
		Array.prototype.forEach.call(formNode.querySelectorAll('.cbi-value[data-name="_failsafe"]'), function(row) {
			row.classList.add('pf-note-row');
		});
	},

	decorateFlags: function(formNode) {
		Array.prototype.forEach.call(formNode.querySelectorAll('.cbi-value'), function(row) {
			var box = row.querySelector('.cbi-checkbox');
			var input = box ? box.querySelector('input[type="checkbox"]') : null;
			if (!input) return;
			var title = row.querySelector('.cbi-value-title');
			var desc = row.querySelector('.cbi-value-description');
			var main = E('div', { 'class': 'pf-flag-main' }, desc ? [title, desc] : [title]);
			var sw = E('label', { 'class': 'pf-switch' }, [
				input,
				E('span', { 'class': 'pf-track' }, [E('span', { 'class': 'pf-thumb' })])
			]);
			row.classList.add('pf-flag-row');
			row.replaceChildren(main, sw);
		});
	},

	groupCards: function(formNode) {
		var host = formNode.querySelector('.cbi-section-node');
		if (!host) return;
		var rows = [];
		var node = host.firstElementChild;
		while (node) { if (node.classList.contains('cbi-value')) rows.push(node); node = node.nextElementSibling; }
		var current = null;
		rows.forEach(function(row) {
			if (row.querySelector('.pwmfan-group-heading')) {
				current = E('section', { 'class': 'pf-group' });
				host.insertBefore(current, row);
			}
			if (current) current.appendChild(row);
		});
	},

	render: function() {
		this.map = this.form();
		return this.map.render().then(L.bind(function(formNode) {
			this.groupCards(formNode);
			this.decorateFlags(formNode);
			this.decorateNotes(formNode);
			return E('div', { 'class': 'pwmfan-advanced' }, [this.style(), formNode]);
		}, this));
	}
});
