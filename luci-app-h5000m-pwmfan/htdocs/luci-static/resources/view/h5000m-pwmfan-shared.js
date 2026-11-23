'use strict';
'require uci';
'require fs';
'require ui';
'require rpc';

var callCommit = rpc.declare({ object: 'uci', method: 'commit', params: [ 'config' ], reject: true });

var themeKey = 'pwmfan-theme';
var themeOrder = [ 'auto', 'light', 'dark' ];

function storedTheme() {
	var value = null;
	try { value = localStorage.getItem(themeKey); } catch (error) { /* Storage is optional. */ }
	return themeOrder.indexOf(value) >= 0 ? value : null;
}

function sharedTheme() {
	var value = null;
	try { value = uci.get('vantage_theme', 'appearance', 'theme'); } catch (error) { value = null; }
	return themeOrder.indexOf(value) >= 0 ? value : null;
}

function themeGlyph(mode) {
	var shapes = {
		auto: [ [ 'M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15' ], [ 'M12 4.5a7.5 7.5 0 0 1 0 15z', true ] ],
		light: [ [ 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7' ], [ 'M12 2.6v2' ], [ 'M12 19.4v2' ],
			[ 'M2.6 12h2' ], [ 'M19.4 12h2' ], [ 'M5.4 5.4l1.4 1.4' ], [ 'M17.2 17.2l1.4 1.4' ],
			[ 'M18.6 5.4l-1.4 1.4' ], [ 'M6.8 17.2l-1.4 1.4' ] ],
		dark: [ [ 'M20 14.6A8.6 8.6 0 0 1 9.4 4a8.6 8.6 0 1 0 10.6 10.6z' ] ]
	};
	var list = shapes[mode] || shapes.auto;
	var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('focusable', 'false');
	list.forEach(function(shape) {
		var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', shape[0]);
		if (shape[1]) path.setAttribute('class', 'pf-fill');
		svg.appendChild(path);
	});
	return svg;
}

var api = L.Class.extend({

	themeGlyph: themeGlyph,

	themeMode: function() {
		return storedTheme() || sharedTheme() || 'auto';
	},

	themeLabel: function(mode) {
		return mode === 'light' ? _('Light theme') : mode === 'dark' ? _('Dark theme') : _('Automatic theme');
	},

	applyTheme: function(mode) {
		var dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.setAttribute('data-darkmode', dark ? 'true' : 'false');
		document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
	},

	setTheme: function(mode) {
		try { localStorage.setItem(themeKey, mode); } catch (error) { /* Storage is optional. */ }
		this.applyTheme(mode);
		try {
			uci.set('vantage_theme', 'appearance', 'theme', mode);
		} catch (error) {
			return null;
		}
		// The firmware's uci.js has no commit(); save() writes the delta, the RPC folds it in.
		return uci.save().then(function() { return callCommit('vantage_theme'); }).catch(function() { return null; });
	},

	switcher: function(options) {
		return E('button', { type: 'button', 'class': 'pf-switch ' + (options.className || ''),
			'aria-label': options.label, title: options.label }, options.content);
	},

	themeSwitcher: function() {
		var self = this, mode = this.themeMode();
		var host = E('span', { 'class': 'pf-switch-icon' }, [ themeGlyph(mode) ]);
		var button = this.switcher({ className: 'pf-theme', label: this.themeLabel(mode), content: [ host ] });
		button.addEventListener('click', function() {
			var next = themeOrder[(themeOrder.indexOf(self.themeMode()) + 1) % themeOrder.length];
			self.setTheme(next);
			host.replaceChildren(themeGlyph(next));
			button.setAttribute('aria-label', self.themeLabel(next));
			button.title = button.getAttribute('aria-label');
		});
		return button;
	},

	// Shared wording for the live status badge; both views must read the same snapshot fields.
	statusLabel: function(fields) {
		var data = fields || {};
		var stamp = Number(data.updated_at), age = Date.now() / 1000 - stamp;
		var fresh = isFinite(stamp) && stamp > 0 && age >= -5 && age <= 90;
		var states = {
			fault: [ _('Fault'), 'fault' ], failsafe: [ _('Fault'), 'fault' ],
			kernel_only: [ _('Kernel control'), 'idle' ],
			protection: [ _('Protection active'), 'warn' ],
			running: [ _('Running'), 'ok' ], disabled: [ _('Not in control'), 'idle' ], stopped: [ _('Not in control'), 'idle' ]
		};
		var sources = { userspace: _('Plugin control'), protection: _('Temperature protection'),
			kernel: _('Kernel control'), none: _('Not in control') };
		var state = Object.prototype.hasOwnProperty.call(states, data.state) ? states[data.state] : null;
		if (!fresh || !state || (data.state === 'running' && !/^(userspace|protection)$/.test(data.owner || '')))
			state = [ _('Status unavailable'), 'idle' ];
		else if (data.state === 'running' && (data.owner === 'protection' || /^protection_(ramp|lock)$/.test(data.reason || '')))
			state = states.protection;
		var source = fresh && Object.prototype.hasOwnProperty.call(sources, data.owner) &&
			!/^(kernel_or_driver_override|pwm_mismatch)$/.test(data.reason || '') ? sources[data.owner] : _('Unknown');
		var label = source === state[0] ? state[0] : state[0] + ' · ' + source;
		return { label: label, state: state[1], fresh: fresh, reason: data.reason || '' };
	},

	languageMode: function() {
		var lang = null;
		try { lang = uci.get('luci', 'main', 'lang'); } catch (error) { lang = null; }
		if (lang === 'zh_cn' || lang === 'en') return lang;
		return /^zh/i.test(document.documentElement.lang || '') ? 'zh_cn' : 'en';
	},

	languageSwitcher: function() {
		var self = this, mode = this.languageMode();
		var glyph = E('span', { 'class': 'pf-lang-glyph' }, mode === 'zh_cn' ? 'CN' : 'EN');
		var button = this.switcher({ className: 'pf-lang', label: mode === 'zh_cn' ? _('Switch to English') : _('Switch to Chinese'), content: [ glyph ] });
		button.addEventListener('click', function() {
			var next = self.languageMode() === 'zh_cn' ? 'en' : 'zh_cn';
			button.disabled = true;
			fs.exec('/usr/sbin/h5000m-pwmfan-language', [ next ]).then(function(result) {
				if (result.code) throw new Error(result.stderr || _('Unavailable'));
				window.location.reload();
			}).catch(function(error) {
				button.disabled = false;
				ui.addNotification(null, E('p', {}, _('Could not change language: %s').format(error.message)), 'danger');
			});
		});
		return button;
	}
});

return api;