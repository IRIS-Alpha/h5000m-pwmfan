import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/*
 * Preview regression test for the two LuCI views.
 *
 * Start the preview first:
 *   python3 tools/preview.py --port 8028 <rootfs>
 * Then run this file where Playwright resolves, e.g.
 *   NODE_PATH=/path/to/node_modules node tests/preview.mjs
 * Env: PWMFAN_PREVIEW_URL — the dashboard page itself (the advanced page is
 *      derived from it), and PWMFAN_PREVIEW_OUTPUT — screenshot directory.
 */

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.PWMFAN_PREVIEW_URL
	|| 'http://127.0.0.1:8028/cgi-bin/luci/admin/system/h5000m_pwmfan/dashboard';
const out = process.env.PWMFAN_PREVIEW_OUTPUT;
if (out) await mkdir(out, { recursive: true });

const dashboard = base;
const advanced = new URL('/cgi-bin/luci/admin/system/h5000m_pwmfan/advanced', base).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
	if (message.type() !== 'error') return;
	const text = message.text();
	if (/Failed to load resource/.test(text)) return; // reported below with its URL
	errors.push(text);
});
const previewOnlyMisses = /favicon|\/cgi-bin\/cgi-exec|\/uci\/apply_rollback/;
page.on('response', (response) => {
	if (response.status() >= 400 && !previewOnlyMisses.test(response.url()))
		errors.push('HTTP ' + response.status() + ' ' + response.url());
});

const problems = [];
function check(name, condition, detail) {
	if (!condition) problems.push(name + (detail === undefined ? '' : ' — ' + detail));
}

/* Both charts start expanded, and a fold is remembered only while it lasts:
   reopening a card must survive the next visit. */
await page.goto(dashboard, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('h5000m-pwmfan-details'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const foldState = () => page.evaluate(() => {
	const cards = {};
	document.querySelectorAll('details[data-detail]').forEach((node) => { cards[node.dataset.detail] = node.open; });
	cards.stored = localStorage.getItem('h5000m-pwmfan-details');
	return cards;
});
const fresh = await foldState();
if (fresh.curve !== true || fresh.history !== true) check('both charts do not start expanded: ' + JSON.stringify(fresh));
await page.click('details[data-detail=curve] > summary');
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const folded = await foldState();
if (folded.curve !== false) check('a folded chart does not stay folded: ' + JSON.stringify(folded));
await page.click('details[data-detail=curve] > summary');
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const reopened = await foldState();
if (reopened.curve !== true) check('a reopened chart does not stay open: ' + JSON.stringify(reopened));
await page.evaluate(() => localStorage.removeItem('h5000m-pwmfan-details'));

async function boot() {
	await page.goto(dashboard, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.pf-page');
	await page.waitForFunction(() => Number(document.querySelector('.pf-history canvas')?.dataset.samples) > 100);
}

const legendBox = () => page.evaluate(() => {
	const items = [ ...document.querySelectorAll('.pf-curve-chart .pf-legend span[data-key]') ];
	return items.map((item) => {
		const value = item.querySelector('.pf-legend-value');
		const box = item.getBoundingClientRect();
		return {
			key: item.dataset.key,
			text: value.textContent,
			width: Math.round(box.width * 10) / 10,
			right: Math.round(box.right),
			valueRight: Math.round(value.getBoundingClientRect().right),
		};
	});
});

async function dashboardChecks() {
	await boot();

	const modes = await page.locator('.pf-mode').count();
	check('five drive modes', modes === 5, String(modes));
	const canvases = await page.locator('canvas[role=img][aria-label]').count();
	check('two labelled canvases', canvases === 2, String(canvases));

	const legends = await page.locator('.pf-legend').evaluateAll((nodes) => nodes.map((node) =>
		[ ...node.querySelectorAll('span[data-key]') ].map((item) => item.dataset.key)));
	check('curve legend order', legends[0]?.join(',') === 'request,temperature,actual,protection', legends[0]?.join(','));
	check('monitor legend count', legends[1]?.length === 4, legends[1]?.join(','));

	const curve = await legendBox();
	check('curve legend rows', curve.length === 4, String(curve.length));
	for (const item of curve) {
		check('value flush right ' + item.key, Math.abs(item.valueRight - item.right) <= 1, item.valueRight + ' vs ' + item.right);
		check('value text ' + item.key, /^\d+(\.\d+)?[\s\u00a0]+%$|^\d+(\.\d+)?\s*°C$/.test(item.text.trim()), JSON.stringify(item.text));
	}
	check('legend columns equal', new Set(curve.map((item) => item.width)).size === 1, curve.map((item) => item.width).join('/'));
	check('legend items are painted', curve.every((item) => item.width > 20), curve.map((item) => item.width).join('/'));

	check('floor chip starts hidden', await page.locator('.pf-status.pf-floor').isHidden());
	check('stale chip starts hidden', await page.locator('.pf-warn-stale').isHidden());
	check('live badge has text', (await page.locator('.pf-live').textContent()).trim().length > 0);

	const fixed = page.locator('.pf-method').first();
	await fixed.locator('.pf-method-title').click();
	await page.waitForFunction(() => document.querySelector('.pf-method').dataset.selected === 'true');
	const slider = fixed.locator('input[type=range]');
	check('fixed slider present', await slider.count() === 1);
	const before = Number(await slider.inputValue());
	await slider.fill(String(before >= 50 ? 40 : 60));
	await slider.dispatchEvent('change');
	await page.waitForFunction(() => document.querySelector('.pf-savebar')?.hidden === false);
	const saveText = (await page.locator('.pf-savebar-label').textContent()).trim();
	check('save bar counts down', /秒|\bs\b/.test(saveText), saveText);
	await page.locator('.pf-savebar-apply').click();
	await page.waitForFunction(() => document.querySelector('.pf-savebar')?.hidden === true);

	const themeButton = page.locator('.pf-theme');
	for (let step = 0; step < 3; step += 1) {
		await themeButton.click();
		await page.waitForTimeout(120);
		const mode = await page.evaluate(() => document.documentElement.getAttribute('data-darkmode'));
		check('theme switch step ' + step, mode === 'true' || mode === 'false', String(mode));
	}

	await page.unroute('**/ubus/**');
}

async function statusChecks() {
	const statusPage = await browser.newPage({ viewport: { width: 900, height: 900 } });
	statusPage.setDefaultTimeout(8000);
	const statusErrors = [];
	statusPage.on('pageerror', (error) => statusErrors.push(error.message));
	statusPage.on('response', (response) => {
		if (response.status() >= 400 && !previewOnlyMisses.test(response.url()))
			statusErrors.push('HTTP ' + response.status() + ' ' + response.url());
	});

	async function open(rewrite) {
		await statusPage.route('**/ubus/**', async (route) => {
			const response = await route.fetch();
			const payload = await response.json();
			const request = route.request().postDataJSON();
			const calls = Array.isArray(request) ? request : [ request ];
			for (const message of Array.isArray(payload) ? payload : [ payload ]) {
				const call = calls.find((item) => item.id === message.id);
				const target = call?.params?.[3];
				if (target && target.command === '/usr/sbin/h5000m-pwmfan-status' && !target.params && message.result?.[1]?.stdout)
					message.result[1].stdout = rewrite(message.result[1].stdout);
			}
			await route.fulfill({ response, json: payload });
		});
		await statusPage.goto(dashboard, { waitUntil: 'domcontentloaded' });
		await statusPage.waitForSelector('.pf-page');
	}

	await open((text) => text.replace(/^state=running$/m, 'state=disabled').replace(/^owner=userspace$/m, 'owner=none'));
	const disabledLabel = await statusPage
		.waitForFunction(() => {
			const text = (document.querySelector('.pf-live')?.textContent || '').trim();
			return /未接管|Not in control/.test(text) ? text : false;
		}, null, { timeout: 8000 })
		.then((handle) => handle.jsonValue())
		.catch(async () => (await statusPage.locator('.pf-live').textContent()).trim());
	check('disabled status reads not in control', /未接管|Not in control/.test(disabledLabel), disabledLabel);
	await statusPage.unroute('**/ubus/**');

	await open((text) => text.replace(/\n*$/, '\n') + 'stale_temperature=1\n');
	await statusPage
		.waitForFunction(() => document.querySelector('.pf-warn-stale')?.hidden === false, null, { timeout: 8000 })
		.catch(() => {});
	check('stale chip follows the status', await statusPage.locator('.pf-warn-stale').isVisible());
	check('status page has no console errors', statusErrors.length === 0, statusErrors.join(' | '));
	await statusPage.close();
}

async function responsiveChecks() {
	const widths = [ 320, 360, 390, 430, 651, 736, 880, 992, 1200, 1360 ];
	const themes = [ 'light', 'dark', 'auto' ];
	await boot();
	await page.evaluate(() => document.querySelector('.pf-mode[data-mode=balanced]')?.click());

	for (const width of widths) {
		await page.setViewportSize({ width, height: 900 });
		for (const theme of themes) {
			await page.evaluate((wanted) => {
				const button = document.querySelector('.pf-theme');
				for (let step = 0; step < 4; step += 1) {
					const label = button.getAttribute('aria-label') || '';
					const current = /Light|浅色|亮色/.test(label) ? 'light' : /Dark|深色|暗色/.test(label) ? 'dark' : 'auto';
					if (current === wanted) return;
					button.click();
				}
			}, theme);
			await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
			await page.waitForTimeout(80);

			const layout = await page.evaluate(() => {
				const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect() || null;
				const card = rect('.pf-card');
				const chips = [ ...document.querySelectorAll('.pf-warn:not([hidden]), .pf-status:not([hidden])') ]
					.map((node) => node.getBoundingClientRect());
				const items = [ ...document.querySelectorAll('.pf-legend span[data-key]') ]
					.map((node) => node.getBoundingClientRect());
				return {
					overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
					chipsOutside: chips.filter((box) => card && (box.right > card.right + 1 || box.left < card.left - 1)).length,
					chipsOverlap: chips.some((a, i) => chips.some((b, j) => i < j &&
						a.right > b.left + 1 && b.right > a.left + 1 && a.bottom > b.top + 1 && b.bottom > a.top + 1)),
					columnRights: [ ...new Set(items.map((box) => Math.round(box.right))) ],
					headHeight: Math.round(rect('.pf-dispatch-head')?.height || 0),
				};
			});

			const tag = width + '/' + theme;
			check('no horizontal overflow ' + tag, layout.overflow <= 0, String(layout.overflow));
			check('chips inside the card ' + tag, layout.chipsOutside === 0, String(layout.chipsOutside));
			check('chips never overlap ' + tag, layout.chipsOverlap === false);
			check('legend keeps two columns ' + tag, layout.columnRights.length <= 2, layout.columnRights.join('/'));
			check('dispatch head has height ' + tag, layout.headHeight >= 20, String(layout.headHeight));
			if (out && width === 390 && theme === 'dark')
				await page.screenshot({ path: join(out, 'dashboard-390-dark.png'), fullPage: true });
		}
	}
	await page.emulateMedia({ colorScheme: 'light' });
}

async function advancedChecks() {
	await page.setViewportSize({ width: 1200, height: 1000 });
	await page.goto(advanced, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.pwmfan-advanced');

	const groups = await page.locator('.pwmfan-advanced .pf-group').count();
	check('eight behaviour cards', groups === 8, String(groups));
	// Two switches now: taking over the fan, and rebooting before the trip.
	const toggles = await page.evaluate(() => [ ...document.querySelectorAll('.pf-toggle input[type=checkbox]') ]
		.map((input) => input.closest('.cbi-value')?.dataset.name));
	check('both switches are toggles', toggles.length === 2 && toggles.includes('enabled') && toggles.includes('early_reboot'), toggles.join(','));
	// The reboot point is derived from the threshold, and the hint says so.
	const earlyHint = await page.evaluate(() => {
		const row = document.querySelector('[data-name=early_reboot]');
		const note = row && row.querySelector('.cbi-value-description');
		return note ? note.textContent.trim() : '';
	});
	check('early reboot hint names the derived point', /105 °C/.test(earlyHint) && /20 °C/.test(earlyHint), earlyHint);
	const hosts = await page.locator('.pf-unit-host').count();
	check('unit hosts', hosts >= 10, String(hosts));
	const folded = await page.evaluate(() => [ ...document.querySelectorAll('.cbi-value-description') ]
		.filter((node) => node.getBoundingClientRect().height < 1).length);
	check('no description collapsed', folded === 0, String(folded));

	const sensorTexts = await page.evaluate(() => {
		const row = document.querySelector('[id$=sensor_sources]');
		if (!row) return [];
		const options = [ ...row.querySelectorAll('.cbi-dropdown > ul > li') ]
			.filter((node) => !node.hasAttribute('placeholder') && !node.hasAttribute('unselectable'));
		if (options.length) return options.map((node) => node.textContent.trim());
		return [ ...row.querySelectorAll('select > option') ].map((node) => node.textContent.trim());
	});
	check('sensor options carry readings', sensorTexts.some((text) => /°C/.test(text) || /读数|reading/i.test(text)), sensorTexts.join(' | '));

	const field = () => page.locator('input[id$=protection_temp]');
	const previous = await field().inputValue();
	const wanted = previous === '90' ? '91' : '90';
	await field().fill(wanted);
	await page.locator('.cbi-button-apply').first().click();
	await page.waitForFunction(async (value) => (await L.require('uci')).get('h5000m_pwmfan', 'main', 'protection_temp') === value, wanted);
	// The preview applies through its own queue; give it a moment to land before
	// the reload, or the reload can outrun the write.
	await page.waitForTimeout(800);
	await page.reload({ waitUntil: 'domcontentloaded' });
	await field().waitFor();
	// The form is filled from the saved config after it renders, so poll instead of
	// sampling once: a single read races the render on a slow first paint.
	const restored = await page.waitForFunction((value) => {
		const input = document.querySelector('input[id$=protection_temp]');
		return !!input && input.value === value;
	}, wanted, { timeout: 4000 }).then(() => true, () => false);
	check('form keeps the saved value', restored);
	await field().fill(previous);
	await page.locator('.cbi-button-apply').first().click();
	await page.waitForTimeout(600);
	if (out) await page.screenshot({ path: join(out, 'advanced-1200.png'), fullPage: true });
}

/*
 * A high-DPR phone is the common case for this page. Repainting without resetting
 * the size must not scale the drawing again: a stale transform pushes the chart
 * off the bitmap and the card ends up empty.
 */
async function highDensityChecks() {
	const phone = await browser.newPage({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 3 });
	phone.setDefaultTimeout(8000);
	try {
		await phone.goto(dashboard, { waitUntil: 'domcontentloaded' });
		await phone.waitForFunction(() => Number(document.querySelector('.pf-history canvas')?.dataset.samples) > 100);
		await phone.waitForTimeout(3000);
		const painted = await phone.evaluate(() => {
			const count = (canvas) => {
				const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
				let total = 0;
				for (let i = 3; i < data.length; i += 4) if (data[i] > 8) total++;
				return total;
			};
			const cards = [ ...document.querySelectorAll('details.pf-card') ].filter((card) => card.open);
			return cards.map((card) => [ card.dataset.detail, count(card.querySelector('canvas')) ]);
		});
		check('high-DPR charts keep their pixels after repaint', painted.every(([ , ink ]) => ink > 1000), JSON.stringify(painted));
	}
	finally {
		await phone.close();
	}
}

try {
	await dashboardChecks();
	await statusChecks();
	await responsiveChecks();
	await advancedChecks();
	await highDensityChecks();
	check('no console errors', errors.length === 0, errors.join(' | '));
	if (problems.length) {
		console.error(problems.length + ' problem(s):');
		for (const problem of problems) console.error(' - ' + problem);
		process.exitCode = 1;
	} else {
		console.log('preview checks passed');
	}
} finally {
	await browser.close();
}
