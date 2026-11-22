'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';
'require view.h5000m-pwmfan-shared as shared';

var CONFIG = 'h5000m_pwmfan';
var SECTION = 'main';
var SENSOR_TAGS = function(label) {
	if (/^tz_/.test(label)) return _('thermal zone');
	if (/^hwmon/.test(label)) return 'hwmon';
	var phy = label.match(/phy0[._](\d)/i);
	if (phy) return 'PHY' + phy[1];
	if (/^mdio/.test(label)) return 'mdio';
	return label;
};
var SENSOR_NAMES = [
	[ _('CPU'), /^cpu[-_]thermal$|^cpu_thermal(?:_temp1)?$/i ],
	[ _('Radio'), /^mt7996[-_]phy0[._][01](?:_temp1)?$/i ],
	[ _('5G modem'), /^(?:modem|mt5700m)$/i ],
	[ _('PHY'), /^(?:mdio_bus|phy)/i ]
];

return view.extend({
	load: function() {
		return Promise.all([ uci.load(CONFIG), this.fetchSensors() ]);
	},

	fetchSensors: function() {
		return fs.exec('/usr/sbin/h5000m-pwmfan-status').then(L.bind(function(result) {
			var fields = {};
			(result.stdout || '').split('\n').forEach(function(line) {
				var boundary = line.indexOf('=');
				if (boundary > 0) fields[line.slice(0, boundary)] = line.slice(boundary + 1);
			});
			var sensors = (fields.sensors || '').split(';').filter(function(row) {
				return row.split('|').length === 4;
			}).map(function(row) {
				var parts = row.split('|'), label = parts[1], value = Number(parts[2]);
				var named = SENSOR_NAMES.find(function(entry) { return entry[1].test(label); });
				return {
					label: label,
					title: named ? named[0] : label,
					state: parts[3],
					celsius: isFinite(value) && parts[2] !== '--' ? (Math.round(value / 100) / 10).toFixed(1) : null
				};
			});
			// Several probes can carry the same friendly name; keep them distinguishable
			// without letting the dropdown grow past the control width.
			var counts = {};
			sensors.forEach(function(sensor) { counts[sensor.title] = (counts[sensor.title] || 0) + 1; });
			sensors.forEach(function(sensor) {
				if (counts[sensor.title] > 1) sensor.title += '（' + SENSOR_TAGS(sensor.label) + '）';
			});
			this.sensors = sensors;
			this.status = fields;
		}, this)).catch(function() { this.sensors = []; });
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
			return E('div', { 'class': 'pwmfan-group-heading' }, [ E('h2', {}, title), E('p', {}, description) ]);
		};
	},

	style: function() {
		var line = 'var(--v-line,var(--line,var(--border-color-medium,#d8dce0)))';
		var text = 'var(--v-text,var(--text,var(--text-color-high,#171d27)))';
		var muted = 'var(--v-text-2,var(--text-2,var(--text-color-medium,#737a80)))';
		return E('style', {}, [
			'.pwmfan-advanced{font-family:var(--v-font,var(--font,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans CJK SC","Microsoft YaHei",sans-serif))}',
			'.pwmfan-advanced{--pf-surface:var(--v-surface,light-dark(#fff,#1c2129));--pf-subtle:var(--v-surface-2,light-dark(#f5f7fa,#222832));--pf-line:var(--v-line,light-dark(#dbe2eb,#364150));--pf-text:var(--v-text,light-dark(#171d27,#ebeff6));--pf-muted:var(--v-text-2,light-dark(#505e70,#b5c1d1));--pf-green:var(--v-ok,#169974);--pf-amber:light-dark(#8f4c00,#ffc26d);--pf-red:var(--v-err,light-dark(#b62b42,#ff8a9b))}',
			'.pwmfan-advanced .pf-adv-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 12px}',
			'.pwmfan-advanced .pf-heading-gap{flex:1 1 auto}',
			'.pwmfan-advanced .pf-adv-head .pf-live{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 10px;color:var(--pf-muted);background:var(--pf-surface);border:1px solid var(--pf-line);border-radius:9px;white-space:nowrap}',
			'.pwmfan-advanced .pf-adv-head .pf-live span{min-width:0;text-overflow:ellipsis;overflow:hidden}',
			'.pwmfan-advanced .pf-adv-head .pf-live i{width:8px;height:8px;flex:none;border-radius:50%;background:currentColor}',
			'.pwmfan-advanced .pf-adv-head .pf-live[data-state=ok] i{color:var(--pf-green)}',
			'.pwmfan-advanced .pf-adv-head .pf-live[data-state=warn] i{color:var(--pf-amber)}',
			'.pwmfan-advanced .pf-adv-head .pf-live[data-state=fault] i{color:var(--pf-red)}',
			'.pwmfan-advanced .pf-adv-head .pf-switch{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;flex:none;border:1px solid var(--pf-line);border-radius:9px;color:var(--pf-muted);background:var(--pf-surface);box-shadow:none}',
			'.pwmfan-advanced .pf-adv-head .pf-switch:hover{color:var(--pf-text);border-color:var(--pf-muted);background:var(--pf-subtle)}',
			'.pwmfan-advanced .pf-adv-head .pf-switch-icon,.pwmfan-advanced .pf-adv-head .pf-switch-icon svg{display:block;width:16px;height:16px}',
			'.pwmfan-advanced .pf-adv-head .pf-switch svg path{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}',
			'.pwmfan-advanced .pf-adv-head .pf-switch svg path.pf-fill{fill:currentColor;stroke:none}',
			'.pwmfan-advanced .pf-lang-glyph{font-size:11px;font-weight:650;letter-spacing:-.01em;line-height:1;white-space:nowrap}',
			'.pwmfan-advanced .cbi-value-field{min-width:0;max-width:460px}',
			'.pwmfan-advanced .cbi-value-field input.cbi-input-text,.pwmfan-advanced .cbi-value-field select{height:36px;min-height:36px;font-size:13px;padding-top:5px;padding-bottom:5px;box-sizing:border-box}',
			'.pwmfan-advanced .cbi-value-field select{width:100%;max-width:100%;box-sizing:border-box}',
			'.pwmfan-advanced .cbi-value-description{display:block;max-width:78ch;font-size:12px;line-height:18px;margin:6px 0 0;color:' + muted + ';-webkit-line-clamp:unset;line-clamp:unset;max-height:none;overflow:visible}',
			'.pwmfan-advanced .cbi-value-description[data-v-end]{clip-path:none !important}',
			'.pwmfan-advanced .cbi-value > .vt-help{display:none}',
			'.pwmfan-advanced .cbi-value[data-v-help="fold"] > .cbi-value-field > .vt-help-text{max-height:none;overflow:visible}',
			'.pwmfan-advanced .vt-help-text[data-v-end="fade"]{mask-image:none !important}',
			'.pwmfan-advanced .cbi-map > h2{font-size:21px;margin:0 0 4px}',
			'.pwmfan-advanced .cbi-map-descr{margin:0 0 14px;font-size:13px}',
			'.pwmfan-advanced .cbi-value{scroll-margin-bottom:24px}',
			/* Each behavior group becomes its own card so the six blocks read as sections. */
			'.pwmfan-advanced .cbi-map > .cbi-section{padding:0;background:none;border:0;box-shadow:none}',
			'.pwmfan-advanced .cbi-section-node{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start;padding:0}',
			'.pwmfan-advanced .pf-group{background:var(--v-surface,var(--s1,light-dark(#ffffff,#1c2129)));border-radius:8px;padding:12px 14px 14px}',
			/* Below the two-card layout keep the label above its control: the theme's fixed 180px
			   label column wraps and leaves a dead gap inside a single wide card. */
			'@media (max-width: 991px){.pwmfan-advanced .pf-group > .cbi-value{grid-template-columns:minmax(0,1fr);row-gap:8px}'
				+ '.pwmfan-advanced .pf-group > .cbi-value > .cbi-value-field{grid-column:1}}',
			'@media (min-width: 992px){.pwmfan-advanced .pf-group > .cbi-value{grid-template-columns:minmax(0,0.46fr) minmax(0,1fr)}}',
			'.pwmfan-advanced{--sw-on:var(--accent,#8db20f);--sw-off:color-mix(in srgb,var(--text-2,#4a515a) 24%,var(--s3,#eef0f3));--sw-thumb:var(--s2,#ffffff)}',
			/* Flag rows put the checkbox in a 16px gutter; the description must sit under the label, not under the box. */
			'.pwmfan-advanced .cbi-value:has(> .cbi-value-field > .cbi-checkbox) > .cbi-value-field > .cbi-value-description{grid-column:2 / -1}',
			'.pwmfan-advanced .cbi-value{padding:8px 0;row-gap:8px}',
			/* Boolean rows: label and help on the left, one switch pinned to the right edge. */
			'.pwmfan-advanced .pf-flag-row{display:grid;grid-template-columns:minmax(0,1fr);row-gap:8px;align-items:start;padding:8px 0}',
			'.pwmfan-advanced .pf-flag-main{min-width:0}',
			'@media (min-width:992px){.pwmfan-advanced .pf-flag-row{grid-template-columns:minmax(0,0.46fr) minmax(0,1fr);column-gap:20px}}',
			'.pwmfan-advanced .pf-flag-row > .pf-flag-main{grid-column:1}',
			'.pwmfan-advanced .pf-flag-row > .pf-toggle{grid-column:1;justify-self:start}',
			'@media (min-width:992px){.pwmfan-advanced .pf-flag-row > .pf-toggle{grid-column:2}}',
			'.pwmfan-advanced .pf-flag-main .cbi-value-title{display:block;line-height:24px;margin:0}',
			'.pwmfan-advanced .pf-flag-main .cbi-value-description{margin-top:6px;max-width:60ch}',
			'.pwmfan-advanced .pf-toggle{position:relative;display:inline-flex;flex:none;margin-top:1px;cursor:pointer;-webkit-tap-highlight-color:transparent}',
			'.pwmfan-advanced .pf-toggle input{position:absolute;width:0;height:0;opacity:0}',
			'.pwmfan-advanced .pf-toggle .pf-track{position:relative;display:block;width:44px;height:24px;border-radius:6px;background:var(--sw-off);transition:background .28s ease}',
			'.pwmfan-advanced .pf-toggle .pf-thumb{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:4px;background:var(--sw-thumb);box-shadow:0 1px 2px rgba(0,0,0,.28);transition:transform .28s cubic-bezier(.22,1,.36,1)}',
			'.pwmfan-advanced .pf-toggle input:checked + .pf-track{background:var(--sw-on)}',
			'.pwmfan-advanced .pf-toggle input:checked + .pf-track .pf-thumb{transform:translateX(20px)}',
			'.pwmfan-advanced .pf-toggle input:focus-visible + .pf-track{outline:2px solid var(--accent-line,var(--accent));outline-offset:2px}',
			'.pwmfan-advanced .pf-toggle input:disabled + .pf-track{opacity:.45}',
			'.pwmfan-advanced .pf-toggle:has(input:disabled){cursor:not-allowed}',
			'.pwmfan-advanced .pf-unit-host{display:flex;align-items:center;gap:6px}',
			'.pwmfan-advanced .pf-unit-host > input{flex:1 1 auto;min-width:0;max-width:none;text-align:right;padding-right:10px}',
			'.pwmfan-advanced .pf-unit-host > select,.pwmfan-advanced .pf-unit-host > .cbi-dropdown{flex:1 1 0;min-width:0;width:auto;max-width:100%}',
			/* LuCI's apply button is a flex dropdown; with align-items:stretch the theme's
			   spinner lands in the top-left corner. The bar sits outside the view node, so
			   markActions() tags it with .pf-actions. */
			'.pf-actions .cbi-button.spinning{align-items:center}',
			/* Keep the apply bar in reach on a long form: it floats over the page
			   like the stock settings pages, with the pending count on the left. */
			'.pf-actions{position:sticky;bottom:0;z-index:20;display:flex;align-items:center;justify-content:flex-end;'
				+ 'gap:8px;width:100%;box-sizing:border-box;flex-wrap:nowrap;margin:18px 0 0;padding:10px 12px;border:1px solid ' + line + ';border-radius:10px;'
				+ 'background:color-mix(in srgb,var(--v-surface,var(--s1,light-dark(#ffffff,#1c2129))) 94%,transparent);'
				+ '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.16)}',
			'.pf-actions .pf-actions-hint{flex:1 1 auto;min-width:0;margin-right:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:' + muted + '}',
			'.pwmfan-advanced .pf-unit{flex:0 0 30px;width:30px;text-align:left;font-size:12px;line-height:1;color:' + muted + ';background:transparent;font-variant-numeric:tabular-nums}',
			'.pwmfan-advanced .cbi-value > .pf-wide-note{grid-column:1 / -1;margin:6px 0 0;max-width:78ch;font-size:12px;line-height:18px}',
			'.pwmfan-advanced .cbi-value.pf-note-row{padding:8px 0;row-gap:4px}',
			'.pwmfan-advanced .cbi-value.pf-note-row > .cbi-value-field{min-height:0;padding:0;line-height:1.5}',
			'.pwmfan-advanced .cbi-value.pf-note-row > .cbi-value-title{font-weight:500;color:' + muted + '}',
			'.pwmfan-advanced .cbi-value.pf-note-row > .cbi-value-field{color:' + muted + ';font-size:12px;line-height:18px}',
			'@media (prefers-reduced-motion: reduce){.pwmfan-advanced .pf-toggle .pf-track,.pwmfan-advanced .pf-toggle .pf-thumb{transition:none}}',
			'.pwmfan-group-heading{margin:0 0 10px}',
			'.pwmfan-group-heading h2{font-size:15.5px;font-weight:650;margin:0}',
			'.pwmfan-group-heading p{font-size:12px;line-height:18px;color:' + muted + ';margin:6px 0 0}'
		].join(''));
	},

	form: function() {
		var map = new form.Map(CONFIG);
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
		// The daemon needs `enabled` and `kernel_takeover` to agree, so one switch
		// writes both keys; reading them back off the DOM broke after a re-render.
		takeover.write = function(sectionId, value) {
			// LuCI hands the checked state over as a string, a boolean or ''.
			// Read the switch itself when it is on screen so both forms agree.
			var input = document.querySelector('label.pf-toggle input');
			var on = input
				? (input.checked ? '1' : '0')
				: (value === '1' || value === true || value === 1 ? '1' : '0');
			uci.set(CONFIG, sectionId, 'enabled', on);
			uci.set(CONFIG, sectionId, 'kernel_takeover', on);
			return on;
		};
		var floor = this.percentOption(section, 'min_pwm', _('Non-zero request floor (%)'), 20);
		floor.description = _('Except for an explicit 0% stop request, no request drives the fan below this value. A higher floor keeps an aging or dusty fan turning at low duty.');
		var ceiling = this.percentOption(section, 'max_pwm', _('Curve output ceiling (%)'), 100);
		ceiling.description = _('No request, protection ramp or startup boost drives the fan above this value. Lowering it caps high-speed noise, including the whine a small fan makes near full duty, at the cost of the highest speed protection can still reach; a fault still asks for a full 100%.');
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
		this.percentOption(section, 'kick_pwm', _('Startup boost output (%)'), 100);
		var kick = section.option(form.Value, 'kick_ms', _('Startup boost duration (milliseconds)'));
		kick.datatype = 'range(0,5000)'; kick.default = '750'; kick.rmempty = false;
		this.group(section, 'fault', _('Fault response'),
			_('When a sensor reading is unusable or a PWM write fails, the controller asks for 100% output instead of guessing. This behaviour is fixed and has no switch; CPU throttling and the critical shutdown still belong to the kernel.'));
		this.group(section, 'curveview', _('Fan curve settings'),
			_('How often the controller samples and which sensor feeds the fan curve.'));
		var interval = section.option(form.Value, 'poll_interval', _('Control interval (seconds)'));
		interval.datatype = 'range(1,30)'; interval.default = '2'; interval.rmempty = false;
		var source = section.option(form.ListValue, 'sensor_sources', _('Curve sensor source'));
		source.description = _('A reading counts as valid when the sensor file is readable and the value is within −40…150 °C; sensors without a valid reading are skipped. The fan curve above — the temperature-to-output curve, not the history chart — follows this sensor, or the highest valid one when “All sensors” is selected. Sensors outside the choice still count toward the safety maximum.');
		source.width = '100%';
		source.value('auto', _('All sensors (highest valid reading)'));
		(this.sensors || []).forEach(function(sensor) {
			source.value(sensor.label, sensor.title + (sensor.celsius !== null ? ' · ' + sensor.celsius + ' °C' : ' · ' + _('no reading')));
		});
		source.default = 'auto'; source.rmempty = false; source.optional = false;
		this.group(section, 'histview', _('Temperature monitor settings'),
			_('How the temperature monitor chart is drawn.'));
		var window = section.option(form.Value, 'history_range', _('Monitor window (minutes)'));
		window.datatype = 'range(5,360)'; window.default = '15'; window.rmempty = false;
		window.description = _('How far back the temperature monitor chart reaches.');
		var read = section.option(form.Value, 'history_interval', _('Monitor interval (seconds)'));
		read.datatype = 'range(1,60)'; read.default = '2'; read.rmempty = false;
		read.description = _('How often the temperature monitor chart takes a new sample.');
		return map;
	},

	refreshSensorOptions: function() {
		/* A native select keeps its own selection state, so refreshing a label can never
		   steal a tap. Skip it while the list is open or focused. */
		var row = document.querySelector('.pwmfan-advanced .cbi-value[data-name="sensor_sources"]');
		var select = row ? row.querySelector('select') : null;
		if (!select || document.activeElement === select) return Promise.resolve();
		return this.fetchSensors().then(L.bind(function() {
			(this.sensors || []).forEach(function(sensor) {
				var text = sensor.title + (sensor.celsius !== null ? ' · ' + sensor.celsius + ' °C' : ' · ' + _('no reading'));
				var option = Array.prototype.find.call(select.options, function(node) { return node.value === sensor.label; });
				if (option && option.textContent !== text) option.textContent = text;
			});
		}, this)).catch(function() {});
	},

	handleSave: function() {
		return this.map.save();
	},

	handleSaveApply: function(ev, mode) {
		/* Bare uci.apply() leaves LuCI's change indicator behind ("Unsaved Changes"
		   stays on screen). Follow the stock flow instead: save, then let ui.changes
		   run the apply dialog, clear the indicator and refresh the page. */
		return this.handleSave(ev).then(function() {
			if (ui.changes && typeof ui.changes.apply === 'function')
				return ui.changes.apply(mode !== '1');
			return uci.apply().then(function() {
				ui.addNotification(null, E('p', {}, _('Settings applied.')), 'info');
			});
		});
	},

	handleReset: function() {
		return this.map.reset();
	},

	decorateNotes: function(formNode) {
		Array.prototype.forEach.call(formNode.querySelectorAll('.cbi-value[data-name="_failsafe"]'), function(row) {
			row.classList.add('pf-note-row');
		});
		/* Every explanation reads as a caption under its whole row, so all captions share
		   one left edge and one typography instead of drifting with the field column. */
		Array.prototype.forEach.call(formNode.querySelectorAll('.cbi-value'), function(row) {
			if (row.classList.contains('pf-flag-row')) return;
			var field = row.querySelector('.cbi-value-field');
			var note = field ? field.querySelector('.cbi-value-description') : null;
			if (!note || note.classList.contains('pf-wide-note')) return;
			note.classList.add('pf-wide-note');
			row.appendChild(note);
		});
	},

	decorateUnits: function(formNode) {
		var units = /^\s*(.*?)\s*[（(]\s*([^（）()]{1,14}?)\s*[）)]\s*$/;
		var short = {
			second: 's', seconds: 's', '秒': 's',
			millisecond: 'ms', milliseconds: 'ms', '毫秒': 'ms',
			minute: 'min', minutes: 'min', '分钟': 'min'
		};
		formNode.querySelectorAll('.cbi-value').forEach(function(row) {
			var title = row.querySelector('.cbi-value-title');
			var control = row.querySelector('input.cbi-input-text')
				|| row.querySelector('.cbi-dropdown')
				|| row.querySelector('select');
			if (!control) return;
			if (control.tagName === 'INPUT') {
				control.setAttribute('inputmode', 'numeric');
				control.setAttribute('autocomplete', 'off');
			}
			var unit = '';
			if (title) {
				var m = units.exec(title.textContent || '');
				if (m && m[1] && m[2]) {
					title.textContent = m[1];
					unit = short[m[2].toLowerCase()] || short[m[2]] || m[2];
				}
			}
			var host = control.parentNode;
			if (host.classList.contains('pf-unit-host')) return;
			host.classList.add('pf-unit-host');
			host.appendChild(E('span', { 'class': 'pf-unit' }, unit));
		});
	},

	decorateFlags: function(formNode) {
		Array.prototype.forEach.call(formNode.querySelectorAll('.cbi-value'), function(row) {
			var box = row.querySelector('.cbi-checkbox');
			var input = box ? box.querySelector('input[type="checkbox"]') : null;
			if (!input) return;
			if (row.classList.contains('pf-flag-row') && row.querySelector('label.pf-toggle input')) return;
			var title = row.querySelector('.cbi-value-title');
			var desc = row.querySelector('.cbi-value-description');
			var main = E('div', { 'class': 'pf-flag-main' }, desc ? [title, desc] : [title]);
			var sw = E('label', { 'class': 'pf-toggle' }, [
				input,
				E('span', { 'class': 'pf-track' }, [E('span', { 'class': 'pf-thumb' })])
			]);
			row.classList.add('pf-flag-row');
			row.replaceChildren(main, sw);
		});
	},

	/* The action bar lives outside the view node, so tag it for the spinner fix and
	   fill it with the same pending count LuCI shows in the header. */
	markActions: function() {
		var bar = document.querySelector('.cbi-page-actions');
		if (!bar) return;
		bar.classList.add('pf-actions');
		if (!this.actionsHint) this.actionsHint = E('span', { 'class': 'pf-actions-hint', role: 'status' });
		if (this.actionsHint.parentNode !== bar) bar.insertBefore(this.actionsHint, bar.firstChild);
		if (!this.actionsTimer) this.actionsTimer = window.setInterval(L.bind(this.paintActions, this), 1500);
		this.paintActions();
	},

	paintActions: function() {
		var hint = this.actionsHint;
		if (!hint || !hint.isConnected || document.hidden) return;
		uci.changes().then(L.bind(function(changes) {
			var count = 0;
			Object.keys(changes || {}).forEach(function(config) { count += (changes[config] || []).length; });
			this.actionsDirty = count > 0;
			hint.textContent = count ? _('%d unsaved change(s)').format(count) : _('No unsaved changes');
		}, this)).catch(function() { /* The hint is cosmetic. */ });
	},

	/* LuCI re-renders the form after a save/apply; redecorate the fresh nodes. */
	watchForm: function(formNode) {
		if (typeof MutationObserver !== 'function') return;
		var pending = null;
		var self = this;
		var observer = new MutationObserver(function() {
			if (pending) return;
			pending = window.setTimeout(function() {
				pending = null;
				self.decorateFlags(formNode);
				self.decorateNotes(formNode);
				self.decorateUnits(formNode);
				self.markActions();
			}, 30);
		});
		observer.observe(formNode, { childList: true, subtree: true });
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

	statusBadge: function() {
		var state = shared.statusLabel(this.status);
		this.badgeText = E('span', {}, state.label);
		this.badge = E('span', { 'class': 'pf-live', role: 'status', 'data-state': state.state,
			title: state.reason === 'takeover_pending' ? _('Hardware verification is pending.') : state.label },
			[ E('i', { 'aria-hidden': 'true' }), this.badgeText ]);
		return this.badge;
	},

	headerRow: function() {
		return E('div', { 'class': 'pf-adv-head' }, [ this.statusBadge(),
			E('span', { 'class': 'pf-heading-gap' }), shared.themeSwitcher(), shared.languageSwitcher() ]);
	},

	render: function() {
		window.addEventListener('pagehide', function() {
			if (this._sensorTimer) window.clearInterval(this._sensorTimer);
		}.bind(this));
		this.map = this.form();
		return this.map.render().then(L.bind(function(formNode) {
			this.groupCards(formNode);
			this.decorateFlags(formNode);
			this.decorateNotes(formNode);
			this.decorateUnits(formNode);
			this.markActions();
			window.setTimeout(L.bind(this.markActions, this), 0);
			window.addEventListener('beforeunload', function(event) {
				/* Only guard real unsaved edits; the banner stays silent otherwise. */
				if (!this.actionsDirty) return;
				event.preventDefault();
				event.returnValue = '';
			}.bind(this));
			this.watchForm(formNode);
			shared.applyTheme(shared.themeMode());
			this._sensorTimer = window.setInterval(L.bind(this.refreshSensorOptions, this), 5000);
			return E('div', { 'class': 'pwmfan-advanced' }, [
					this.style(), this.headerRow(), formNode]);
		}, this));
	}
});
