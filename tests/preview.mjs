import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.PWMFAN_PREVIEW_URL || 'http://127.0.0.1:8028/';
const out = process.env.PWMFAN_PREVIEW_OUTPUT;
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1040 } });
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
const wait = s => page.locator(s).waitFor({timeout:6500});
try {
 await page.goto(base);
 await wait('.pf-page');
 await page.waitForFunction(() => Number(document.querySelector('.pf-history canvas').dataset.samples) > 300);
 await page.locator('.pf-mode[data-mode=balanced]').click();
 await page.waitForFunction(() => document.querySelector('.pf-mode[data-mode=balanced]').getAttribute('aria-pressed') === 'true');
 await page.locator('#theme').selectOption('light');
 await page.mouse.move(0, 0);
 if (out) await page.screenshot({path:join(out, 'dashboard-light.png'),fullPage:true});
 assert.equal(await page.locator('.pf-mode').count(),6);
 assert.equal(await page.locator('canvas').count(),2);
 assert.equal(await page.locator('.pf-metric').count(),8);
 assert.equal(await page.locator('.pf-metric small, .pwmfan-fan').count(),0);
 assert.equal(await page.locator('.pf-modes button[aria-pressed=true]').count(),1);
 const curveCanvas = page.locator('.pf-card:has(.pf-parameters) canvas');
 await curveCanvas.hover();
 assert.equal(await page.locator('.pf-touch-point:not([hidden])').count(),0);
 const toolbarPair = await page.locator('.pf-toolbar > *').evaluateAll(elements => elements.map(node=>[node.offsetWidth,node.offsetHeight]));
 assert.deepEqual(toolbarPair[0], toolbarPair[1]);
 assert.equal(await page.locator('.pf-parameters').evaluate(el => el.open),false);
 await page.locator('.pf-mode[data-mode=target]').click();
 await wait('.pf-target');
 await page.locator('input[name=target_temp]').fill('80');
 await page.locator('input[name=response_range]').fill('80');
 await page.locator('.pf-target button').click();
 await page.waitForFunction(() => document.querySelector('input[name=target_temp]')?.value === '80' && document.querySelector('.pf-target .pf-note').textContent.includes('0 °C'));
 await page.waitForFunction(() => !document.querySelector('.pf-mode[data-mode=manual]').disabled);
 await page.locator('.pf-mode[data-mode=manual]').click();
 await page.waitForFunction(() => document.querySelector('.pf-mode[data-mode=manual]').getAttribute('aria-pressed') === 'true');
 await page.locator('.pf-parameters summary').click();
 assert.equal(await page.locator('.pf-point').count(),6);
 const input = page.locator('.pf-point input[type=number]').first();
 const original = await input.inputValue();
 await input.fill('50'); await input.press('Tab');
 assert.equal(await input.inputValue(),original);
 await input.fill(original === '31' ? '32' : '31'); await input.press('Tab');
 const apply = page.locator('.pf-dispatch-head button').last();
 await apply.click();
 await page.waitForFunction(() => document.querySelector('.pf-dispatch-head button')?.disabled);
 const sampleBeforeFold = Number(await page.locator('.pf-history canvas').getAttribute('data-latest-sample'));
 await page.locator('.pf-history summary').click();
 await page.waitForTimeout(4600);
 await page.locator('.pf-history summary').click();
 await page.waitForFunction(before => Number(document.querySelector('.pf-history canvas').dataset.latestSample) > before, sampleBeforeFold);
 await page.locator('canvas').first().focus(); await page.keyboard.press('ArrowRight');
 await wait('.pf-card:has(.pf-parameters) .pf-tooltip:not([hidden])');
 await page.locator('.pf-mode[data-mode=off]').click();
 await page.waitForFunction(() => document.querySelector('.pf-mode[data-mode=off]').getAttribute('aria-pressed')==='true');
 for (const width of [320,390,1360]) {
  await page.setViewportSize({width,height:900});
  for (const theme of ['light','dark','auto']) {
   await page.locator('#theme').selectOption(theme);
   if(theme==='auto') await page.emulateMedia({colorScheme:'dark'});
   await page.waitForFunction(expected => document.documentElement.dataset.darkmode === expected, String(theme!=='light'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`overflow ${width}, ${theme}`);
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#theme').selectOption('dark');
 await page.locator('.pf-mode[data-mode=target]').click();
 await wait('.pf-target');
 if (await page.locator('.pf-parameters').evaluate(element=>element.open)) await page.locator('.pf-parameters summary').click();
 if (out) await page.screenshot({path:join(out, 'dashboard-mobile-dark.png'),fullPage:true});
 await page.locator('.pf-heading a').click();
 await wait('.pwmfan-advanced');
 assert.equal(await page.locator('.pwmfan-advanced h3').count(),6);
 const threshold = page.locator('input[id$=protection_temp]');
 await threshold.fill('92');
 await page.locator('.cbi-button-apply').first().click();
 await page.waitForFunction(async () => (await L.require('uci')).get('h5000m_pwmfan','main','protection_temp') === '92');
 await page.reload();
 await page.locator('input[id$=protection_temp]').waitFor();
 assert.equal(await page.locator('input[id$=protection_temp]').inputValue(),'92');
 assert.equal(await page.locator('[id$=kernel_takeover] input, input[id$=kernel_takeover]').first().isDisabled(),true);
 await page.setViewportSize({width:1360,height:1040});
 if (out) await page.screenshot({path:join(out, 'advanced-dark.png'),fullPage:true});
 await page.goto(base);
 await wait('.pf-page');
 await page.waitForFunction(() => Number(document.querySelector('.pf-history canvas').dataset.samples) > 300);
 await page.locator('.pf-language').selectOption('en');
 await page.getByText('Temperature array',{exact:true}).waitFor();
 await page.locator('.pf-language').selectOption('zh_cn');
 await page.locator('html[lang=zh-CN] .pf-page').waitFor();
 await page.route('**/ubus/**', async route => {
  const response = await route.fetch();
  const payload = await response.json();
  const request = route.request().postDataJSON();
  const calls = Array.isArray(request) ? request : [request];
  for (const message of Array.isArray(payload) ? payload : [payload]) {
   const call = calls.find(item => item.id === message.id);
   if (call?.params?.[3]?.command === '/usr/sbin/h5000m-pwmfan-status' && !call.params[3].params?.length) {
    const report = message.result[1];
    report.stdout = report.stdout.replace(/^state=running$/m,'state=disabled').replace(/^owner=userspace$/m,'owner=none');
   }
  }
  await route.fulfill({ response, json: payload });
 });
 await page.locator('.pf-live').getByText('未接管',{exact:true}).waitFor();
 await page.unroute('**/ubus/**');
 await page.route('**/ubus/**', async route => {
  const response = await route.fetch();
  const payload = await response.json();
  const request = route.request().postDataJSON();
  const calls = Array.isArray(request) ? request : [request];
  for (const message of Array.isArray(payload) ? payload : [payload]) {
   const call = calls.find(item => item.id === message.id);
   if (call?.params?.[3]?.command === '/usr/sbin/h5000m-pwmfan-status' && !call.params[3].params?.length)
    message.result[1].stdout = message.result[1].stdout.replace(/^updated_at=\d+$/m,'updated_at=1');
  }
  await route.fulfill({ response, json: payload });
 });
 await page.locator('.pf-live').getByText('状态不可用',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('V3 interactions passed');
} finally { if(errors.length)console.log(errors); await browser.close(); }
