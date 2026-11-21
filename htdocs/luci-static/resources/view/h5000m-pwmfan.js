'use strict';
'require view';
'require fs';
'require poll';
'require ui';
'require uci';

var CONFIG = 'h5000m_pwmfan', SECTION = 'main';
var MODES = { quiet: _('Quiet'), balanced: _('Balanced'), performance: _('Performance'),
	target: _('Target drive'), manual: _('Custom curve') };
var SENSORS = [
	[ _('CPU'), /^(cpu-thermal|cpu_thermal(?:_temp1)?|CPU)$/i, '--pf-blue' ],
	[ _('Radio'), /^(mt7996[-_]phy0[._]0)(?:_temp1)?$/i, '--pf-green' ],
	[ _('5G modem'), /^(modem|mt5700m)$/i, '--pf-amber' ],
	[ _('PHY'), /^(mdio_bus|phy)/i, '--pf-violet' ]
];
var CURVES = {
	quiet: '35:51,45:64,55:96,65:160,75:224,85:255',
	balanced: '30:64,42:96,54:144,66:200,76:240,84:255',
	performance: '25:128,34:160,43:192,52:224,61:240,70:255',
	manual: '30:51,40:64,50:96,60:144,70:208,80:255'
};
var HISTORY_LIMIT = 360 * 60 * 1000;

function setting(key, fallback) {
	var value = uci.get(CONFIG, SECTION, key);
	return value == null || value === '' ? fallback : value;
}

function number(value, min, max) {
	if (value == null || !/^-?\d+$/.test(String(value))) return null;
	var result = Number(value);
	return result >= min && result <= max ? result : null;
}

function percent(pwm) { return Math.round(pwm * 100 / 255); }
function clamp(value, min, max) { return Math.max(min, Math.min(value, max)); }
function format(value, unit) { return value == null ? _('Unavailable') : value + unit; }
function select(label, options, selected, change) {
	return E('label', { 'class': 'pf-field' }, [ E('span', {}, label), E('select', { change: change },
		options.map(function(option) { return E('option', { value: option[0], selected: option[0] === selected ? '' : null }, option[1]); })) ]);
}

function validCurve(points, low, high) {
	return points.length === 6 && points.every(function(point, i) {
		return number(point.t, 0, 100) !== null && number(point.pwm, 0, high) !== null &&
			(point.pwm === 0 || point.pwm >= low) &&
			(!i || (point.t > points[i - 1].t && point.pwm >= points[i - 1].pwm));
	});
}

function parseCurve(value) {
	return value.split(',').map(function(pair) {
		var values = pair.split(':');
		return { t: number(values[0], 0, 100), pwm: number(values[1], 0, 255) };
	});
}

function curveAt(points, temp) {
	for (var i = 0; i < points.length; i++) {
		if (temp <= points[i].t) {
			if (!i) return points[i].pwm;
			var left = points[i - 1], right = points[i];
			return Math.floor(left.pwm + (right.pwm - left.pwm) * (temp - left.t) / (right.t - left.t));
		}
	}
	return points[points.length - 1].pwm;
}

return view.extend({
	load: function() {
		return Promise.all([ uci.load(CONFIG), uci.load('luci'), this.fetchStatus() ]).then(function(values) { return values[2]; });
	},

	fetchStatus: function() {
		return fs.exec('/usr/sbin/h5000m-pwmfan-status').then(function(result) {
			var status = {};
			(result.stdout || '').split('\n').forEach(function(line) {
				var boundary = line.indexOf('=');
				if (boundary > 0) status[line.slice(0, boundary)] = line.slice(boundary + 1);
			});
			return status;
		}).catch(function() { return {}; });
	},

	loadTemperatureHistory: function() {
		return fs.exec('/usr/sbin/h5000m-pwmfan-status', [ 'temperatures' ]).then(L.bind(function(result) {
			if (result.code) return;
			var last = -Infinity, interval = this.interval * 1000;
			var rows = (result.stdout || '').split('\n').reduce(function(list, row) {
				var fields = row.split('|'), stamp = number(fields[0], 1, 9999999999);
				if (fields.length !== 5 || stamp === null || stamp * 1000 - last < interval) return list;
				last = stamp * 1000;
				list.push({ time: last, temps: fields.slice(1).map(function(field) {
					var value = number(field, -40000, 150000);
					return value === null ? null : Math.round(value / 100) / 10;
				}) });
				return list;
			}, []);
			var newer = this.history.filter(function(sample) { return sample.time > last; });
			if (rows.length) this.history = rows.concat(newer);
			this.drawChart(this.tempChart);
		}, this)).catch(function() { /* Live samples remain available. */ });
	},

	controlMode: function() {
		var configured = setting('mode', 'balanced');
		return Object.prototype.hasOwnProperty.call(MODES, configured) || configured === 'fixed' || configured === 'off' ? configured : 'balanced';
	},

	commit: function(changes) {
		if (this.saving) return;
		this.saving = true;
		this.modeButtons.concat(this.methodButtons || []).forEach(function(button) { button.disabled = true; });
		var previous = {};
		Object.keys(changes).forEach(function(key) {
			previous[key] = uci.get(CONFIG, SECTION, key);
			uci.set(CONFIG, SECTION, key, String(changes[key]));
		});
		return uci.save().then(function() { return uci.apply(); }).then(L.bind(function() {
			this.saving = false;
			this.modeButtons.concat(this.methodButtons || []).forEach(function(button) { button.disabled = false; });
			this.pendingCurve = null;
			this.refreshPolicy();
			return this.fetchStatus().then(L.bind(this.update, this));
		}, this)).catch(L.bind(function(error) {
			this.saving = false;
			this.modeButtons.concat(this.methodButtons || []).forEach(function(button) { button.disabled = false; });
			Object.keys(previous).forEach(function(key) {
				if (previous[key] == null) uci.unset(CONFIG, SECTION, key);
				else uci.set(CONFIG, SECTION, key, previous[key]);
			});
			ui.addNotification(null, E('p', {}, _('Could not apply policy: %s').format((error.message || String(error)))), 'danger');
			this.refreshPolicy();
		}, this));
	},

	languageControl: function() {
		return E('select', { 'aria-label': _('Language'), 'class': 'pf-language', change: function(event) {
			var input = event.currentTarget;
			input.disabled = true;
			fs.exec('/usr/sbin/h5000m-pwmfan-language', [ input.value ]).then(function(result) {
				if (result.code) throw new Error(result.stderr || _('Unavailable'));
				window.location.reload();
			}).catch(function(error) {
				input.disabled = false;
				input.value = uci.get('luci', 'main', 'lang') || 'auto';
				ui.addNotification(null, E('p', {}, _('Could not change language: %s').format(error.message)), 'danger');
			});
		} }, [ [ 'auto', _('Automatic') ], [ 'en', _('English') ], [ 'zh_cn', '简体中文' ] ].map(function(entry) {
			return E('option', { value: entry[0], selected: entry[0] === (uci.get('luci', 'main', 'lang') || 'auto') ? '' : null }, entry[1]);
		}));
	},

	makeMetric: function(label, color) {
		var value = E('strong', {}, _('Unavailable'));
		var fill = E('i');
		var bar = E('div', { 'aria-hidden': 'true', 'class': 'pf-bar' }, fill);
		return { value: value, fill: fill, element: E('div', { 'class': 'pf-metric', style: '--metric-color:var(' + color + ')' },
			[ E('span', {}, label), value, bar ]) };
	},

	makeBoard: function(title, metrics) {
		return E('section', { 'class': 'pf-card' }, [ E('h3', {}, title), E('div', { 'class': 'pf-metrics' }, metrics.map(function(metric) { return metric.element; })) ]);
	},

	refreshPolicy: function() {
		var mode = this.controlMode(), fixed = mode === 'fixed' || mode === 'off';
		var self = this;
		var curveMode = fixed ? setting('curve_mode', 'balanced') : mode;
		if ([ 'quiet', 'balanced', 'performance', 'target', 'manual' ].indexOf(curveMode) < 0) curveMode = 'balanced';
		this.modeButtons.forEach(function(button) { button.setAttribute('aria-pressed', String(button.dataset.mode === curveMode && !fixed)); });
		var fixedTitle = E('button', { type: 'button', 'class': 'pf-method-title', 'aria-pressed': String(fixed),
			click: function() { self.commit({ mode: 'fixed', drive: 'duty', enabled: '1' }); } }, [ _('Fixed request'), E('span', {}, fixed ? _('Selected') : _('Not selected')) ]);
		var curveTitle = E('button', { type: 'button', 'class': 'pf-method-title', 'aria-pressed': String(!fixed),
			click: function() { self.commit({ mode: curveMode, curve_mode: curveMode, drive: 'curve', enabled: '1' }); } }, [ _('Curve preset'), E('span', {}, fixed ? _('Not selected') : _('Selected')) ]);
		this.methodButtons = [ fixedTitle, curveTitle ];
		var duty = clamp(Number(setting('fixed_duty', 50)), 10, 100);
		var readout = E('output', {}, duty + '%');
		var slider = E('input', { type: 'range', value: duty, min: 10, max: 100, step: 10,
			input: function(event) { readout.textContent = event.currentTarget.value + '%'; },
			change: function(event) { self.commit({ mode: 'fixed', drive: 'duty', fixed_duty: event.currentTarget.value, enabled: '1' }); } });
		var stop = E('button', { type: 'button', 'class': 'btn pf-danger', 'aria-pressed': String(mode === 'off'),
			click: function() { self.commit({ mode: 'off', drive: 'duty', enabled: '1' }); } }, _('Stop fan'));
		var fixedGroup = E('section', { 'class': 'pf-method', 'data-selected': String(fixed) }, [ fixedTitle,
			E('div', { 'class': 'pf-fixed-controls' }, [ E('label', { 'class': 'pf-slider' }, [ E('span', {}, _('Requested duty')), slider, readout ]), stop ]) ]);
		var curveChildren = [ curveTitle, E('div', { 'class': 'pf-modes', role: 'group', 'aria-label': _('Curve preset') }, this.modeButtons) ];
		if (!fixed && curveMode === 'target') curveChildren.push(E('details', { 'class': 'pf-parameters' }, [ E('summary', {}, _('Target drive parameters')), this.targetFields() ]));
		if (!fixed && curveMode === 'manual') curveChildren.push(E('details', { 'class': 'pf-parameters' }, [ E('summary', {}, _('Curve parameters')), this.editor ]));
		var curveGroup = E('section', { 'class': 'pf-method', 'data-selected': String(!fixed) }, curveChildren);
		this.policy.replaceChildren(fixedGroup, curveGroup);
		this.renderEditor();
		this.drawCharts();
	},

	targetFields: function() {
		var self = this, target = Number(setting('target_temp', 85)), response = Number(setting('response_range', 15));
		var width = Number(setting('transition_width', 5));
		var makeInput = function(label, name, value, min, max) {
			return E('label', { 'class': 'pf-field' }, [ E('span', {}, label),
				E('input', { name: name, type: 'number', value: value, min: min, max: max, required: true }) ]);
		};
		var message = E('div', { 'class': 'pf-note', 'aria-live': 'polite' });
		var form = E('form', { 'class': 'pf-target', submit: function(event) {
			event.preventDefault();
			var entries = new FormData(event.currentTarget);
			var t = number(entries.get('target_temp'), 80, 100);
			var r = number(entries.get('response_range'), 15, t);
			var blend = number(entries.get('transition_width'), 2, 10);
			var threshold = Number(setting('protection_temp', 90));
			if (t === null || r === null || blend === null || t > threshold) {
				message.textContent = _('Use a target at or below the protection threshold and a response interval of 15 °C up to the target.');
				return;
			}
			self.commit({ target_temp: t, response_range: r, transition_width: blend });
		} }, [ makeInput(_('Target temperature (°C)'), 'target_temp', target, 80, 100),
			makeInput(_('Response interval (°C)'), 'response_range', response, 15, 100),
			makeInput(_('Transition width (°C)'), 'transition_width', width, 2, 10),
			E('button', { type: 'submit', 'class': 'btn' }, _('Apply target')), message ]);
		var annotate = function() {
			var onset = Number(form.elements.target_temp.value) - Number(form.elements.response_range.value);
			var effective = Math.max(0, Math.min(onset, Number(form.elements.transition_width.value)));
			message.textContent = _('Response starts at %s °C · Effective transition %s °C').format(onset, effective);
		};
		form.addEventListener('input', annotate);
		annotate();
		return form;
	},

	curvePoints: function() {
		var mode = this.controlMode();
		var low = Number(setting('min_pwm', 51)), max = Number(setting('max_pwm', 255));
		var limit = function(pwm) { return pwm ? clamp(pwm, Math.min(low, max), max) : 0; };
		if (mode === 'off') return [ { t: 0, pwm: 0 }, { t: 100, pwm: 0 } ];
		if (mode === 'fixed') {
			var fixedPwm = limit(Math.round(Number(setting('fixed_duty', 50)) * 255 / 100));
			return [ { t: 0, pwm: fixedPwm }, { t: 100, pwm: fixedPwm } ];
		}
		if (mode === 'target') {
			var target = Number(setting('target_temp', 85)), start = target - Number(setting('response_range', 15));
			var blend = Math.min(start, Number(setting('transition_width', 5)));
			var idle = Number(setting('target_idle_pwm', 0));
			return [ { t: Math.max(0, start - blend), pwm: limit(idle) }, { t: start, pwm: limit(Math.max(low, idle)) },
				{ t: target, pwm: max } ].filter(function(point, index, points) { return index === points.length - 1 || point.t !== points[index + 1].t; });
		}
		if (mode !== 'manual' && setting('drive', 'curve') === 'duty') {
			var duty = Number(setting('duty_' + mode, { quiet: 30, balanced: 50, performance: 80 }[mode]));
			return [ { t: 0, pwm: limit(Math.round(duty * 255 / 100)) }, { t: 100, pwm: limit(Math.round(duty * 255 / 100)) } ];
		}
		if (mode === 'manual' && this.pendingCurve) return this.pendingCurve;
		var points = parseCurve(setting('curve_' + mode, CURVES[mode]));
		if (mode === 'manual') return validCurve(points, low, max) ? points : [];
		if (points.length < 2 || points.some(function(point, i) {
			return point.t === null || point.pwm === null || (i && (point.t <= points[i - 1].t || point.pwm < points[i - 1].pwm));
		})) points = parseCurve(CURVES[mode]);
		return points.map(function(point) { return { t: point.t, pwm: limit(point.pwm) }; });
	},

	renderEditor: function() {
		var points = this.curvePoints(), self = this, manual = this.controlMode() === 'manual';
		var rows = [];
		var editorPoints = manual ? points : parseCurve(setting('curve_manual', CURVES.manual));
		var message = E('p', { 'class': 'pf-note', 'aria-live': 'polite' }, manual ?
			(points.length ? (this.pendingCurve ? _('Curve has unapplied changes.') : '') : _('Saved curve is invalid. Restore six default points to edit.')) : _('Select Custom curve to edit the six curve points.'));
		if (editorPoints.length === 6) editorPoints.forEach(function(point, i) {
			var input = function(label, axis, value, min, max) {
				return E('label', { 'class': 'pf-field' }, [ E('span', {}, label), E('input', {
					type: 'number', value: value, min: min, max: max, disabled: !manual ? '' : null,
					'aria-label': _('%s · Point %s').format(label, i + 1),
					change: function(event) {
						var next = self.curvePoints().map(function(p) { return { t: p.t, pwm: p.pwm }; });
						var updated = number(event.currentTarget.value, 0, 100);
						next[i][axis] = updated === null || axis === 't' ? updated : Math.round(updated * 255 / 100);
						if (!self.setCurve(next)) {
							message.textContent = _('Temperatures must increase and output must stay level or increase. Nonzero output must stay within the running limits.');
							event.currentTarget.value = value;
						} else self.renderEditor();
					}
				}) ]);
			};
			rows.push(E('div', { 'class': 'pf-point' }, [ E('span', {}, String(i + 1)),
				input(_('Temperature (°C)'), 't', point.t, i ? editorPoints[i - 1].t + 1 : 0, i < 5 ? editorPoints[i + 1].t - 1 : 100),
				input(_('Output (%)'), 'pwm', percent(point.pwm), 0, 100) ]));
		});
		this.editor.replaceChildren(message, E('div', { 'class': 'pf-points' }, rows), E('div', { 'class': 'pf-editor-actions' }, [
			E('button', { type: 'button', 'class': 'btn', disabled: !manual ? '' : null, click: function() {
				var low = Number(setting('min_pwm', 51)), max = Number(setting('max_pwm', 255));
				var defaults = parseCurve(CURVES.manual).map(function(point) { return { t: point.t, pwm: clamp(point.pwm, Math.min(low, max), max) }; });
				if (self.setCurve(defaults)) self.renderEditor();
			} }, _('Restore curve defaults')),
			E('button', { type: 'button', 'class': 'btn', disabled: !manual || !this.pendingCurve ? '' : null, click: function() {
				self.commit({ curve_manual: self.pendingCurve.map(function(point) { return point.t + ':' + point.pwm; }).join(',') });
			} }, _('Apply curve'))
		]));
	},

	setCurve: function(points) {
		if (this.controlMode() !== 'manual' || !validCurve(points, Number(setting('min_pwm', 51)), Number(setting('max_pwm', 255)))) return false;
		this.pendingCurve = points;
		this.drawCharts();
		return true;
	},

	metricValues: function(data) {
		var stamp = number(data.updated_at, 0, 9999999999), age = Date.now() / 1000 - stamp;
		var fresh = stamp !== null && age >= -5 && age <= 90;
		var rows = fresh ? (data.sensors || '').split(';').map(function(row) { return row.split('|'); }) : [];
		var temps = SENSORS.map(function(sensor) {
			var row = rows.find(function(item) { return sensor[1].test(item[1] || '') && /^(ok|unselected)$/.test(item[3]); });
			var millidegrees = row ? number(row[2], -40000, 150000) : null;
			return millidegrees === null ? null : Math.round(millidegrees / 100) / 10;
		});
		return { fresh: fresh, temps: temps, stamp: stamp,
			output: [ 'requested_pwm', 'effective_pwm', 'protection_pwm' ].map(function(key) {
				var value = fresh ? number(data[key], 0, 255) : null;
				return value === null ? null : percent(value);
			}), rpm: fresh ? number(data.rpm, 0, 100000) : null };
	},

	update: function(data) {
		this.data = data;
		var values = this.readings = this.metricValues(data);
		this.tempMetrics.concat(this.outputMetrics).forEach(function(metric, index) {
			var value = values.temps.concat(values.output, values.rpm)[index];
			metric.value.textContent = format(value, index < 4 ? ' °C' : index < 7 ? '%' : ' RPM');
			metric.fill.style.width = index === 7 || value === null ? '0%' : clamp(value, 0, 100) + '%';
		});
		var states = {
			fault: [ _('Fault'), 'fault' ], failsafe: [ _('Fault'), 'fault' ],
			kernel_only: [ _('Kernel control'), 'idle' ],
			protection: [ _('Protection active'), 'warn' ],
			running: [ _('Running'), 'ok' ], disabled: [ _('Not in control'), 'idle' ], stopped: [ _('Not in control'), 'idle' ]
		};
		var state = Object.prototype.hasOwnProperty.call(states, data.state) ? states[data.state] : null;
		if (!values.fresh || !state || (data.state === 'running' && !/^(userspace|protection)$/.test(data.owner || '')))
			state = [ _('Status unavailable'), 'idle' ];
		else if (data.state === 'running' && (data.owner === 'protection' || /^protection_(ramp|lock)$/.test(data.reason || '')))
			state = states.protection;
		this.badge.dataset.state = state[1];
		this.badgeText.textContent = state[0];
		this.badge.title = data.reason === 'takeover_pending' ? _('Hardware verification is pending.') : state[0];
		var source = { userspace: _('Plugin'), protection: _('Temperature protection'), kernel: _('Kernel or driver'), none: _('Not in control') };
		this.source.textContent = values.fresh && Object.prototype.hasOwnProperty.call(source, data.owner) &&
			!/^(kernel_or_driver_override|pwm_mismatch)$/.test(data.reason || '') ? source[data.owner] : _('Unknown');
		var counters = [ _('Last 24 hours') + ': ' + (data.protection_count_24h || '—'),
			_('Total this boot') + ': ' + (data.protection_count_total || '—') ];
		var trigger = number(data.protection_last_trigger, 1, 9999999999);
		var peak = number(data.protection_last_cycle_peak_c, -40, 150);
		if (trigger !== null) counters.push(_('Latest trigger') + ': ' + new Date(trigger * 1000).toLocaleString());
		if (peak !== null) counters.push(_('Cycle peak') + ': ' + peak + ' °C');
		this.protectionSummary.textContent = counters.join(' · ');
		if (this.historyState) this.historyState.textContent = values.fresh && values.temps.some(function(value) { return value !== null; }) ? _('Live temperature readings') : _('Waiting for temperature readings');
		var now = Date.now(), time = values.fresh ? values.stamp * 1000 : now, last = this.history[this.history.length - 1];
		if (!last || time - last.time >= this.interval * 1000) {
			this.history.push({ time: time, temps: values.temps });
			this.history = this.history.filter(function(sample) { return sample.time >= now - HISTORY_LIMIT; });
		}
		this.drawCharts();
	},

	makeChart: function(label, legend, history) {
		var self = this, canvas = E('canvas', { tabindex: '0', 'aria-label': label });
		var tip = E('div', { 'class': 'pf-tooltip', hidden: true });
		var chart = { canvas: canvas, tip: tip, cursor: null, history: history, handles: [] };
		if (!history) {
			for (var i = 0; i < 6; i++) chart.handles.push(E('span', { 'class': 'pf-touch-point', 'aria-hidden': 'true', hidden: '' }));
		}
		var plot = E('div', { 'class': 'pf-plot' }, [ canvas, tip ].concat(chart.handles));
		var legendNode = E('div', { 'class': 'pf-legend' }, legend.map(function(series) {
			return E('span', {}, [ E('i', { style: 'background:var(' + series[1] + ')' }), series[0] ]);
		}));
		chart.element = E('div', { 'class': 'pf-chart' }, [ legendNode, plot ]);
		plot.addEventListener('pointerdown', function(event) {
			var rect = canvas.getBoundingClientRect(), points = self.curvePoints();
			var x = event.clientX - rect.left, y = event.clientY - rect.top, geometry = chart.geometry;
			if (!history && geometry && self.controlMode() === 'manual') {
				var hit = points.findIndex(function(point) { return Math.hypot(x - geometry.x(point.t), y - geometry.y(percent(point.pwm))) <= 15; });
				if (hit >= 0) {
					chart.drag = { index: hit, pending: self.pendingCurve, points: points };
					canvas.setPointerCapture(event.pointerId);
				}
			}
			chart.cursor = x;
			self.drawChart(chart);
		});
		plot.addEventListener('pointermove', function(event) {
			var rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left;
			chart.cursor = x;
			if (chart.drag && chart.geometry) {
				var geometry = chart.geometry, index = chart.drag.index;
				var points = self.curvePoints().map(function(point) { return { t: point.t, pwm: point.pwm }; });
				if (!points[index]) return;
				var low = index ? points[index - 1].pwm : 0, high = index < 5 ? points[index + 1].pwm : Number(setting('max_pwm', 255));
				var pwm = clamp(Math.round((geometry.bottom - (event.clientY - rect.top)) / geometry.height * 255), low, high);
				var floor = Number(setting('min_pwm', 51));
				if (pwm && pwm < floor) pwm = low > 0 || pwm >= floor / 2 ? Math.max(floor, low) : 0;
				points[index] = { t: clamp(Math.round(geometry.input(x)), index ? points[index - 1].t + 1 : 0,
					index < 5 ? points[index + 1].t - 1 : 100), pwm: pwm };
				self.setCurve(points);
			}
			self.drawChart(chart);
		});
		plot.addEventListener('pointerup', function() {
			if (chart.drag) { chart.drag = null; self.renderEditor(); }
		});
		plot.addEventListener('pointercancel', function() {
			if (chart.drag) { self.pendingCurve = chart.drag.pending; chart.drag = null; }
			chart.cursor = null;
			self.drawChart(chart);
		});
		plot.addEventListener('pointerleave', function() {
			if (!chart.drag) { chart.cursor = null; self.drawChart(chart); }
		});
		canvas.addEventListener('keydown', function(event) {
			if (!chart.geometry) return;
			if (event.key === 'Escape') chart.cursor = null;
			else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
				chart.cursor = (chart.cursor === null ? chart.geometry.left : chart.cursor) + (event.key === 'ArrowLeft' ? -12 : 12);
			} else return;
			event.preventDefault();
			self.drawChart(chart);
		});
		return chart;
	},

	drawChart: function(chart) {
		var canvas = chart.canvas, width = canvas.clientWidth, height = canvas.clientHeight;
		if (!width || !height) return;
		var scale = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		var ctx = canvas.getContext('2d'), vars = getComputedStyle(this.root);
		var color = function(name) {
			var value = vars.getPropertyValue(name).trim();
			return value.startsWith('light-dark(') ? value.slice(11, -1).split(',')[vars.colorScheme === 'dark' ? 1 : 0].trim() : value;
		};
		ctx.scale(scale, scale);
		var left = 37, top = 12, right = width - 17, bottom = height - 26;
		var now = Date.now(), start = chart.history ? now - this.range * 60000 : 0, end = chart.history ? now : 100;
		var x = function(value) { return left + (right - left) * clamp((value - start) / (end - start), 0, 1); };
		var y = function(value) { return bottom - (bottom - top) * clamp(value, 0, 100) / 100; };
		var input = function(coord) { return start + (end - start) * (clamp(coord, left, right) - left) / (right - left); };
		chart.geometry = { x: x, y: y, input: input, left: left, bottom: bottom, height: bottom - top };
		var coords = function(x1, y1, x2, y2, stroke, dash) {
			ctx.beginPath(); ctx.setLineDash(dash || []); ctx.strokeStyle = stroke; ctx.lineWidth = 1;
			ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
		};
		var localeTime = function(time) { return new Date(time).toLocaleTimeString(document.documentElement.lang || undefined, { hour: '2-digit', minute: '2-digit', hour12: false }); };
		ctx.font = '11px ' + (color('--pf-mono') || 'monospace');
		ctx.fillStyle = color('--pf-muted');
		ctx.textAlign = 'right';
		for (var tick = 0; tick <= 100; tick += 20) {
			coords(left, y(tick), right, y(tick), color('--pf-line'), tick ? [ 3, 3 ] : []);
			ctx.fillText(tick + (chart.history ? '°' : '%'), left - 6, y(tick) + 4);
		}
		ctx.textAlign = 'center';
		for (var i = 0; i <= 5; i++) {
			var value = start + (end - start) * i / 5;
			coords(x(value), top, x(value), bottom, color('--pf-line'), [ 3, 3 ]);
			ctx.textAlign = i === 0 ? 'left' : i === 5 ? 'right' : 'center';
			ctx.fillText(chart.history ? localeTime(value) : value + '°', x(value), bottom + 17);
		}
		var trace = function(points, stroke, fill) {
			if (!points.length) return;
			ctx.beginPath(); ctx.moveTo(x(points[0][0]), y(points[0][1]));
			points.slice(1).forEach(function(point) { ctx.lineTo(x(point[0]), y(point[1])); });
			ctx.strokeStyle = stroke; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
			if (fill && points.length > 1) {
				ctx.lineTo(x(points[points.length - 1][0]), bottom); ctx.lineTo(x(points[0][0]), bottom); ctx.closePath();
				ctx.globalAlpha = 0.1; ctx.fillStyle = stroke; ctx.fill(); ctx.globalAlpha = 1;
			}
			if (points.length === 1) { ctx.beginPath(); ctx.arc(x(points[0][0]), y(points[0][1]), 2, 0, Math.PI * 2); ctx.fillStyle = stroke; ctx.fill(); }
		};
		var readings = this.readings, points = this.curvePoints(), samples;
		if (chart.history) {
			samples = this.history.filter(function(sample) { return sample.time >= start && sample.time <= end; });
			canvas.dataset.samples = samples.length;
			canvas.dataset.latestSample = samples.length ? samples[samples.length - 1].time : '';
			if (!samples.some(function(sample) { return sample.temps.some(function(value) { return value !== null; }); })) {
				ctx.textAlign = 'center';
				ctx.fillStyle = color('--pf-muted');
				ctx.fillText(_('Waiting for sensor readings…'), width / 2, height / 2);
			}
			SENSORS.forEach(function(series, index) {
				var segment = [];
				samples.forEach(function(sample) {
					if (segment.length && sample.time - segment[segment.length - 1][0] > Math.max(45, 2 * this.interval) * 1000) {
						trace(segment, color(series[2]), false);
						segment = [];
					}
					if (sample.temps[index] === null) { trace(segment, color(series[2]), false); segment = []; }
					else segment.push([ sample.time, sample.temps[index] ]);
				}, this);
				trace(segment, color(series[2]), false);
			}, this);
		} else {
			var manual = this.controlMode() === 'manual';
			chart.handles.forEach(function(handle, index) {
				var point = points[index];
				handle.hidden = !manual || !point;
				if (handle.hidden) return;
				handle.style.left = x(point.t) + 'px';
				handle.style.top = y(percent(point.pwm)) + 'px';
			});
			if (readings && readings.output[2] > 0) {
				ctx.fillStyle = color('--pf-red'); ctx.globalAlpha = 0.16;
				ctx.fillRect(left, y(readings.output[2]), right - left, bottom - y(readings.output[2])); ctx.globalAlpha = 1;
			}
			if (points.length) {
				var series = points.map(function(point) { return [ point.t, point.pwm * 100 / 255 ]; });
				if (series[0][0] !== 0) series.unshift([ 0, series[0][1] ]);
				if (series[series.length - 1][0] !== 100) series.push([ 100, series[series.length - 1][1] ]);
				trace(series, color('--pf-blue'), true);
				if (manual) points.forEach(function(point) {
					ctx.beginPath(); ctx.arc(x(point.t), y(percent(point.pwm)), 4, 0, Math.PI * 2); ctx.fillStyle = color('--pf-blue'); ctx.fill();
				});
			}
			var temperature = readings ? number(this.data.temperature_mc, -40000, 150000) : null;
			if (readings && readings.fresh && temperature !== null) coords(x(temperature / 1000), top, x(temperature / 1000), bottom, color('--pf-green'), [ 4, 3 ]);
			if (readings && readings.output[1] !== null) coords(left, y(readings.output[1]), right, y(readings.output[1]), color('--pf-amber'), [ 4, 3 ]);
		}
		chart.tip.hidden = true;
		if (chart.cursor === null) return;
		chart.cursor = clamp(chart.cursor, left, right);
		var selected = input(chart.cursor), text;
		if (chart.history) {
			if (!samples.length) return;
			var nearest = samples.reduce(function(best, sample) { return Math.abs(sample.time - selected) < Math.abs(best.time - selected) ? sample : best; });
			text = [ localeTime(nearest.time) ].concat(SENSORS.map(function(sensor, index) { return sensor[0] + ' ' + format(nearest.temps[index], ' °C'); }));
		} else {
			text = [ Math.round(selected) + ' °C · ' + format(points.length ? percent(curveAt(points, selected)) : null, '%') ];
		}
		coords(chart.cursor, top, chart.cursor, bottom, color('--pf-muted'), [ 3, 2 ]);
		chart.tip.textContent = text.join('\n');
		chart.tip.hidden = false;
		chart.tip.style.left = clamp(chart.cursor + 8, 4, Math.max(4, width - chart.tip.offsetWidth - 4)) + 'px';
	},

	drawCharts: function() {
		this.drawChart(this.curveChart);
		this.drawChart(this.tempChart);
	},

	render: function(data) {
		var self = this;
		this.history = [];
		this.range = 15;
		this.interval = 2;
		try {
			var settings = JSON.parse(localStorage.getItem('h5000m-pwmfan-v3-history') || '{}');
			if (Number.isInteger(settings.range) && settings.range >= 5 && settings.range <= 360 && settings.range % 5 === 0) this.range = settings.range;
			if (Number.isInteger(settings.interval) && settings.interval >= 1 && settings.interval <= 60) this.interval = settings.interval;
		} catch (error) { /* History preferences are optional. */ }
		this.badgeText = E('span', {}, _('Status unavailable'));
		this.badge = E('span', { 'class': 'pf-live', role: 'status', 'data-state': 'idle' }, [ E('i', { 'aria-hidden': 'true' }), this.badgeText ]);
		this.source = E('strong', {}, _('Unknown'));
		this.protectionSummary = E('p', { 'class': 'pf-note pf-protection-history' });
		this.tempMetrics = SENSORS.map(function(sensor) { return self.makeMetric(sensor[0], sensor[2]); });
		this.outputMetrics = [ this.makeMetric(_('Requested output'), '--pf-blue'), this.makeMetric(_('Actual output'), '--pf-amber'),
			this.makeMetric(_('Protection output'), '--pf-red'), this.makeMetric(_('Fan speed'), '--pf-muted') ];
		this.modeButtons = [ 'quiet', 'balanced', 'performance', 'target', 'manual' ].map(function(mode) {
			return E('button', { type: 'button', 'class': 'btn pf-mode', 'data-mode': mode,
				click: function() { self.commit({ mode: mode, curve_mode: mode, drive: 'curve', enabled: '1' }); } }, MODES[mode]);
		});
		this.policy = E('div', { 'class': 'pf-policy' });
		this.editor = E('div', { 'class': 'pf-editor' });
		this.saveCurve = E('button', { type: 'button', 'class': 'btn', click: function() {
			self.commit({ curve_manual: self.pendingCurve.map(function(point) { return point.t + ':' + point.pwm; }).join(',') });
		} }, _('Apply curve'));
		this.curveChart = this.makeChart(_('Fan curve'), [ [ _('Curve request'), '--pf-blue' ], [ _('Current temperature'), '--pf-green' ],
			[ _('Actual output'), '--pf-amber' ], [ _('Protection output'), '--pf-red' ] ], false);
		this.tempChart = this.makeChart(_('Temperature history'), SENSORS.map(function(sensor) { return [ sensor[0], sensor[2] ]; }), true);
		var setPreference = function(key, event) {
			self[key] = Number(event.currentTarget.value);
			try { localStorage.setItem('h5000m-pwmfan-v3-history', JSON.stringify({ range: self.range, interval: self.interval })); }
			catch (error) { /* Chart works without stored preferences. */ }
			if (key === 'interval') self.loadTemperatureHistory();
			self.drawCharts();
		};
		this.historyState = E('span', { 'class': 'pf-chart-state' }, _('Waiting for temperature readings'));
		var rangeInput = E('input', { type: 'number', min: 5, max: 360, step: 5, value: this.range, 'aria-label': _('Window') });
		var intervalInput = E('input', { type: 'number', min: 1, max: 60, step: 1, value: this.interval, 'aria-label': _('Read every') });
		var updatePreference = function(key, input, min, max, step) {
			var value = Number(input.value);
			if (!Number.isInteger(value) || value < min || value > max || value % step) { input.value = self[key]; return; }
			setPreference(key, { currentTarget: { value: value } });
		};
		rangeInput.addEventListener('change', function() { updatePreference('range', rangeInput, 5, 360, 5); });
		intervalInput.addEventListener('change', function() { updatePreference('interval', intervalInput, 1, 60, 1); });
		var temps = E('details', { 'class': 'pf-card pf-history', open: true }, [ E('summary', {}, [ _('Temperature history'), this.historyState ]),
			this.tempChart.element, E('div', { 'class': 'pf-history-settings' }, [
				E('label', { 'class': 'pf-number-setting' }, [ _('Window'), rangeInput, _('min') ]),
				E('label', { 'class': 'pf-number-setting' }, [ _('Read every'), intervalInput, _('s') ]) ]) ]);
		this.root = E('div', { 'class': 'pf-page' }, [
			E('link', { rel: 'stylesheet', href: L.resource('view/h5000m-pwmfan.css') }),
			E('div', { 'class': 'pf-heading' }, [ E('h2', {}, _('H5000M PWM Fan')) ]),
			E('div', { 'class': 'pf-toolbar' }, [ this.badge, this.languageControl() ]),
			E('div', { 'class': 'pf-boards' }, [ this.makeBoard(_('Temperature array'), this.tempMetrics), this.makeBoard(_('Fan output'), this.outputMetrics) ]),
			E('section', { 'class': 'pf-card' }, [ E('div', { 'class': 'pf-dispatch-head' }, [ E('h3', {}, _('Quick dispatch')),
				E('span', { 'class': 'pf-source' }, [ _('Control source'), ' · ', this.source ]) ]),
				this.policy, this.protectionSummary ]),
			E('details', { 'class': 'pf-card pf-curve-chart' }, [ E('summary', {}, _('Fan curve')),
				this.curveChart.element ]), temps
		]);
		this.refreshPolicy();
		this.update(data);
		this.loadTemperatureHistory();
		temps.addEventListener('toggle', this.drawCharts.bind(this));
		var observer = new ResizeObserver(function() { if (self.root.isConnected) self.drawCharts(); });
		observer.observe(this.root);
		var media = window.matchMedia('(prefers-color-scheme: dark)');
		media.addEventListener('change', this.drawCharts.bind(this));
		poll.add(function() { return self.fetchStatus().then(self.update.bind(self)); }, 1);
		requestAnimationFrame(function() { self.drawCharts(); });
		return this.root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
