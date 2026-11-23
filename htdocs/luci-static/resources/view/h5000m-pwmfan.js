'use strict';
'require view';
'require fs';
'require poll';
'require rpc';
'require ui';
'require uci';
'require view.h5000m-pwmfan-shared as shared';

var CONFIG = 'h5000m_pwmfan', SECTION = 'main';
var callRevert = rpc.declare({ object: 'uci', method: 'revert', params: [ 'config' ], reject: true });
var MODES = { quiet: _('Quiet mode'), balanced: _('Balanced mode'), performance: _('Performance mode'),
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
var MERGE_DELAY = 3000;
var DETAILS_KEY = 'h5000m-pwmfan-details';

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

/* The legend is a fixed-width table: "50 %" keeps the unit one space away from
   the number so the right-aligned column stays readable. */
function legendPercent(value) { return value == null ? _('Unavailable') : Math.round(value) + '\u00A0\u00A0%'; }
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
		return fs.exec('/usr/sbin/h5000m-pwmfan-history').then(L.bind(function(result) {
			this.historyBytes = result && result.stdout ? result.stdout.length : 0;
			if (result.code || !result.stdout) {
				this.historyFailed = (result && String(result.stderr || '').trim()) || ('rpc code ' + (result && result.code));
				/* Keep the frame that is already on screen: a failed read is not a
				   reason to blank the chart the user is watching. */
				return;
			}
			this.historyFailed = '';
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
			if (rows.length) {
				this.history = rows.concat(newer);
				this.tempChart.rev = (this.tempChart.rev || 0) + 1;
			}
			this.drawChart(this.tempChart);
		}, this)).catch(L.bind(function(error) {
			this.historyFailed = String((error && error.message) || error);
			this.drawChart(this.tempChart);
			/* Live samples remain available. */
		}, this));
	},

	controlMode: function() {
		var configured = setting('mode', 'balanced');
		return Object.prototype.hasOwnProperty.call(MODES, configured) || configured === 'fixed' ? configured : 'balanced';
	},

	/* LuCI counts unsaved changes for the header indicator. The dashboard writes
	   through the same uci layer, so the count has to be reset here; otherwise
	   the page keeps insisting there are unsaved changes after a successful
	   apply. */
	clearChangesIndicator: function() {
		try {
			if (!ui.changes) return;
			ui.changes.changes = {};
			if (typeof ui.changes.setIndicator === 'function') ui.changes.setIndicator(0);
		} catch (error) { /* The indicator is cosmetic. */ }
	},

	applyOnce: function() {
		var transient = function(error) {
			var message = String((error && error.message) || error);
			return /uci\/apply/.test(message) || (error && error.code === 5);
		};
		var attempt = function(left) {
			return uci.apply().catch(function(error) {
				if (!transient(error) || left === 0) throw error;
				return new Promise(function(resolve) { window.setTimeout(resolve, 600); }).then(function() { return attempt(left - 1); });
			});
		};
		return attempt(1).catch(function(error) {
			// An empty apply queue reports the same error as a lost reply, so
			// treat "nothing left to apply" as a success instead of rolling back.
			return uci.changes().then(function(changes) {
				var pending = changes && changes[CONFIG];
				if (!pending || pending.length === 0) return null;
				throw error;
			}, function() { throw error; });
		});
	},

	commit: function(changes, kind) {
		if (this.saving) { this.queued = { changes: changes, kind: kind }; return Promise.resolve(); }
		var previous = {};
		var diff = {};
		var dirty = false;
		Object.keys(changes).forEach(function(key) {
			previous[key] = uci.get(CONFIG, SECTION, key);
			if (String(previous[key] == null ? '' : previous[key]) !== String(changes[key])) {
				diff[key] = changes[key];
				dirty = true;
			}
		});
		if (!dirty) {
			this.pendingCurve = null;
			this.curveTargetDirty = false;
			this.refreshPolicy();
			this.drainQueued();
			return this.fetchStatus().then(L.bind(this.update, this));
		}
		this.saving = true;
		this.paintSaveBar();
		Object.keys(diff).forEach(function(key) { uci.set(CONFIG, SECTION, key, String(diff[key])); });
		return uci.save().then(L.bind(this.applyOnce, this)).then(L.bind(function() {
			this.saving = false;
			this.clearChangesIndicator();
			this.paintSaveBar();
			this.pendingCurve = null;
			this.curveTargetDirty = false;
			this.refreshPolicy();
			this.drainQueued();
			return this.fetchStatus().then(L.bind(this.update, this));
		}, this)).catch(L.bind(function(error) {
			this.saving = false;
			this.paintSaveBar();
			var self = this;
			// Drop the staged values instead of keeping them as an unsaved
			// difference: the page then reloads the previous configuration.
			return callRevert(CONFIG).catch(function() {}).then(function() {
				return uci.unload(CONFIG);
			}).catch(function() {}).then(function() {
				return uci.load(CONFIG);
			}).catch(function() {}).then(function() {
				ui.addNotification(null, E('p', {}, _('Could not apply policy: %s').format((error.message || String(error)))), 'danger');
				self.refreshPolicy();
				self.drainQueued();
			});
		}, this));
	},

	scheduleCommit: function(changes, kind) {
		if (this.saving) { this.queued = { changes: changes, kind: kind }; return; }
		this.clearPending();
		if (Number(changes.fixed_duty) === 0) {
			this.commit(changes, kind);
			return;
		}
		this.pending = { changes: changes, kind: kind, until: Date.now() + MERGE_DELAY };
		this.paintPending();
		this.pendingTimer = setTimeout(L.bind(this.flushPending, this), MERGE_DELAY);
		this.pendingTicker = setInterval(L.bind(this.paintPending, this), 400);
	},

	clearPending: function() {
		clearTimeout(this.pendingTimer);
		clearInterval(this.pendingTicker);
		this.pending = null;
	},

	flushPending: function() {
		var pending = this.pending;
		if (!pending) return;
		clearTimeout(this.pendingTimer);
		clearInterval(this.pendingTicker);
		this.pending = null;
		this.paintPending();
		this.paintSaveBar();
		this.commit(pending.changes, pending.kind);
	},

	drainQueued: function() {
		var queued = this.queued;
		this.queued = null;
		if (queued && queued.changes) this.scheduleCommit(queued.changes, queued.kind);
	},

	paintPending: function() {
		this.setMethodState(this.fixedState, 'fixed', this.fixedSelected);
		this.setMethodState(this.curveState, 'curve', this.curveSelected);
		this.paintSaveBar();
	},

	/* The dashboard saves on a short merge delay. A floating strip shows that
	   delay and offers the same immediate apply, like the apply bar the stock
	   settings pages keep at the bottom; it hides while nothing is staging so
	   it never covers the chart on a phone. */
	makeSaveBar: function() {
		var self = this;
		this.saveLabel = E('span', { 'class': 'pf-savebar-label' }, _('All changes applied'));
		this.saveButton = E('button', { type: 'button', 'class': 'btn pf-savebar-apply', disabled: true,
			click: function() { self.flushPending(); } }, _('Apply now'));
		this.saveBar = E('footer', { 'class': 'pf-savebar', hidden: true, role: 'status', 'aria-live': 'polite' },
			[ this.saveLabel, this.saveButton ]);
		return this.saveBar;
	},

	paintSaveBar: function() {
		if (!this.saveLabel || !this.saveBar) return;
		var pending = this.pending, committing = this.saving;
		var seconds = pending ? Math.max(0, Math.ceil((pending.until - Date.now()) / 1000)) : 0;
		this.saveLabel.textContent = committing
			? _('Applying changes…')
			: pending ? _('Applies automatically in %d s').format(seconds) : _('All changes applied');
		this.saveButton.disabled = !pending || committing;
		this.saveBar.hidden = !pending && !committing;
	},

	switcher: function(options) { return shared.switcher(options); },

	detailState: function(name, fallback) {
		try {
			var stored = JSON.parse(localStorage.getItem(DETAILS_KEY) || '{}');
			if (typeof stored[name] === 'boolean') return stored[name];
		} catch (error) { /* Panel state is optional. */ }
		return fallback;
	},

	rememberDetail: function(name, open) {
		try {
			var stored = JSON.parse(localStorage.getItem(DETAILS_KEY) || '{}');
			stored[name] = !!open;
			localStorage.setItem(DETAILS_KEY, JSON.stringify(stored));
		} catch (error) { /* Panel state is optional. */ }
	},

	themeMode: function() { return shared.themeMode(); },

	applyTheme: function(mode) { shared.applyTheme(mode); },

	setTheme: function(mode) { return shared.setTheme(mode); },

	themeSwitcher: function() { return shared.themeSwitcher(); },

	languageSwitcher: function() { return shared.languageSwitcher(); },

	refreshPolicy: function() {
		var mode = this.controlMode(), fixed = mode === 'fixed';
		var self = this;
		var curveMode = fixed ? setting('curve_mode', 'balanced') : mode;
		if ([ 'quiet', 'balanced', 'performance', 'target', 'manual' ].indexOf(curveMode) < 0) curveMode = 'balanced';
		this.fixedSelected = fixed;
		this.curveSelected = !fixed;
		this.modeButtons.forEach(function(button) {
			button.setAttribute('aria-pressed', String(button.dataset.mode === curveMode && !fixed));
		});
		var fixedTitle = this.methodTitle(_('Fixed request'), 'fixed', fixed, function() {
			if (!fixed) self.scheduleCommit({ mode: 'fixed', drive: 'duty', enabled: '1' }, 'fixed');
		});
		var curveTitle = this.methodTitle(_('Curve preset'), 'curve', !fixed, function() {
			if (fixed) self.scheduleCommit({ mode: curveMode, curve_mode: curveMode, drive: 'curve', enabled: '1' }, 'curve');
		});
		this.methodButtons = [ fixedTitle, curveTitle ];
		// Selecting a curve mode should reveal its parameters: a collapsed panel hides the
		// editor, and with it the only Apply button for a hand-tuned curve.
		var modeChanged = this.lastCurveMode !== curveMode;
		this.lastCurveMode = curveMode;
		var curveChildren = [ curveTitle,
			E('div', { 'class': 'pf-modes', role: 'group', 'aria-label': _('Curve preset') }, this.presetButtons),
			E('div', { 'class': 'pf-modes pf-drives' }, this.driveButtons) ];
		// Both drive modes are curve modes, so their parameters live with the curve
		// itself: the panel opens below the chart it edits.
		var params = [];
		if (!fixed && curveMode === 'target') params.push(E('details', { 'class': 'pf-parameters', 'data-detail': 'target',
			open: modeChanged || this.detailState('target', false) ? true : null }, [ E('summary', {}, _('Target drive parameters')), this.targetFields() ]));
		if (!fixed && curveMode === 'manual') params.push(E('details', { 'class': 'pf-parameters', 'data-detail': 'manual',
			open: modeChanged || this.detailState('manual', false) ? true : null }, [ E('summary', {}, _('Curve parameters')), this.editor ]));
		this.curveParams.replaceChildren.apply(this.curveParams, params);
		if (params.length && this.curveCard && modeChanged) this.curveCard.open = true;
		this.policy.replaceChildren(
			E('section', { 'class': 'pf-method', 'data-selected': String(fixed) }, [ fixedTitle, this.fixedControls() ]),
			E('section', { 'class': 'pf-method', 'data-selected': String(!fixed) }, curveChildren));
		this.renderEditor();
		this.drawCharts();
		this.updateWarnings();
	},

	methodTitle: function(label, kind, selected, click) {
		var state = E('span', { 'class': 'pf-method-state' });
		var button = E('button', { type: 'button', 'class': 'pf-method-title', 'aria-pressed': String(selected), click: click },
			[ E('span', { 'class': 'pf-method-name' }, label), state ]);
		this[kind + 'State'] = state;
		this.setMethodState(state, kind, selected);
		return button;
	},

	setMethodState: function(state, kind, selected) {
		if (!state) return;
		var pending = this.pending && this.pending.kind === kind ? this.pending : null;
		var draft = kind === 'curve' && selected && (this.curveTargetDirty || !!this.pendingCurve);
		state.dataset.pending = pending ? 'true' : 'false';
		state.dataset.draft = draft ? 'true' : 'false';
		state.textContent = pending
			? _('Applying in %s s').format(Math.max(1, Math.ceil((pending.until - Date.now()) / 1000)))
			: draft ? _('Pending')
			: selected ? _('Selected') : _('Not selected');
	},

	odometer: function() {
		var columns = [2, 1, 0].map(function(place) {
			var digits = [];
			for (var repeat = 0; repeat < 2; repeat++) {
				for (var digit = 0; digit < 10; digit++)
					digits.push(E('span', { 'class': 'pf-odo-digit' }, String(digit)));
			}
			var strip = E('span', { 'class': 'pf-odo-strip' }, digits);
			var column = { place: place, pos: 0, value: 0, strip: strip, el: E('span', { 'class': 'pf-odo-col' }, [ strip ]) };
			var place_ = function(instant) {
				column.strip.style.transform = 'translateY(' + (-column.pos * 1.2) + 'em)';
				if (instant) {
					column.strip.dataset.jump = 'true';
					void column.strip.offsetHeight;
					column.strip.dataset.jump = 'false';
				}
			};
			column.move = function(digit) {
				var delta = digit - column.value;
				if (delta > 5) delta -= 10;
				if (delta < -5) delta += 10;
				column.value = digit;
				if (column.pos > 9 || column.pos < 0) {
					column.pos = ((column.pos % 10) + 10) % 10;
					place_(true);
				}
				if (!delta) return;
				column.pos += delta;
				place_(false);
			};
			column.strip.addEventListener('transitionend', function(event) {
				if (event.propertyName !== 'transform') return;
				if (column.pos > 9 || column.pos < 0) {
					column.pos = ((column.pos % 10) + 10) % 10;
					place_(true);
				}
			});
			return column;
		});
		return {
			el: E('span', { 'class': 'pf-odo' }, columns.map(function(column) { return column.el; })),
			set: function(number) {
				var used = String(number).length;
				columns.forEach(function(column) {
					var visible = column.place < used;
					column.el.dataset.hidden = visible ? 'false' : 'true';
					if (!visible) return;
					column.move(Math.floor(number / Math.pow(10, column.place)) % 10);
				});
			}
		};
	},

	fixedControls: function() {
		var self = this;
		var duty = clamp(Number(setting('fixed_duty', 50)), 0, 100);
		var value = E('strong', {}, duty + '%');
		var odometer = this.odometer();
		var bubble = E('output', { 'class': 'pf-bubble', 'aria-hidden': 'true' }, [ odometer.el, E('span', { 'class': 'pf-odo-unit' }, '%') ]);
		var slider = E('input', { type: 'range', min: 0, max: 100, step: 1, value: duty, 'aria-label': _('Requested duty') });
		var thumb = E('span', { 'class': 'pf-thumb', 'aria-hidden': 'true' });
		var track = E('div', { 'class': 'pf-track' }, [ bubble, thumb, slider ]);
		var paint = function() {
			var current = Number(slider.value);
			value.textContent = current + '%';
			odometer.set(current);
			track.style.setProperty('--pf-duty', current + '%');
			track.style.setProperty('--pf-ratio', String(current / 100));
		};
		var liveTimer = null;
		var showBubble = function() {
			track.classList.add('is-live');
			clearTimeout(liveTimer);
		};
		var hideBubbleSoon = function() {
			clearTimeout(liveTimer);
			liveTimer = setTimeout(function() { track.classList.remove('is-live'); }, 700);
		};
		var apply = function() {
			self.scheduleCommit({ mode: 'fixed', drive: 'duty', fixed_duty: Number(slider.value), enabled: '1' }, 'fixed');
		};
		var step = function(delta) {
			slider.value = clamp(Number(slider.value) + delta, 0, 100);
			paint();
			showBubble();
			hideBubbleSoon();
			apply();
		};
		var minus = E('button', { type: 'button', 'class': 'pf-step', 'aria-label': _('Decrease duty'), click: function() { step(-1); } }, '\u2212');
		var plus = E('button', { type: 'button', 'class': 'pf-step pf-step-plus', 'aria-label': _('Increase duty'), click: function() { step(1); } }, '+');
		slider.addEventListener('input', function() { paint(); showBubble(); });
		slider.addEventListener('change', function() { showBubble(); hideBubbleSoon(); apply(); });
		slider.addEventListener('pointerdown', function() {
			showBubble();
			try { slider.focus({ preventScroll: true }); } catch (e) {}
		});
		slider.addEventListener('pointerup', hideBubbleSoon);
		slider.addEventListener('pointercancel', hideBubbleSoon);
		slider.addEventListener('blur', hideBubbleSoon);
		this.methodControls = [ minus, plus, slider ];
		paint();
		return E('div', { 'class': 'pf-fixed' }, [
			E('p', { 'class': 'pf-fixed-value' }, [ E('span', {}, _('Requested duty')), value ]),
			E('div', { 'class': 'pf-fixed-row' }, [ minus, track, plus ]) ]);
	},

	floorChip: function() {
		this.floorStatus = E('span', { 'class': 'pf-status pf-floor is-pulse', hidden: true }, _('Non-zero request floor'));
		return this.floorStatus;
	},

	warningRow: function() {
		this.warnCurve = E('span', { 'class': 'pf-warn pf-warn-low', hidden: true }, _('Curve too low in the hot zone'));
		this.warnStop = E('span', { 'class': 'pf-warn pf-warn-stop', hidden: true }, _('Fan stopped'));
		this.warnStale = E('span', { 'class': 'pf-warn pf-warn-stale', hidden: true }, _('Temperature reading expired'));
		this.warnRow = E('div', { 'class': 'pf-warnings', hidden: true, 'aria-live': 'polite' }, [ this.warnCurve, this.warnStop, this.warnStale ]);
		this.warnNote = E('p', { 'class': 'pf-warn-note', hidden: true }, _('Excessive temperature may shorten the hardware life'));
		return this.warnRow;
	},

	updateWarnings: function() {
		if (!this.warnRow) return;
		if (this.floorStatus) this.floorStatus.hidden = !(this.readings && this.readings.floor);
		var output = (this.readings && this.readings.output) || [];
		var forced = !!window.PWMFAN_PREVIEW;
		var stop = forced || (output[0] === 0 && output[1] === 0);
		var low = forced || this.curveTooLow();
		var stale = !!(this.readings && this.readings.stale);
		this.pulseWarning(this.warnStop, !stop);
		this.pulseWarning(this.warnCurve, !low);
		this.pulseWarning(this.warnStale, !stale);
		this.warnNote.hidden = !(stop || low);
		this.warnRow.hidden = !(stop || low || stale);
	},

	pulseWarning: function(node, hide) {
		if (!node) return;
		var wasHidden = node.hidden;
		node.hidden = hide;
		if (hide) { node.classList.remove('is-pulse'); return; }
		if (!wasHidden) return;
		node.classList.remove('is-pulse');
		void node.offsetWidth;
		node.classList.add('is-pulse');
	},

	curveTooLow: function() {
		var mode = this.controlMode();
		if (mode === 'fixed') return Number(setting('fixed_duty', 50)) < 50;
		if (mode === 'target') return false;
		var points = mode === 'manual' ? parseCurve(setting('curve_manual', CURVES.manual)) : parseCurve(CURVES[mode] || CURVES.balanced);
		return points.some(function(point) { return point.t != null && point.t >= 60 && point.pwm != null && percent(point.pwm) < 50; });
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
			E('div', { 'class': 'pf-target-actions' }, [
				E('button', { type: 'button', 'class': 'btn', click: function() {
					form.elements.target_temp.value = target;
					form.elements.response_range.value = response;
					form.elements.transition_width.value = width;
					annotate();
				} }, _('Undo')),
				E('button', { type: 'submit', 'class': 'btn' }, _('Apply target')) ]), message ]);
		var annotate = function() {
			var onset = Number(form.elements.target_temp.value) - Number(form.elements.response_range.value);
			var effective = Math.max(0, Math.min(onset, Number(form.elements.transition_width.value)));
			message.textContent = _('Response starts at %s °C · Effective transition %s °C').format(onset, effective);
			self.curveTargetDirty = Number(form.elements.target_temp.value) !== target
				|| Number(form.elements.response_range.value) !== response
				|| Number(form.elements.transition_width.value) !== width;
			self.paintPending();
		};
		form.addEventListener('input', annotate);
		annotate();
		return form;
	},

	curvePoints: function() {
		var mode = this.controlMode();
		var low = Number(setting('min_pwm', 51)), max = Number(setting('max_pwm', 255));
		var limit = function(pwm) { return pwm ? clamp(pwm, Math.min(low, max), max) : 0; };
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
		if (editorPoints.length === 6) {
			rows.push(E('div', { 'class': 'pf-points-head' }, [
				E('span', {}, '#'),
				E('span', {}, _('Temperature (°C)')),
				E('span', {}, _('Output (%)'))
			]));
			editorPoints.forEach(function(point, i) {
				var input = function(label, axis, value, min, max) {
					return E('input', {
						type: 'number', value: value, min: min, max: max, step: 1, disabled: !manual ? '' : null,
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
					});
				};
				rows.push(E('div', { 'class': 'pf-point' }, [ E('span', {}, String(i + 1)),
					input(_('Temperature (°C)'), 't', point.t, i ? editorPoints[i - 1].t + 1 : 0, i < 5 ? editorPoints[i + 1].t - 1 : 100),
					input(_('Output (%)'), 'pwm', percent(point.pwm), 0, 100) ]));
			});
		}
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
		this.paintPending();
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
			floor: fresh && String(data.floor_limited) === '1',
			/* The controller held the last reading because this one was
			   unreadable; the numbers above are one control period old. */
			stale: fresh && String(data.stale_temperature) === '1',
			/* "Curve request" is what the selected policy asks for at this
			   temperature; "actual output" is what the hardware really runs, so
			   the downshift hold, the PID correction, the protection ramp and the
			   startup boost all show up as a difference between the two. */
			output: [ 'mode_pwm', 'effective_pwm' ].map(function(key) {
				var value = fresh ? number(data[key], 0, 255) : null;
				return value === null ? null : percent(value);
			}), rpm: fresh ? number(data.rpm, 0, 100000) : null };
	},

	updateLegend: function(values) {
		var self = this;
		var setValue = function(chart, key, text) {
			var node = chart && chart.legendValue ? chart.legendValue[key] : null;
			if (node) node.textContent = text;
		};
		var temps = values.temps || [], output = values.output || [];
		var usable = temps.filter(function(value) { return value !== null && value !== undefined; });
		/* The curve follows the controller's control temperature, which is the
		   hottest usable sensor, not the first row. */
		setValue(this.curveChart, 'request', legendPercent(output[0]));
		setValue(this.curveChart, 'temperature', usable.length ? Math.max.apply(null, usable).toFixed(1) + ' °C' : '—');
		setValue(this.curveChart, 'actual', legendPercent(output[1]));
		/* The protection key shows the threshold the dashed line marks, not a duty. */
		setValue(this.curveChart, 'protection', Number(setting('protection_temp', 90)).toString() + ' °C');
		temps.forEach(function(value, index) {
			setValue(self.tempChart, 'sensor' + index, value === null || value === undefined ? _('Unavailable') : value.toFixed(1) + ' °C');
		});
	},

	update: function(data) {
		this.data = data;
		var values = this.readings = this.metricValues(data);
		this.updateLegend(values);
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
		var sources = { userspace: _('Plugin control'), protection: _('Temperature protection'),
			kernel: _('Kernel control'), none: _('Not in control') };
		var source = values.fresh && Object.prototype.hasOwnProperty.call(sources, data.owner) &&
			!/^(kernel_or_driver_override|pwm_mismatch)$/.test(data.reason || '') ? sources[data.owner] : _('Unknown');
		var label = source === state[0] ? state[0] : state[0] + ' · ' + source;
		this.badge.dataset.state = state[1];
		this.badgeText.textContent = label;
		this.badge.title = data.reason === 'takeover_pending' ? _('Hardware verification is pending.') : label;
		if (this.historyState) this.historyState.textContent = values.fresh && values.temps.some(function(value) { return value !== null; }) ? _('Live temperature readings') : _('Waiting for temperature readings');
		var now = Date.now(), time = values.fresh ? values.stamp * 1000 : now, last = this.history[this.history.length - 1];
		var readable = values.temps.some(function(value) { return value !== null; });
		/* A poll that carries no usable reading is not a data point: recording it
		   would punch a hole in the chart for a gap that never happened. */
		if (readable && (!last || time - last.time >= this.interval * 1000)) {
			this.history.push({ time: time, temps: values.temps });
			this.history = this.history.filter(function(sample) { return sample.time >= now - HISTORY_LIMIT; });
			this.tempChart.rev = (this.tempChart.rev || 0) + 1;
		}
		this.updateWarnings();
		/* The page may poll faster than the controller writes. Repainting pixels
		   that did not change is what makes a chart flash between samples. */
		var signature = [ values.stamp, values.output.join(','), values.floor ? 1 : 0, readable ? 1 : 0 ].join('|');
		if (signature !== this.signature) {
			this.signature = signature;
			this.curveChart.rev = (this.curveChart.rev || 0) + 1;
		}
		this.drawCharts();
	},

	makeChart: function(label, legend, history) {
		var self = this, canvas = E('canvas', { role: 'img', 'aria-label': label });
		var tip = E('div', { 'class': 'pf-tooltip', hidden: true });
		var chart = { canvas: canvas, tip: tip, cursor: null, history: history, handles: [] };
		if (!history) {
			for (var i = 0; i < 6; i++) chart.handles.push(E('span', { 'class': 'pf-touch-point', 'aria-hidden': 'true', hidden: '' }));
		}
		chart.empty = E('p', { 'class': 'pf-chart-empty', hidden: '' }, _('Waiting for samples…'));
		var plot = E('div', { 'class': 'pf-plot' }, [ canvas, tip, chart.empty ].concat(chart.handles));
		chart.legendValue = {};
		var legendNode = E('div', { 'class': 'pf-legend' }, legend.map(function(series) {
			var parts = [ E('i', { style: 'background:var(' + series[1] + ')' }),
				E('span', { 'class': 'pf-legend-label' }, series[0]) ];
			if (series[2]) {
				chart.legendValue[series[2]] = E('b', { 'class': 'pf-legend-value' });
				parts.push(chart.legendValue[series[2]]);
			}
			return E('span', series[2] ? { 'data-key': series[2] } : {}, parts);
		}));
		/* Canvas pixels are invisible to a screen reader, so the same numbers are
		   repeated in a visually hidden table. */
		chart.table = E('table', { 'class': 'pf-sr-only' }, [
			E('caption', {}, history ? _('Temperature monitor data') : _('Fan curve data')),
			E('thead', {}, E('tr', {}, (history
				? [ _('Time') ].concat(SENSORS.map(function(sensor) { return sensor[0]; }))
				: [ _('Temperature'), _('Requested output') ])
				.map(function(head) { return E('th', { scope: 'col' }, head); }))),
			E('tbody', {})
		]);
		chart.element = E('div', { 'class': 'pf-chart' }, [ legendNode, plot, chart.table ]);
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

	/* Mirror the plotted data into the hidden table so keyboard and screen
	   reader users get the numbers the canvas draws. */
	paintChartTable: function(chart) {
		var table = chart && chart.table;
		if (!table || !table.tBodies[0]) return;
		var rows = [], locale = document.documentElement.lang || undefined;
		if (chart.history) {
			this.history.slice(-12).forEach(function(sample) {
				var time = new Date(sample.time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
				rows.push([ time ].concat(sample.temps.map(function(value) {
					return value == null ? _('Unavailable') : value.toFixed(1) + ' °C';
				})));
			});
		} else {
			this.curvePoints().forEach(function(point) {
				rows.push([ point.t + ' °C', (Math.round(percent(point.pwm) * 10) / 10) + ' %' ]);
			});
		}
		if (!rows.length) rows.push([ _('Waiting for samples…'), '—' ]);
		var key = JSON.stringify(rows);
		if (chart.tableKey === key) return;
		chart.tableKey = key;
		var body = table.tBodies[0];
		body.replaceChildren.apply(body, rows.map(function(row) {
			return E('tr', {}, row.map(function(cell) { return E('td', {}, String(cell)); }));
		}));
	},

	drawChart: function(chart) {
		var canvas = chart.canvas, width = canvas.clientWidth, height = canvas.clientHeight;
		if (!width || !height) {
			if (chart.empty) chart.empty.hidden = false;
			if ((this.redrawTries || 0) < 12) {
				this.redrawTries = (this.redrawTries || 0) + 1;
				this.scheduleRedraw();
			}
			return;
		}
		this.redrawTries = 0;
		if (chart.empty) chart.empty.hidden = !(chart.history && this.history.length < 2);
		/* Resize observers fire on every card reflow; repainting identical pixels
		   is wasted work, so only redraw when the box, the data or the cursor
		   actually moved. */
		var scale = window.devicePixelRatio || 1, wantWidth = Math.round(width * scale), wantHeight = Math.round(height * scale);
		var paintKey = [ wantWidth, wantHeight, chart.rev || 0, chart.cursor == null ? '' : Math.round(chart.cursor) ].join(':');
		if (chart.paintKey === paintKey && canvas.width === wantWidth && canvas.height === wantHeight) {
			this.paintChartTable(chart);
			return;
		}
		chart.paintKey = paintKey;
		/* Assigning width or height clears the bitmap, so do it only when the
		   size really changed; the paint below redraws every pixel anyway. */
		if (canvas.width !== wantWidth) canvas.width = wantWidth;
		if (canvas.height !== wantHeight) canvas.height = wantHeight;
		var ctx = canvas.getContext('2d'), vars = getComputedStyle(this.root);
		var color = function(name) {
			var value = vars.getPropertyValue(name).trim();
			return value.startsWith('light-dark(') ? value.slice(11, -1).split(',')[vars.colorScheme === 'dark' ? 1 : 0].trim() : value;
		};
		/* Resetting the size is what normally resets the transform, but the size is
		   now only touched when it changed. Set the transform outright so repeated
		   repaints on a high-DPR screen cannot scale the drawing again and again. */
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.setTransform(scale, 0, 0, scale, 0, 0);
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
		ctx.font = '11px ' + (color('--pf-font') || 'sans-serif');
		ctx.fillStyle = color('--pf-muted');
		ctx.textAlign = 'right';
		for (var tick = 0; tick <= 100; tick += 20) {
			coords(left, y(tick), right, y(tick), color('--pf-line'), tick ? [ 3, 3 ] : []);
			ctx.fillText(tick + (chart.history ? '°C' : '%'), left - 6, y(tick) + 4);
		}
		/* Keep all six ticks so the five segments stay readable. Upright labels only
		   fit on wide screens; on phones they would touch, so tilt them by 45°. */
		var ticks = [];
		for (var i = 0; i <= 5; i++) {
			var value = start + (end - start) * i / 5;
			var text = chart.history ? localeTime(value) : value + '°C';
			var inkWidth = ctx.measureText(text).width;
			var anchor = x(value);
			var align = i === 0 ? 'left' : i === 5 ? 'right' : 'center';
			var boxLeft = align === 'left' ? anchor : align === 'right' ? anchor - inkWidth : anchor - inkWidth / 2;
			ticks.push({ value: value, text: text, align: align, boxLeft: boxLeft, boxRight: boxLeft + inkWidth });
		}
		var tilt = ticks.some(function(tick, index) {
			return index > 0 && tick.boxLeft < ticks[index - 1].boxRight + 5;
		});
		if (tilt) {
			/* The tilted run of text descends to the right, so give it room under
			   and beside the plot instead of letting it run into the y labels. */
			bottom = height - 40;
			right = width - 30;
			chart.geometry = { x: x, y: y, input: input, left: left, bottom: bottom, height: bottom - top };
		}
		ticks.forEach(function(tick) {
			coords(x(tick.value), top, x(tick.value), bottom, color('--pf-line'), [ 3, 3 ]);
			if (!tilt) {
				ctx.textAlign = tick.align;
				ctx.fillText(tick.text, x(tick.value), bottom + 17);
				return;
			}
			ctx.save();
			ctx.translate(x(tick.value) + 1, bottom + 7);
			ctx.rotate(Math.PI / 4);
			ctx.textAlign = 'left';
			ctx.fillText(tick.text, 0, 0);
			ctx.restore();
		});
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
			canvas.dataset.historyRows = this.history.length;
			canvas.dataset.historyBytes = this.historyBytes == null ? -1 : this.historyBytes;
			canvas.dataset.historyError = this.historyFailed || '';
			if (!samples.some(function(sample) { return sample.temps.some(function(value) { return value !== null; }); })) {
				ctx.textAlign = 'center';
				ctx.fillStyle = color('--pf-muted');
				ctx.fillText(this.historyFailed ? _('Temperature history unavailable') : _('Waiting for sensor readings…'), width / 2, height / 2);
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
			// Protection is a temperature threshold, so it is marked on the temperature
			// axis: a vertical line where the protection ramp locks to full output.
			var guardTemp = Number(setting('protection_temp', 90));
			if (isFinite(guardTemp) && guardTemp > 0 && guardTemp <= 100) {
				var guardX = x(guardTemp);
				ctx.strokeStyle = color('--pf-red'); ctx.globalAlpha = 0.75;
				ctx.lineWidth = 1.4; ctx.setLineDash([ 5, 4 ]);
				ctx.beginPath(); ctx.moveTo(guardX, top); ctx.lineTo(guardX, bottom); ctx.stroke();
				ctx.setLineDash([]); ctx.globalAlpha = 1;
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

	scheduleRedraw: function() {
		if (this.redrawTimer) return;
		var self = this;
		this.redrawTimer = window.setTimeout(function() {
			self.redrawTimer = null;
			if (self.root && self.root.isConnected) self.drawCharts();
		}, 250);
	},

	render: function(data) {
		var self = this;
		this.history = [];
		var storedRange = Number(setting('history_range', 5));
		var storedInterval = Number(setting('history_interval', 2));
		var storedPoll = Number(setting('poll_interval', 2));
		this.range = Number.isInteger(storedRange) && storedRange >= 5 && storedRange <= 360 ? storedRange : 5;
		this.interval = Number.isInteger(storedInterval) && storedInterval >= 1 && storedInterval <= 5 ? storedInterval : 2;
		this.pollSeconds = Number.isInteger(storedPoll) && storedPoll >= 1 && storedPoll <= 5 ? storedPoll : 2;
		this.badgeText = E('span', {}, _('Status unavailable'));
		this.badge = E('span', { 'class': 'pf-live', role: 'status', 'data-state': 'idle' }, [ E('i', { 'aria-hidden': 'true' }), this.badgeText ]);
		var modeButton = function(mode) {
			return E('button', { type: 'button', 'class': 'btn pf-mode', 'data-mode': mode,
				click: function() { self.scheduleCommit({ mode: mode, curve_mode: mode, drive: 'curve', enabled: '1' }, 'curve'); } }, MODES[mode]);
		};
		this.presetButtons = [ 'quiet', 'balanced', 'performance' ].map(modeButton);
		this.driveButtons = [ 'target', 'manual' ].map(modeButton);
		this.modeButtons = this.presetButtons.concat(this.driveButtons);
		this.policy = E('div', { 'class': 'pf-policy' });
		this.curveParams = E('div', { 'class': 'pf-curve-params' });
		this.editor = E('div', { 'class': 'pf-editor' });
		this.warningRow();
		this.saveCurve = E('button', { type: 'button', 'class': 'btn', click: function() {
			self.commit({ curve_manual: self.pendingCurve.map(function(point) { return point.t + ':' + point.pwm; }).join(',') });
		} }, _('Apply curve'));
		this.curveChart = this.makeChart(_('Fan curve'), [ [ _('Curve request'), '--pf-blue', 'request' ],
			[ _('Current temperature'), '--pf-green', 'temperature' ], [ _('Actual output'), '--pf-amber', 'actual' ],
			[ _('Temperature protection'), '--pf-red', 'protection' ] ], false);
		this.tempChart = this.makeChart(_('Temperature monitor'), SENSORS.map(function(sensor, index) { return [ sensor[0], sensor[2], 'sensor' + index ]; }), true);
		this.historyState = E('span', { 'class': 'pf-chart-state' }, _('Waiting for temperature readings'));
		// Window and interval are controller-side view settings now (advanced → View).
		var temps = E('details', { 'class': 'pf-card pf-history', 'data-detail': 'history',
			open: this.detailState('history', true) ? true : null }, [ E('summary', {}, [ E('h3', {}, _('Temperature monitor')), this.historyState ]),
			this.tempChart.element ]);
		this.root = E('div', { 'class': 'pf-page' }, [
			E('link', { rel: 'stylesheet', href: L.resource('view/h5000m-pwmfan.css') }),
			E('div', { 'class': 'pf-heading' }, [ E('h2', {}, _('Fan control')), this.badge,
				E('span', { 'class': 'pf-heading-gap' }), this.themeSwitcher(), this.languageSwitcher() ]),
			E('section', { 'class': 'pf-card' }, [ E('div', { 'class': 'pf-dispatch-head' }, [ E('h3', {}, _('Mode selection')),
				E('div', { 'class': 'pf-head-right' }, [ this.warnRow, this.floorChip() ]) ]),
				this.warnNote, this.policy ]),
			this.curveCard = E('details', { 'class': 'pf-card pf-curve-chart', 'data-detail': 'curve',
				open: this.detailState('curve', false) ? true : null }, [ E('summary', {}, E('h3', {}, _('Fan curve'))),
				this.curveChart.element, this.curveParams ]), temps,
			this.makeSaveBar()
		]);
		this.applyTheme(this.themeMode());
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener)
			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() { self.applyTheme(self.themeMode()); });
		window.addEventListener('pagehide', function() { self.flushPending(); });
		document.addEventListener('visibilitychange', function() {
			if (document.visibilityState === 'hidden') { self.flushPending(); return; }
			/* Coming back refreshes at once instead of waiting for the next tick,
			   so the chart never shows a gap that already closed. */
			self.fetchStatus().then(self.update.bind(self)).catch(function() { });
		});
		this.root.addEventListener('toggle', function(event) {
			var node = event.target;
			if (node && node.dataset && node.dataset.detail) self.rememberDetail(node.dataset.detail, node.open);
		}, true);
		this.refreshPolicy();
		this.update(data);
		this.loadTemperatureHistory();
		/* One setting, one refresh: the monitor interval paces both the file
		   re-read and the live append, so two refreshes never show the same
		   sample twice or an empty slot in between. */
		this.historyTimer = window.setInterval(function() {
			if (!document.hidden) self.loadTemperatureHistory();
		}, this.interval * 1000);
		window.addEventListener('pagehide', function() { window.clearInterval(self.historyTimer); });
		temps.addEventListener('toggle', this.drawCharts.bind(this));
		var observer = new ResizeObserver(function() { if (self.root.isConnected) self.drawCharts(); });
		observer.observe(this.root);
		var media = window.matchMedia('(prefers-color-scheme: dark)');
		media.addEventListener('change', this.drawCharts.bind(this));
		poll.add(function() {
			/* A hidden tab needs no pixels; the daemon keeps sampling, so the next
			   visible tick is complete again. */
			if (document.hidden) return Promise.resolve();
			return self.fetchStatus().then(self.update.bind(self));
		}, this.pollSeconds);
		self.drawCharts();
		window.setTimeout(function() { self.drawCharts(); }, 0);
		return this.root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
