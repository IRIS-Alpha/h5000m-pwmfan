'use strict';
'require view';
'require fs';
'require poll';
'require ui';
'require uci';

var CONFIG = 'h5000m_pwmfan';
var SECTION = 'main';
var MODES = {
	quiet: _('Quiet'),
	balanced: _('Balanced'),
	performance: _('Performance'),
	manual: _('Manual'),
	kernel: _('Kernel'),
	off: _('Off')
};

var history = [];
var chartPrefs = {
	temperature: { range: 15, interval: 2, enabled: true, sensor: 'auto' },
	fan: { range: 15, interval: 2, enabled: true }
};

function loadChartPrefs() {
	try {
		var stored = JSON.parse(window.localStorage.getItem('h5000m-pwmfan-charts') || '{}');
		[ 'temperature', 'fan' ].forEach(function(kind) {
			var item = stored[kind] || {};
			if ([5,15,30,60,360].indexOf(item.range) >= 0) chartPrefs[kind].range = item.range;
			if ([2,5,10].indexOf(item.interval) >= 0) chartPrefs[kind].interval = item.interval;
			if (typeof item.enabled === 'boolean') chartPrefs[kind].enabled = item.enabled;
			if (kind === 'temperature' && typeof item.sensor === 'string') chartPrefs[kind].sensor = item.sensor;
		});
	} catch (e) {}
}

function numeric(value, min, max) {
	if (value == null || value === '' || value === '--') return null;
	var number = Number(value);
	return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function sensorRows(data) {
	return (data.sensors || '').split(';').filter(Boolean).map(function(row) {
		var p = row.split('|'), value = numeric(p[2], -40000, 150000);
		return { id: p[0], label: p[1] || p[0], value: value,
			valid: value !== null && (p[3] === 'ok' || p[3] === 'unselected'), state: p[3] };
	});
}

return view.extend({
	load: function() {
		loadChartPrefs();
		return Promise.all([ uci.load(CONFIG), uci.load('luci'), this.fetchStatus() ]).then(function(result) {
			return result[2];
		});
	},

	fetchStatus: function() {
		return fs.exec('/usr/sbin/h5000m-pwmfan-status').then(function(res) {
			var data = {};
			(res.stdout || '').trim().split(/\n/).forEach(function(line) {
				var pos = line.indexOf('=');
				if (pos > 0)
					data[line.slice(0, pos)] = line.slice(pos + 1);
			});
			return data;
		}).catch(function() { return {}; });
	},

	applyConfig: function() {
		return uci.save().then(function() { return uci.apply(); });
	},

	quickModes: function() {
		var choices = [
			[ 'quiet', '1', _('Quiet') ], [ 'balanced', '1', _('Balanced') ],
			[ 'performance', '1', _('Performance') ], [ 'manual', '1', _('Manual') ],
			[ 'kernel', '1', _('Kernel') ], [ 'balanced', '0', _('Off') ]
		];
		return E('div', { 'class': 'pwmfan-modes', 'role': 'group', 'aria-label': _('Quick dispatch') },
			choices.map(function(item) {
				return E('button', {
					'type': 'button', 'class': 'btn pwmfan-mode',
					'data-mode': item[0], 'data-enabled': item[1],
					'click': L.bind(function(ev) {
						ev.preventDefault();
						uci.set(CONFIG, SECTION, 'mode', item[0]);
						uci.set(CONFIG, SECTION, 'enabled', item[1]);
						document.querySelectorAll('.pwmfan-mode').forEach(function(button) {
							var active = button.dataset.mode === item[0] && button.dataset.enabled === item[1];
							button.classList.toggle('active', active);
							button.setAttribute('aria-pressed', active ? 'true' : 'false');
						});
						this.applyConfig().then(L.bind(function() {
							this.pendingCurve = null;
							return this.fetchStatus().then(L.bind(this.update, this));
						}, this)).catch(function(err) {
							ui.addNotification(null, E('p', _('Could not apply policy: %s').format(err.message)), 'danger');
						});
					}, this)
				}, item[2]);
			}, this));
	},

	curveEditor: function() {
		var points = this.pendingCurve || this.curvePoints(), self = this;
		var rows = points.map(function(point, index) {
			return E('div', { 'class': 'pwmfan-point-row' }, [
				E('label', {}, [ E('span', {}, _('Temperature (°C)')), E('input', {
					'type': 'number', 'min': index ? points[index - 1].t + 1 : 0,
					'max': index < points.length - 1 ? points[index + 1].t - 1 : 110,
					'value': point.t, 'data-index': index, 'data-axis': 'temperature',
					'change': L.bind(self.pointChanged, self)
				}) ]),
				E('label', {}, [ E('span', {}, _('Fan output (%)')), E('input', {
					'type': 'number', 'min': Math.ceil(parseInt(uci.get(CONFIG, SECTION, 'min_pwm') || '51', 10) * 100 / 255),
					'max': 100, 'value': Math.round(point.pwm * 100 / 255),
					'data-index': index, 'data-axis': 'output',
					'change': L.bind(self.pointChanged, self)
				}) ]),
				E('button', { 'type': 'button', 'class': 'btn', 'title': _('Remove point'), 'disabled': points.length <= 2,
					'click': L.bind(function() { self.setCurvePoints(points.filter(function(p, i) { return i !== index; })); }, self)
				}, _('Remove'))
			]);
		});
		return E('div', { 'class': 'pwmfan-curve-editor' }, [
			E('div', { 'class': 'pwmfan-points' }, rows),
			E('button', { 'type': 'button', 'class': 'btn', 'click': L.bind(function() {
				if (points.length >= 10) return;
				var last = points[points.length - 1], temp = Math.min(110, last.t + 10);
				if (temp <= last.t) return;
				this.setCurvePoints(points.concat([{ t: temp, pwm: last.pwm }]));
			}, this) }, _('Add point'))
		]);
	},

	pointChanged: function(ev) {
		var points = (this.pendingCurve || this.curvePoints()).map(function(point) { return { t: point.t, pwm: point.pwm }; });
		var index = parseInt(ev.target.dataset.index, 10), value = parseInt(ev.target.value, 10);
		if (ev.target.dataset.axis === 'temperature') points[index].t = value;
		else points[index].pwm = Math.round(value * 255 / 100);
		this.setCurvePoints(points);
	},

	setCurvePoints: function(points) {
		var min = parseInt(uci.get(CONFIG, SECTION, 'min_pwm') || '51', 10);
		points.sort(function(a, b) { return a.t - b.t; });
		if (points.length < 2 || points.length > 10 || points.some(function(point, index) {
			return !Number.isInteger(point.t) || point.t < 0 || point.t > 110 ||
				(index > 0 && point.t <= points[index - 1].t) || !Number.isInteger(point.pwm) || point.pwm < min || point.pwm > 255;
		})) return;
		this.pendingCurve = points;
		uci.set(CONFIG, SECTION, 'curve_manual', points.map(function(point) { return point.t + ':' + point.pwm; }).join(','));
		uci.set(CONFIG, SECTION, 'mode', 'manual');
		uci.set(CONFIG, SECTION, 'enabled', '1');
		this.drawCurve();
		var editor = document.querySelector('.pwmfan-curve-editor');
		if (editor) editor.replaceWith(this.curveEditor());
		var profile = document.getElementById('pwmfan-profile');
		if (profile) profile.textContent = _('Manual · not applied');
		document.querySelectorAll('.pwmfan-mode').forEach(function(button) {
			var active = button.dataset.mode === 'manual' && button.dataset.enabled === '1';
			button.classList.toggle('active', active);
			button.setAttribute('aria-pressed', active ? 'true' : 'false');
		});
	},

	chartSettings: function(kind, data) {
		var prefs = chartPrefs[kind], options = [ 5, 15, 30, 60, 360 ];
		var controls = [
			E('label', {}, [ E('span', {}, _('Window')), E('select', {
				'class': 'pwmfan-pref', 'data-kind': kind, 'data-pref': 'range',
				'change': L.bind(this.preferenceChanged, this)
			}, options.map(function(minutes) {
				return E('option', { 'value': minutes, 'selected': prefs.range === minutes }, minutes < 60 ? _('%s min').format(minutes) : _('%s hr').format(minutes / 60));
			})) ]),
			E('label', {}, [ E('span', {}, _('Read every')), E('select', {
				'class': 'pwmfan-pref', 'data-kind': kind, 'data-pref': 'interval',
				'change': L.bind(this.preferenceChanged, this)
			}, [ 2, 5, 10 ].map(function(seconds) {
				return E('option', { 'value': seconds, 'selected': prefs.interval === seconds }, _('%s s').format(seconds));
			})) ]),
			E('label', {}, [ E('span', {}, _('Chart')), E('select', {
				'class': 'pwmfan-pref', 'data-kind': kind, 'data-pref': 'enabled',
				'change': L.bind(this.preferenceChanged, this)
			}, [ E('option', { 'value': '1', 'selected': prefs.enabled }, _('Enabled')), E('option', { 'value': '0', 'selected': !prefs.enabled }, _('Off')) ]) ])
		];
		return E('div', { 'class': 'pwmfan-chart-controls' }, controls);
	},

	temperatureSensorControl: function(data) {
		var prefs = chartPrefs.temperature;
		var sensors = (data.sensors || '').split(';').filter(Boolean).map(function(row) {
			var p = row.split('|');
			return p.length >= 4 && (p[3] === 'ok' || p[3] === 'unselected') ? E('option', { 'value': p[0], 'selected': prefs.sensor === p[0] }, p[1].replace(/_/g, ' ')) : null;
		}).filter(Boolean);
		if (!sensors.length) sensors.push(E('option', { 'value': 'auto' }, _('No available sensor')));
		sensors.unshift(E('option', { 'value': 'auto', 'selected': prefs.sensor === 'auto' }, _('Automatic sensor')));
		return E('label', { 'class': 'pwmfan-sensor-select' }, [ E('span', {}, _('Sensor')), E('select', {
			'class': 'pwmfan-pref', 'data-kind': 'temperature', 'data-pref': 'sensor',
			'change': L.bind(this.preferenceChanged, this)
		}, sensors) ]);
	},

	preferenceChanged: function(ev) {
		var control = ev.target, prefs = chartPrefs[control.dataset.kind];
		prefs[control.dataset.pref] = control.dataset.pref === 'enabled' ? control.value === '1' : control.dataset.pref === 'sensor' ? control.value : parseInt(control.value, 10);
		try { window.localStorage.setItem('h5000m-pwmfan-charts', JSON.stringify(chartPrefs)); } catch (e) {}
		this.drawCharts();
	},

	metric: function(title, value, hint) {
		return E('div', { 'class': 'pwmfan-metric', 'data-title': title }, [
			E('span', {}, title), E('strong', {}, value), E('small', {}, hint)
		]);
	},

	temperatureGrid: function(data) {
		var selected = uci.get(CONFIG, SECTION, 'sensor_sources') || 'auto';
		var items = (data.sensors || '').split(';').filter(Boolean).map(function(row) {
			var p = row.split('|');
			if (p.length < 4) return null;
			var value = p[2] === '--' ? _('Unavailable') : _('%.1f °C').format(parseInt(p[2], 10) / 1000);
			var stateLabels = { missing: _('Missing'), invalid: _('Invalid reading'), stale: _('Stale reading'), unsupported: _('Unsupported'), unselected: _('Safety monitoring') };
			var status = p[3] === 'ok' ? (p[0] === selected || selected === 'auto' ? _('Curve and safety') : _('Safety monitoring')) : (stateLabels[p[3]] || p[3]);
			return E('div', { 'class': 'pwmfan-sensor' + (p[0] === selected ? ' selected' : '') }, [
				E('span', {}, p[1].replace(/_/g, ' ')), E('strong', {}, value), E('small', {}, status)
			]);
		}).filter(Boolean);
		if (!items.length)
			items.push(E('div', { 'class': 'pwmfan-empty' }, _('Waiting for sensor readings…')));
		return E('div', { 'class': 'pwmfan-sensors' }, items);
	},

	languageControl: function(data) {
		var lang = uci.get('luci', 'main', 'lang') || 'auto';
		var choices = [ E('option', { 'value': 'en', 'selected': lang !== 'zh_cn' }, _('English')) ];
		if (data.language_zh_available === '1')
			choices.push(E('option', { 'value': 'zh_cn', 'selected': lang === 'zh_cn' }, _('简体中文')));
		return E('select', {
			'class': 'pwmfan-language', 'aria-label': _('Language'),
			'change': function(ev) {
				fs.exec('/usr/sbin/h5000m-pwmfan-language', [ ev.target.value ]).then(function() {
					window.location.reload();
				}).catch(function(err) {
					ui.addNotification(null, E('p', _('Could not change language: %s').format(err.message)), 'danger');
				});
			}
		}, choices);
	},

	style: function() {
		return E('style', {}, [
			'.pwmfan{--pf-accent:var(--v-accent,var(--primary-color,#8aaa20));--pf-chart:var(--v-chart-1,var(--primary-color,#8aaa20));--pf-info:var(--v-chart-2,#347cc1);--pf-bg:var(--v-surface,var(--background-color-high,#fff));--pf-bg-2:var(--v-surface-2,var(--background-color-low,#f4f5f6));--pf-border:var(--v-line,var(--border-color-medium,#d8dce0));--pf-muted:var(--v-text-2,var(--text-color-medium,#6b7279));--pf-text:var(--v-text,var(--text-color-high,#22272b));color:var(--pf-text)}',
			'.pwmfan-header,.pwmfan-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px}',
			'.pwmfan-header{margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid var(--border-color-low,var(--pf-border))}.pwmfan-header h2{margin:0;font-size:22px}.pwmfan-header p{margin:4px 0 0;color:var(--pf-muted);font-size:12px}',
			'.pwmfan-state{display:inline-flex;align-items:center;gap:7px;color:var(--v-ok,var(--success-color,#248c68));font-size:12px}.pwmfan-state:before{width:8px;height:8px;border-radius:50%;background:currentColor;content:""}.pwmfan-state.fault{color:var(--v-err,var(--error-color,#c84646))}.pwmfan-header-actions{display:flex;align-items:center;gap:12px}',
			'.pwmfan-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.pwmfan-metric{min-width:0;padding:12px;border:1px solid var(--pf-border);border-radius:5px;background:var(--pf-bg)}',
			'.pwmfan-dashboard{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}.pwmfan-dashboard .pwmfan-section{margin:0}.pwmfan-dashboard .pwmfan-overview{grid-template-columns:repeat(2,minmax(0,1fr));margin:0}.pwmfan-dashboard .pwmfan-metric{padding:10px}',
			'.pwmfan-metric span,.pwmfan-metric small{display:block;color:var(--pf-muted);font-size:11px}.pwmfan-metric strong{display:block;margin:7px 0;font-size:20px;line-height:1.15;overflow-wrap:anywhere}.pwmfan-metric small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.pwmfan-section{margin:0 0 12px;padding:13px;border:1px solid var(--pf-border);border-radius:5px;background:var(--pf-bg)}.pwmfan-section-title{margin-bottom:10px}.pwmfan-section-title h3{margin:0;font-size:15px}.pwmfan-section-title span{color:var(--pf-muted);font-size:11px}',
			'.pwmfan-modes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}.pwmfan-mode{min-width:0;min-height:36px;padding:6px 4px;border-radius:4px;white-space:normal}.pwmfan-mode.active{border-color:var(--v-accent-line,var(--pf-accent));box-shadow:inset 0 -2px var(--v-accent-fill,var(--pf-accent))}',
			'.pwmfan-sensors{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pwmfan-sensor{min-width:0;padding:9px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-bg-2,rgba(127,127,127,.06))}.pwmfan-sensor.selected{border-color:var(--v-accent-line,var(--pf-accent))}.pwmfan-sensor span,.pwmfan-sensor small{display:block;color:var(--pf-muted);font-size:10px}.pwmfan-sensor strong{display:block;margin:5px 0;font-size:16px}.pwmfan-sensor small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwmfan-empty{color:var(--pf-muted);font-size:12px}',
			'.pwmfan-curve{display:block;width:100%;height:200px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-bg-2,rgba(127,127,127,.04))}.pwmfan-reason{margin-top:8px;color:var(--pf-muted);font-size:11px}',
			'.pwmfan-history{height:130px}.pwmfan-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;color:var(--pf-muted);font-size:11px}.pwmfan-legend span{display:inline-flex;align-items:center;gap:6px}.pwmfan-legend i{display:inline-block;width:18px;height:2px;background:var(--pf-accent)}.pwmfan-legend .actual i{background:#d38b25;border-top:1px dashed #d38b25}.pwmfan-legend .protection i{background:#d35454;border-top:1px dashed #d35454}',
			'.pwmfan-chart-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.pwmfan-chart-controls label,.pwmfan-sensor-select{display:flex;align-items:center;gap:7px;color:var(--pf-muted);font-size:11px}.pwmfan-chart-controls select,.pwmfan-sensor-select select{min-width:90px;height:30px;padding:3px 7px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-bg);color:var(--pf-text)}',
			'.pwmfan-link{font-size:12px}.pwmfan-chart-actions{display:flex;gap:8px;align-items:center}.pwmfan-curve-editor{margin-top:10px}.pwmfan-points{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:8px}.pwmfan-point-row{display:flex;align-items:end;gap:5px;padding:7px;border:1px solid var(--pf-border);border-radius:4px}.pwmfan-point-row label{min-width:0;flex:1}.pwmfan-point-row label span{display:block;color:var(--pf-muted);font-size:10px}.pwmfan-point-row input{width:100%;height:30px}.pwmfan-fan{width:30px;height:30px;border:2px solid var(--pf-border);border-radius:50%;display:flex;align-items:center;justify-content:center;gap:1px;color:var(--pf-accent)}.pwmfan-fan i{display:block;width:3px;height:14px;border-radius:2px;background:currentColor}.pwmfan-fan i:nth-child(2){transform:rotate(120deg);margin-left:-3px}.pwmfan-fan i:nth-child(3){transform:rotate(240deg);margin-left:-3px}.pwmfan-fan.running{animation:pwmfan-spin 1.4s linear infinite}@keyframes pwmfan-spin{to{transform:rotate(360deg)}}',
			'@media(max-width:850px){.pwmfan-overview,.pwmfan-sensors{grid-template-columns:repeat(2,minmax(0,1fr))}}',
			'@media(max-width:620px){.pwmfan-dashboard{grid-template-columns:1fr}.pwmfan-modes{grid-template-columns:repeat(3,minmax(0,1fr))}}',
			'@media(max-width:520px){.pwmfan-header{align-items:flex-start;flex-direction:column}.pwmfan-header-actions{width:100%;justify-content:space-between}.pwmfan-section-title{align-items:flex-start;flex-direction:column}.pwmfan-metric{padding:9px}.pwmfan-metric strong{font-size:17px}.pwmfan-points{grid-template-columns:1fr}.pwmfan-point-row{align-items:center}.pwmfan-page~.cbi-page-actions{position:static;width:auto;margin:16px 0 0}}'
		].join(''));
	},

	statusView: function(data) {
		var temp = function(value) {
			return value && value !== '--' ? _('%.1f °C').format(parseInt(value, 10) / 1000) : _('Unavailable');
		};
		var lang = this.languageControl(data);
		var sensorRows = (data.sensors || '').split(';').filter(Boolean).map(function(row) { return row.split('|'); });
		var findSensor = function(pattern) {
			var row = sensorRows.find(function(p) { return p.length >= 4 && pattern.test(p[1]); });
			return row && row[3] === 'ok' ? temp(row[2]) : _('Unavailable');
		};
		var metric = L.bind(this.metric, this);
		return E('div', { 'class': 'pwmfan' }, [
			this.style(),
			E('header', { 'class': 'pwmfan-header' }, [
				E('div', {}, [ E('h2', {}, _('H5000M PWM Fan')), E('p', {}, _('OWT2510 · Hiveton H5000M')) ]),
				E('div', { 'class': 'pwmfan-header-actions' }, [
					E('span', { 'id': 'pwmfan-state', 'class': 'pwmfan-state' }, data.state || _('Starting controller')),
					lang
				])
			]),
			E('div', { 'class': 'pwmfan-dashboard' }, [
				E('section', { 'class': 'pwmfan-section' }, [
					E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Temperature array')) ]),
					E('div', { 'class': 'pwmfan-overview' }, [
						metric(_('CPU'), findSensor(/cpu|soc/i), _('Processor')),
						metric(_('Radio'), findSensor(/wifi|radio|rf/i), _('Wireless')),
						metric(_('5G module'), findSensor(/modem|module/i), _('Modem')),
						metric(_('PHY'), findSensor(/phy/i), _('Ethernet'))
					])
				]),
				E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Fan output array')), E('span', { 'class': 'pwmfan-fan' + (parseInt(data.effective_pwm, 10) > 0 ? ' running' : ''), 'aria-label': _('Fan output indicator') }, [ E('i'), E('i'), E('i') ]) ]),
				E('div', { 'class': 'pwmfan-overview' }, [
						metric(_('Requested output'), this.toPercent(data.requested_pwm), _('Duty cycle')),
						metric(_('Actual output'), this.toPercent(data.effective_pwm), _('Hardware read-back')),
						metric(_('Protected output'), this.toPercent(data.protection_pwm), _('Kernel protection')),
						metric(_('Other parameters'), MODES[data.mode] || _('Unknown'), data.fan_rpm && data.fan_rpm !== '--' ? data.fan_rpm + ' RPM' : _('No RPM feedback'))
					])
				])
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Quick dispatch')), E('span', { 'class': 'pwmfan-mode-hint' }, data.state === 'disabled' ? _('Current mode: Off') : _('Current mode: %s').format(MODES[data.mode] || _('Unknown'))) ]),
				this.quickModes()
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Fan curve')), E('span', { 'id': 'pwmfan-profile' }, MODES[data.mode] || _('Disabled')) ]),
				E('canvas', { 'id': 'pwmfan-curve', 'class': 'pwmfan-curve', 'width': 900, 'height': 220 }),
				this.curveEditor(),
				E('div', { 'class': 'pwmfan-legend' }, [
					E('span', {}, [ E('i'), _('Selected curve') ]),
					E('span', { 'class': 'actual' }, [ E('i'), _('Actual output') ]),
					E('span', { 'class': 'protection' }, [ E('i'), _('Protected output') ])
				]),
				E('canvas', { 'id': 'pwmfan-fan-history', 'class': 'pwmfan-curve pwmfan-history', 'width': 900, 'height': 130 }),
				this.chartSettings('fan', data),
				E('div', { 'class': 'pwmfan-chart-actions' }, [
					E('button', { 'class': 'btn cbi-button-action', 'type': 'button', 'click': L.bind(this.applyCurve, this) }, _('Apply curve')),
					E('a', { 'class': 'pwmfan-link', 'href': L.url('admin/system/h5000m_pwmfan/advanced') }, _('Advanced settings'))
				]),
				E('div', { 'id': 'pwmfan-reason', 'class': 'pwmfan-reason' }, _('Controller reason: %s').format(data.reason || _('Waiting for status')))
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Temperature history')), this.temperatureSensorControl(data) ]),
				E('canvas', { 'id': 'pwmfan-temperature-chart', 'class': 'pwmfan-curve', 'width': 900, 'height': 220 }),
				this.chartSettings('temperature', data)
			])
		]);
	},

	toPercent: function(value) {
		var pwm = numeric(value, 0, 255);
		return pwm === null ? _('Unavailable') : Math.round(pwm * 100 / 255) + '%';
	},

	curvePoints: function() {
		var mode = uci.get(CONFIG, SECTION, 'mode') || 'balanced';
		var key = 'curve_' + (mode === 'manual' ? 'manual' : ([ 'quiet', 'balanced', 'performance', 'custom' ].indexOf(mode) < 0 ? 'balanced' : mode));
		return (uci.get(CONFIG, SECTION, key) || '').split(',').map(function(pair) {
			var p = pair.split(':'); return { t: parseInt(p[0], 10), pwm: parseInt(p[1], 10) };
		}).filter(function(p) { return !isNaN(p.t) && !isNaN(p.pwm); });
	},

	applyCurve: function() {
		return uci.save().then(function() { return uci.apply(); }).then(L.bind(function() {
			this.pendingCurve = null;
			ui.addNotification(null, E('p', _('Fan curve applied.')));
			return this.fetchStatus().then(L.bind(this.update, this));
		}, this)).catch(function(err) {
			ui.addNotification(null, E('p', _('Could not apply fan curve: %s').format(err.message)), 'danger');
		});
	},

	drawCurve: function() {
		var canvas = document.getElementById('pwmfan-curve');
		if (!canvas) return;
		var points = this.pendingCurve || this.curvePoints();
		if (points.length < 2) return;
		var rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
		var w = rect.width || 700, h = rect.height || 200;
		canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
		var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		var css = getComputedStyle(document.querySelector('.pwmfan'));
		var accent = css.getPropertyValue('--v-chart-1').trim() || css.getPropertyValue('--primary-color').trim() || '#8aaa20';
		var muted = css.getPropertyValue('--v-chart-axis').trim() || css.getPropertyValue('--text-color-medium').trim() || '#888';
		ctx.clearRect(0, 0, w, h);
		var l = 42, r = 14, t = 16, b = 30, pw = w-l-r, ph = h-t-b;
		var x = function(v) { return l + Math.max(0, Math.min(1, v / 110)) * pw; };
		var y = function(v) { return t + (100 - Math.max(0, Math.min(100, v * 100 / 255))) * ph / 100; };
		ctx.strokeStyle = 'rgba(127,127,127,.22)'; ctx.lineWidth = 1;
		for (var i=0; i<=4; i++) { var yy=t+ph*i/4; ctx.beginPath(); ctx.moveTo(l,yy); ctx.lineTo(w-r,yy); ctx.stroke(); }
		ctx.beginPath(); points.forEach(function(p,i) { if(i) ctx.lineTo(x(p.t),y(p.pwm)); else ctx.moveTo(x(p.t),y(p.pwm)); });
		ctx.strokeStyle=accent; ctx.lineWidth=3; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
		points.forEach(function(p) { ctx.beginPath(); ctx.arc(x(p.t),y(p.pwm),5,0,Math.PI*2); ctx.fillStyle=accent; ctx.fill(); });
		ctx.fillStyle=muted; ctx.font='11px sans-serif'; ctx.fillText('100%',5,t+4); ctx.fillText('50%',12,t+ph/2+4); ctx.fillText('0%',20,t+ph-5);
		ctx.fillText(_('Temperature (°C)'),w-r-105,h-8);
		var current=parseInt(this.data.temperature_mc,10)/1000;
		if(!isNaN(current)){ctx.beginPath();ctx.moveTo(x(current),t);ctx.lineTo(x(current),t+ph);ctx.setLineDash([4,4]);ctx.strokeStyle='#55a8ff';ctx.stroke();ctx.setLineDash([]);}
		var output = parseInt(this.data.effective_pwm, 10);
		if (!isNaN(output)) { ctx.beginPath(); ctx.moveTo(l,y(output)); ctx.lineTo(w-r,y(output)); ctx.setLineDash([3,4]); ctx.strokeStyle='#d38b25'; ctx.stroke(); ctx.setLineDash([]); }
		var protection = parseInt(this.data.protection_pwm, 10);
		if (!isNaN(protection)) { ctx.beginPath(); ctx.moveTo(l,y(protection)); ctx.lineTo(w-r,y(protection)); ctx.setLineDash([2,3]); ctx.strokeStyle='#d35454'; ctx.stroke(); ctx.setLineDash([]); }
	},

	drawHistory: function(canvasId, kind) {
		var canvas = document.getElementById(canvasId), prefs = chartPrefs[kind];
		if (!canvas) return;
		var rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
		var w = rect.width, h = rect.height;
		if (!w || !h) return;
		canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
		var ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
		var css = getComputedStyle(document.querySelector('.pwmfan'));
		var muted = css.getPropertyValue('--pf-muted').trim() || '#858b90';
		var accent = css.getPropertyValue('--pf-chart').trim() || '#728b28';
		ctx.fillStyle = muted; ctx.font = '11px sans-serif';
		if (!prefs.enabled) { ctx.fillText(_('Chart disabled'),16,28); return; }
		var l=44,r=16,t=16,b=28,pw=w-l-r,ph=h-t-b, now=Date.now(), span=prefs.range*60000;
		var samples = history.filter(function(sample) { return sample.time >= now-span && (kind === 'temperature' ? sample.temperatureSample : sample.fanSample); });
		var id = prefs.sensor;
		if (kind === 'temperature' && id === 'auto') {
			var available = sensorRows(this.data).filter(function(row) { return row.valid; });
			id = available.some(function(row){return row.id === this.data.control_source;},this) ? this.data.control_source : available.length ? available[0].id : '';
		}
		var getter = kind === 'temperature' ? function(sample){return sample.temps[id];} : function(sample){return sample.output;};
		var min = 0, max = 100;
		if (kind === 'temperature') {
			var temps=samples.map(getter).filter(function(v){return v != null;});
			if (temps.length) { min=Math.floor((Math.min.apply(null,temps)-5)/10)*10; max=Math.ceil((Math.max.apply(null,temps)+5)/10)*10; }
		}
		ctx.strokeStyle='rgba(127,127,127,.22)'; ctx.lineWidth=1;
		for(var i=0;i<=4;i++){
			var yy=t+ph*i/4; ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(w-r,yy);ctx.stroke();
			ctx.fillText(Math.round(max-(max-min)*i/4)+(kind==='temperature'?'°C':'%'),2,yy+4);
		}
		var started=false, count=0, previous=0;
		ctx.beginPath();
		samples.forEach(function(sample){
			var v=getter(sample);
			if (v == null || (previous && sample.time-previous > prefs.interval*3000)) started=false;
			previous=sample.time;
			if (v == null) return;
			var xx=l+(1-(now-sample.time)/span)*pw, yy=t+(max-v)*ph/(max-min);
			if(started)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);
			started=true;count++;
		});
		ctx.strokeStyle=accent;ctx.lineWidth=2.3;ctx.stroke();
		if(count===1){var last=samples[samples.length-1],value=getter(last);if(value!=null){ctx.beginPath();ctx.arc(l+(1-(now-last.time)/span)*pw,t+(max-value)*ph/(max-min),3,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();}}
		ctx.fillStyle=muted;
		if(!count)ctx.fillText(_('Waiting for history…'),l+12,t+22);
		for(var j=0;j<=2;j++){
			var time=new Date(now-span+span*j/2),label=time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
			ctx.textAlign=j===2?'right':j===1?'center':'left';
			ctx.fillText(label,l+pw*j/2,h-7);
		}
		ctx.textAlign='left';
		canvas.dataset.samples=String(count);
	},

	drawCharts: function() {
		this.drawCurve();
		this.drawHistory('pwmfan-temperature-chart','temperature');
		this.drawHistory('pwmfan-fan-history','fan');
	},

	remember: function(data) {
		var now = Date.now(), stamp = numeric(data.updated_at,0,99999999999);
		// The daemon snapshot timestamp prevents a failed poll from becoming a fake sample.
		if (stamp === null || now-stamp*1000 > 90000 || stamp*1000-now > 10000) return;
		if (this.lastSnapshot === stamp) return;
		this.lastSnapshot=stamp;
		this.lastSamples=this.lastSamples || {};
		var temps={}, sample={time:stamp*1000,temps:temps,output:null};
		var dueTemperature=chartPrefs.temperature.enabled && (!this.lastSamples.temperature || stamp-this.lastSamples.temperature>=chartPrefs.temperature.interval);
		var dueFan=chartPrefs.fan.enabled && (!this.lastSamples.fan || stamp-this.lastSamples.fan>=chartPrefs.fan.interval);
		if (!dueTemperature && !dueFan) return;
		if (dueTemperature) {
			sensorRows(data).forEach(function(row){if(row.valid)temps[row.id]=row.value/1000;});
			this.lastSamples.temperature=stamp;
		}
		if (dueFan) {
			var pwm=numeric(data.effective_pwm,0,255);
			sample.output=pwm===null?null:pwm*100/255;
			this.lastSamples.fan=stamp;
		}
		sample.temperatureSample=dueTemperature;
		sample.fanSample=dueFan;
		history.push(sample);
		while(history.length>10800 || (history.length && history[0].time<now-21600000))history.shift();
	},

	bindCurve: function() {
		var canvas=document.getElementById('pwmfan-curve'),self=this,drag=-1,original=null;
		if(!canvas)return;
		canvas.style.touchAction='none';
		canvas.addEventListener('pointerdown',function(ev){
			var rect=canvas.getBoundingClientRect(),pts=self.pendingCurve||self.curvePoints(),dist=20;
			pts.forEach(function(p,i){
				var dx=42+p.t/110*(rect.width-56),dy=16+(1-p.pwm/255)*(rect.height-46);
				var d=Math.hypot(dx-ev.clientX+rect.left,dy-ev.clientY+rect.top);
				if(d<dist){dist=d;drag=i;}
			});
			if(drag>=0){original=self.pendingCurve;canvas.setPointerCapture(ev.pointerId);}
		});
		canvas.addEventListener('pointermove',function(ev){
			if(drag<0)return;
			var rect=canvas.getBoundingClientRect(),pts=(self.pendingCurve||self.curvePoints()).map(function(p){return {t:p.t,pwm:p.pwm};});
			var min=parseInt(uci.get(CONFIG,SECTION,'min_pwm')||'51',10),max=parseInt(uci.get(CONFIG,SECTION,'max_pwm')||'255',10);
			pts[drag].t=Math.round(Math.max(drag?pts[drag-1].t+1:0,Math.min(drag<pts.length-1?pts[drag+1].t-1:110,(ev.clientX-rect.left-42)/(rect.width-56)*110)));
			pts[drag].pwm=Math.round(Math.max(min,Math.min(max,(1-(ev.clientY-rect.top-16)/(rect.height-46))*255)));
			self.pendingCurve=pts;self.drawCurve();
		});
		canvas.addEventListener('pointerup',function(){
			if(drag<0)return;
			drag=-1;
			if(self.pendingCurve)self.setCurvePoints(self.pendingCurve);
		});
		canvas.addEventListener('pointercancel',function(){drag=-1;self.pendingCurve=original;self.drawCurve();});
	},

	update: function(data) {
		this.data=data;
		this.remember(data);
		var state=document.getElementById('pwmfan-state');
		var states={running:_('Running'),disabled:_('Off'),kernel_only:_('Kernel'),failsafe:_('Fault response'),fault:_('Fault'),stopped:_('Stopped')};
		if(state){state.textContent=states[data.state]||_('Status unavailable');state.classList.toggle('fault',data.state==='fault'||data.state==='failsafe');}
		var rows=sensorRows(data);
		var readSensor=function(pattern){
			var matching=rows.filter(function(row){return pattern.test(row.label);});
			var valid=matching.filter(function(row){return row.valid;});
			return valid.length ? valid.map(function(row){return (row.value/1000).toFixed(1)+'°C';}).join(' / ') : _('Unavailable');
		};
		var dashboards=document.querySelector('.pwmfan-dashboard');
		if(dashboards){
			var metrics=dashboards.querySelectorAll('.pwmfan-metric strong');
			var values=[readSensor(/cpu|soc/i),readSensor(/wifi|radio|rf/i),readSensor(/modem|module/i),readSensor(/phy/i),
				this.toPercent(data.requested_pwm),this.toPercent(data.effective_pwm),this.toPercent(data.protection_pwm),
				data.fan_rpm&&numeric(data.fan_rpm,0,100000)!==null?data.fan_rpm+' RPM':_('No RPM feedback')];
			metrics.forEach(function(node,i){node.textContent=values[i];});
		}
		var enabled=uci.get(CONFIG,SECTION,'enabled')==='1',mode=uci.get(CONFIG,SECTION,'mode')||'balanced';
		if(mode==='custom')mode='manual';
		document.querySelectorAll('.pwmfan-mode').forEach(function(button){
			var active=enabled?button.dataset.mode===mode&&button.dataset.enabled==='1':button.dataset.enabled==='0';
			button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');
		});
		var profile=document.getElementById('pwmfan-profile');
		if(profile)profile.textContent=this.pendingCurve?_('Manual · not applied'):MODES[mode]||_('Unknown');
		var modeHint=document.querySelector('.pwmfan-mode-hint');
		if(modeHint)modeHint.textContent=enabled?_('Current mode: %s').format(MODES[mode]||_('Unknown')):_('Current mode: Off');
		var reason=document.getElementById('pwmfan-reason');
		if(reason)reason.textContent=_('Controller reason: %s').format(data.reason||_('Waiting for status'));
		var fan=document.querySelector('.pwmfan-fan');
		if(fan)fan.classList.toggle('running',numeric(data.effective_pwm,0,255)>0);
		this.drawCharts();
	},

	render: function(data) {
		this.data=data;
		var root=E('div',{'class':'pwmfan-page'},[this.statusView(data)]);
		window.setTimeout(L.bind(function(){this.update(data);this.bindCurve();},this),0);
		window.addEventListener('resize',L.bind(this.drawCharts,this));
		poll.add(L.bind(function(){return this.fetchStatus().then(L.bind(this.update,this));},this),2);
		return Promise.resolve(root);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
