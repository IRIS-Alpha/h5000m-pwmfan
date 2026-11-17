'use strict';
'require view';
'require form';
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
	custom: _('Custom curve'),
	manual: _('Manual PWM'),
	kernel: _('Kernel only')
};

return view.extend({
	load: function() {
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
			[ 'performance', '1', _('Performance') ], [ 'custom', '1', _('Custom curve') ],
			[ 'manual', '1', _('Manual') ], [ 'kernel', '1', _('Kernel only') ],
			[ 'balanced', '0', _('Off') ]
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
						this.applyConfig().then(L.bind(function() {
							return this.refresh();
						}, this)).catch(function(err) {
							ui.addNotification(null, E('p', _('Could not apply policy: %s').format(err.message)), 'danger');
						});
					}, this)
				}, item[2]);
			}, this));
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
			'.pwmfan-metric span,.pwmfan-metric small{display:block;color:var(--pf-muted);font-size:11px}.pwmfan-metric strong{display:block;margin:7px 0;font-size:20px;line-height:1.15;overflow-wrap:anywhere}.pwmfan-metric small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.pwmfan-section{margin:0 0 12px;padding:13px;border:1px solid var(--pf-border);border-radius:5px;background:var(--pf-bg)}.pwmfan-section-title{margin-bottom:10px}.pwmfan-section-title h3{margin:0;font-size:15px}.pwmfan-section-title span{color:var(--pf-muted);font-size:11px}',
			'.pwmfan-modes{display:flex;flex-wrap:wrap;gap:6px}.pwmfan-mode{min-height:34px;border-radius:4px}.pwmfan-mode.active{border-color:var(--v-accent-line,var(--pf-accent));box-shadow:inset 0 -2px var(--v-accent-fill,var(--pf-accent))}',
			'.pwmfan-sensors{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pwmfan-sensor{min-width:0;padding:9px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-bg-2,rgba(127,127,127,.06))}.pwmfan-sensor.selected{border-color:var(--v-accent-line,var(--pf-accent))}.pwmfan-sensor span,.pwmfan-sensor small{display:block;color:var(--pf-muted);font-size:10px}.pwmfan-sensor strong{display:block;margin:5px 0;font-size:16px}.pwmfan-sensor small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pwmfan-empty{color:var(--pf-muted);font-size:12px}',
			'.pwmfan-curve{display:block;width:100%;height:200px;border:1px solid var(--pf-border);border-radius:4px;background:var(--pf-bg-2,rgba(127,127,127,.04))}.pwmfan-reason{margin-top:8px;color:var(--pf-muted);font-size:11px}',
			'@media(max-width:850px){.pwmfan-overview,.pwmfan-sensors{grid-template-columns:repeat(2,minmax(0,1fr))}}',
			'@media(max-width:520px){.pwmfan-header{align-items:flex-start;flex-direction:column}.pwmfan-header-actions{width:100%;justify-content:space-between}.pwmfan-section-title{align-items:flex-start;flex-direction:column}.pwmfan-metric{padding:9px}.pwmfan-metric strong{font-size:17px}.pwmfan-page~.cbi-page-actions{position:static;width:auto;margin:16px 0 0}}'
		].join(''));
	},

	statusView: function(data) {
		var temp = function(value) {
			return value && value !== '--' ? _('%.1f °C').format(parseInt(value, 10) / 1000) : _('Unavailable');
		};
		var lang = this.languageControl(data);
		return E('div', { 'class': 'pwmfan' }, [
			this.style(),
			E('header', { 'class': 'pwmfan-header' }, [
				E('div', {}, [ E('h2', {}, _('H5000M PWM Fan')), E('p', {}, _('OWT2510 · Hiveton H5000M')) ]),
				E('div', { 'class': 'pwmfan-header-actions' }, [
					E('span', { 'id': 'pwmfan-state', 'class': 'pwmfan-state' }, data.state || _('Starting controller')),
					lang
				])
			]),
			E('div', { 'class': 'pwmfan-overview' }, [
				this.metric(_('Control temperature'), temp(data.temperature_mc), data.control_source || _('No source')),
				this.metric(_('Safety maximum'), temp(data.safety_temperature_mc), data.safety_source || _('Monitoring every source')),
				this.metric(_('Requested PWM'), (data.requested_pwm || '--') + ' / 255', _('Controller target')),
				this.metric(_('Effective PWM'), (data.effective_pwm || '--') + ' / 255', _('Hardware read-back'))
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Quick dispatch')), E('span', { 'class': 'pwmfan-mode-hint' }, data.state === 'disabled' ? _('Current mode: Off') : _('Current mode: %s').format(MODES[data.mode] || _('Unknown'))) ]),
				this.quickModes()
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Temperature array')), E('span', {}, _('Safety monitors all available sources')) ]),
				this.temperatureGrid(data)
			]),
			E('section', { 'class': 'pwmfan-section' }, [
				E('div', { 'class': 'pwmfan-section-title' }, [ E('h3', {}, _('Curve preview')), E('span', { 'id': 'pwmfan-profile' }, MODES[data.mode] || _('Disabled')) ]),
				E('canvas', { 'id': 'pwmfan-curve', 'class': 'pwmfan-curve', 'width': 900, 'height': 220 }),
				E('div', { 'id': 'pwmfan-reason', 'class': 'pwmfan-reason' }, _('Controller reason: %s').format(data.reason || _('Waiting for status')))
			])
		]);
	},

	metric: function(title, value, hint) {
		return E('div', { 'class': 'pwmfan-metric' }, [ E('span', {}, title), E('strong', {}, value), E('small', {}, hint) ]);
	},

	validateCurve: function(section, value) {
		var last = -1, points = (value || '').split(',');
		if (points.length < 2)
			return _('Enter at least two comma-separated temperature:PWM points.');
		for (var i = 0; i < points.length; i++) {
			var pair = points[i].split(':'), t = parseInt(pair[0], 10), pwm = parseInt(pair[1], 10);
			if (pair.length !== 2 || isNaN(t) || isNaN(pwm) || t <= last || t < 0 || t > 150 || pwm < 0 || pwm > 255)
				return _('Temperatures must ascend from 0–150 °C and PWM must stay between 0–255.');
			last = t;
		}
		return true;
	},

	renderForm: function(data) {
		var m = new form.Map(CONFIG, _('Fan policy'));
		var s = m.section(form.NamedSection, SECTION, 'settings'), o;
		s.anonymous = true;
		o = s.option(form.Flag, 'enabled', _('Enable fan controller'));
		o.default = '0'; o.rmempty = false;
		o.description = _('Disabled is read-only: status remains visible and PWM is not written.');
		o = s.option(form.ListValue, 'mode', _('Dispatch mode'));
		Object.keys(MODES).forEach(function(mode) { o.value(mode, MODES[mode]); });
		o.default = 'balanced'; o.rmempty = false;
		o = s.option(form.ListValue, 'sensor_sources', _('Curve sensor'));
		o.value('auto', _('Hottest valid sensor'));
		(data.sensors || '').split(';').filter(Boolean).forEach(function(row) {
			var p = row.split('|');
			if (p.length >= 4 && p[3] !== 'unsupported') o.value(p[0], p[1].replace(/_/g, ' '));
		});
		o.default = 'auto'; o.rmempty = false;
		o.description = _('Unselected valid sensors still participate in the high-temperature safety override.');
		o = s.option(form.Value, 'manual_pwm', _('Manual PWM (0–255)'));
		o.datatype = 'range(0,255)'; o.default = '128'; o.rmempty = false; o.depends('mode', 'manual');
		[ 'quiet', 'balanced', 'performance', 'custom' ].forEach(function(profile) {
			o = s.option(form.Value, 'curve_' + profile, _('%s curve (°C:PWM)').format(MODES[profile]));
			o.rmempty = false; o.depends('mode', profile); o.validate = L.bind(this.validateCurve, this);
			o.description = _('The chart previews this curve. Temperature points must ascend.');
		}, this);
		[
			[ 'min_pwm', _('Minimum PWM'), 0, 255, 51 ],
			[ 'max_pwm', _('Maximum curve PWM'), 1, 255, 255 ],
			[ 'safety_temp', _('Full-speed safety temperature (°C)'), 40, 125, 85 ],
			[ 'kick_pwm', _('Startup boost PWM'), 0, 255, 255 ],
			[ 'kick_ms', _('Startup boost duration (ms)'), 0, 5000, 750 ],
			[ 'hysteresis', _('Downshift hysteresis (°C)'), 0, 30, 3 ],
			[ 'down_delay', _('Downshift delay (s)'), 0, 600, 10 ],
			[ 'poll_interval', _('Sampling interval (s)'), 1, 30, 2 ]
		].forEach(function(item) {
			o = s.option(form.Value, item[0], item[1]);
			o.datatype = 'range(%d,%d)'.format(item[2], item[3]); o.default = '' + item[4]; o.rmempty = false;
		});
		o = s.option(form.DummyValue, '_failsafe', _('Failure response'));
		o.default = _('Request full PWM (255). CPU passive, hot and critical protection remains enabled.');
		m.handleSaveApply = function(ev, mode) {
			return form.Map.prototype.handleSaveApply.apply(this, [ ev, mode ]).then(function() {
				ui.addNotification(null, E('p', _('Fan policy applied.')));
			}, function(err) {
				ui.addNotification(null, E('p', _('Could not apply fan policy: %s').format(err.message)), 'danger');
			});
		};
		return m;
	},

	drawCurve: function() {
		var canvas = document.getElementById('pwmfan-curve');
		if (!canvas) return;
		var mode = uci.get(CONFIG, SECTION, 'mode') || 'balanced';
		var key = 'curve_' + ([ 'quiet', 'balanced', 'performance', 'custom' ].indexOf(mode) < 0 ? 'balanced' : mode);
		var points = (uci.get(CONFIG, SECTION, key) || '').split(',').map(function(pair) {
			var p = pair.split(':'); return { t: parseInt(p[0], 10), v: parseInt(p[1], 10) };
		}).filter(function(p) { return !isNaN(p.t) && !isNaN(p.v); });
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
		var y = function(v) { return t + (255 - Math.max(0, Math.min(255, v))) * ph / 255; };
		ctx.strokeStyle = 'rgba(127,127,127,.22)'; ctx.lineWidth = 1;
		for (var i=0; i<=4; i++) { var yy=t+ph*i/4; ctx.beginPath(); ctx.moveTo(l,yy); ctx.lineTo(w-r,yy); ctx.stroke(); }
		ctx.beginPath(); points.forEach(function(p,i) { if(i) ctx.lineTo(x(p.t),y(p.v)); else ctx.moveTo(x(p.t),y(p.v)); });
		ctx.strokeStyle=accent; ctx.lineWidth=3; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();
		points.forEach(function(p) { ctx.beginPath(); ctx.arc(x(p.t),y(p.v),4,0,Math.PI*2); ctx.fillStyle=accent; ctx.fill(); });
		ctx.fillStyle=muted; ctx.font='11px sans-serif'; ctx.fillText('255',8,t+4); ctx.fillText('0',20,t+ph-5);
		ctx.fillText(_('Temperature (°C)'),w-r-105,h-8);
		var current=parseInt(this.data.temperature_mc,10)/1000;
		if(!isNaN(current)){ctx.beginPath();ctx.moveTo(x(current),t);ctx.lineTo(x(current),t+ph);ctx.setLineDash([4,4]);ctx.strokeStyle='#55a8ff';ctx.stroke();ctx.setLineDash([]);}
	},

	update: function(data) {
		this.data = data;
		var state = document.getElementById('pwmfan-state');
		if (state) {
			state.textContent = data.state ? _('%s · %s').format(data.state, (data.reason || '').replace(/_/g, ' ')) : _('Status unavailable');
			state.classList.toggle('fault', data.state === 'fault' || data.state === 'failsafe');
		}
		var metrics = document.querySelectorAll('.pwmfan-metric');
		metrics.forEach(function(node) {
			var title=node.querySelector('span').textContent, value=node.querySelector('strong'), hint=node.querySelector('small');
			if(title===_('Control temperature')){value.textContent=data.temperature_mc&&data.temperature_mc!=='--'?_('%.1f °C').format(parseInt(data.temperature_mc,10)/1000):_('Unavailable');hint.textContent=data.control_source||_('No source');}
			else if(title===_('Safety maximum')){value.textContent=data.safety_temperature_mc&&data.safety_temperature_mc!=='--'?_('%.1f °C').format(parseInt(data.safety_temperature_mc,10)/1000):_('Unavailable');hint.textContent=data.safety_source||_('Monitoring every source');}
			else if(title===_('Requested PWM')){value.textContent=(data.requested_pwm||'--')+' / 255';hint.textContent=_('Controller target');}
			else if(title===_('Effective PWM')){value.textContent=(data.effective_pwm||'--')+' / 255';hint.textContent=_('Hardware read-back');}
		});
		var grid=document.querySelector('.pwmfan-sensors');
		if(grid) grid.replaceWith(this.temperatureGrid(data));
		var enabled=(uci.get(CONFIG, SECTION, 'enabled') || '0')==='1', mode=uci.get(CONFIG, SECTION, 'mode') || 'balanced';
		document.querySelectorAll('.pwmfan-mode').forEach(function(button) {
			var active=button.dataset.mode===mode && button.dataset.enabled===(enabled?'1':'0');
			button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');
		});
		var profile=document.getElementById('pwmfan-profile');
		if(profile)profile.textContent=data.state==='disabled'?_('Off'):(MODES[mode]||_('Disabled'));
		var modeHint=document.querySelector('.pwmfan-mode-hint');
		if(modeHint)modeHint.textContent=data.state==='disabled'?_('Current mode: Off'):_('Current mode: %s').format(MODES[mode]||_('Unknown'));
		var reason=document.getElementById('pwmfan-reason');
		if(reason)reason.textContent=_('Controller reason: %s').format(data.reason||_('Waiting for status'));
		this.drawCurve();
	},

	render: function(data) {
		this.data=data;
		return this.renderForm(data).render().then(L.bind(function(formNode) {
			var root=E('div',{'class':'pwmfan-page'},[this.statusView(data),formNode]);
			window.setTimeout(L.bind(function(){this.update(data);},this),0);
			var formRoot=formNode;
			formRoot.addEventListener('change',L.bind(function(){window.setTimeout(L.bind(this.drawCurve,this),0);},this));
			poll.add(L.bind(function(){return this.fetchStatus().then(L.bind(this.update,this));},this),3);
			return root;
		},this));
	}
});
