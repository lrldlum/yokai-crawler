import { test, expect } from '@playwright/test';
import fs from 'fs';

const ART = '/opt/cursor/artifacts';
const LIVE = 'https://lrldlum.github.io/yokai-crawler/';
const CODE = /^[ACDEFHJKLMNPRTUVWXY3479]{4}$/;

function launchArgs() {
  return [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--allow-loopback-in-peer-connection',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ];
}

async function ready(page) {
  await expect.poll(async () => page.evaluate(() => !!(window.__YOKAI && window.__YOKAI.ready))).toBe(true);
}

async function pair(browser, relay, label) {
  const q = relay ? '?relay=1' : '';
  const t0 = Date.now();
  const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  for (const page of [host, guest]) {
    page.on('pageerror', (err) => console.log(label, 'PAGEERROR', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(label, 'CONSOLE', msg.text());
    });
  }
  await host.goto(LIVE + q);
  await ready(host);
  const booted = Date.now();
  await host.click('#btn-host');
  await expect.poll(async () => (await host.locator('#room-code').innerText()).trim(), { timeout: 30000 }).toMatch(CODE);
  const code = (await host.locator('#room-code').innerText()).trim();
  const roomAt = Date.now();
  await host.click('#btn-begin');
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.playing)).toBe(true);
  const guestUrl = LIVE + '?room=' + code + (relay ? '&relay=1' : '');
  await guest.goto(guestUrl);
  await ready(guest);
  await guest.click('#btn-connect');
  await expect.poll(async () => guest.evaluate(() => window.__YOKAI.playing), { timeout: 90000 }).toBe(true);
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.linked), { timeout: 20000 }).toBe(true);
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.getState().players.length), { timeout: 20000 }).toBe(2);
  await expect.poll(async () => guest.evaluate(() => window.__YOKAI.getState().players.length), { timeout: 20000 }).toBe(2);
  const linkedAt = Date.now();
  await host.waitForTimeout(800);
  await host.screenshot({ path: ART + '/screenshot_' + label + '_host_connected.png' });
  await guest.screenshot({ path: ART + '/screenshot_' + label + '_guest_connected.png' });
  const ice = {
    host: await host.evaluate(() => window.__YOKAI.ice),
    guest: await guest.evaluate(() => window.__YOKAI.ice),
  };
  console.log(label, 'TIMING', JSON.stringify({
    bootMs: booted - t0,
    roomMs: roomAt - t0,
    linkedMs: linkedAt - t0,
    code,
  }));
  console.log(label, 'ICE', JSON.stringify(ice));
  await hostCtx.close();
  await guestCtx.close();
  return ice;
}

test.describe('live site co-op', () => {
  test.setTimeout(180000);
  test.beforeAll(() => fs.mkdirSync(ART, { recursive: true }));

  test('default ICE against the live site', async ({ browser }) => {
    await pair(browser, false, 'live');
  });

  test('relay-only ICE against the live site', async ({ browser }) => {
    const ice = await pair(browser, true, 'live_relay');
    const types = []
      .concat((ice.host.selected && [ice.host.selected.local, ice.host.selected.remote]) || [])
      .concat((ice.guest.selected && [ice.guest.selected.local, ice.guest.selected.remote]) || [])
      .concat(ice.host.seen || [], ice.guest.seen || [])
      .filter(Boolean)
      .map((c) => c.type);
    expect(types).toContain('relay');
  });
});
