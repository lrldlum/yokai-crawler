import { test, expect } from '@playwright/test';
import fs from 'fs';

const ART = '/opt/cursor/artifacts';
const CODE = /^[ACDEFHJKLMNPRTUVWXY3479]{4}$/;

async function ready(page) {
  await expect.poll(async () => page.evaluate(() => !!(window.__YOKAI && window.__YOKAI.ready)), {
    message: 'game boot',
  }).toBe(true);
}

test('two browsers host and join, see each other move, and fight', async ({ browser }) => {
  fs.mkdirSync(ART, { recursive: true });
  const hostCtx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/yokai-video', size: { width: 1280, height: 720 } },
  });
  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();
  for (const page of [host, guest]) {
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('CONSOLE', msg.text());
    });
  }

  await host.goto('/');
  await ready(host);
  await host.screenshot({ path: ART + '/screenshot_title.png' });
  await host.click('#btn-host');
  await expect.poll(async () => (await host.locator('#room-code').innerText()).trim(), {
    message: 'room code',
  }).toMatch(CODE);
  const code = (await host.locator('#room-code').innerText()).trim();
  await host.screenshot({ path: ART + '/screenshot_room_code.png' });
  await host.click('#btn-begin');
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.playing)).toBe(true);

  await guest.goto('/?room=' + code);
  await ready(guest);
  await expect(guest.locator('#code-input')).toHaveValue(code);
  await guest.click('#btn-connect');
  await expect.poll(async () => guest.evaluate(() => window.__YOKAI.playing), {
    message: 'guest enter',
  }).toBe(true);
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.linked), {
    message: 'host linked',
  }).toBe(true);
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.getState().players.length), {
    message: 'host sees two exorcists',
  }).toBe(2);
  await expect.poll(async () => guest.evaluate(() => window.__YOKAI.getState().players.length), {
    message: 'guest sees two exorcists',
  }).toBe(2);

  const hostBefore = await guest.evaluate(() => {
    const p = window.__YOKAI.getState().players.find((q) => q.id === 1);
    return p.x;
  });
  await host.keyboard.down('d');
  await host.waitForTimeout(450);
  await host.keyboard.up('d');
  await expect.poll(async () => guest.evaluate(() => {
    const p = window.__YOKAI.getState().players.find((q) => q.id === 1);
    return p.x;
  }), { message: 'guest sees Kaede move' }).toBeGreaterThan(hostBefore + 1);

  const guestBefore = await host.evaluate(() => {
    const p = window.__YOKAI.getState().players.find((q) => q.id === 2);
    return p.x;
  });
  await guest.keyboard.down('a');
  await guest.waitForTimeout(450);
  await guest.keyboard.up('a');
  await expect.poll(async () => host.evaluate(() => {
    const p = window.__YOKAI.getState().players.find((q) => q.id === 2);
    return p.x;
  }), { message: 'host sees Shio move' }).toBeLessThan(guestBefore - 1);

  const onScreen = await host.evaluate(() => window.__YOKAI.remoteOnScreen());
  expect(onScreen).toBe(true);

  const hpBefore = await host.evaluate(() => window.__YOKAI.getState().enemies.reduce((s, e) => s + e.hp, 0));
  expect(hpBefore).toBeGreaterThan(40);
  await host.keyboard.down('w');
  await host.keyboard.down('j');
  await guest.keyboard.down('w');
  await guest.keyboard.down('j');
  await expect.poll(async () => host.evaluate(() => window.__YOKAI.getState().enemies.reduce((s, e) => s + (e.dead ? 0 : e.hp), 0)), {
    message: 'host sees yokai lose vitality',
    timeout: 12000,
  }).toBeLessThan(hpBefore - 8);
  await expect.poll(async () => guest.evaluate(() => window.__YOKAI.getState().enemies.reduce((s, e) => s + (e.dead ? 0 : e.hp), 0)), {
    message: 'guest sees the same fight',
    timeout: 8000,
  }).toBeLessThan(hpBefore - 8);

  await host.waitForTimeout(600);
  await host.screenshot({ path: ART + '/screenshot_coop_combat_host.png' });
  await guest.screenshot({ path: ART + '/screenshot_coop_combat_guest.png' });

  await host.keyboard.up('w');
  await host.keyboard.up('j');
  await guest.keyboard.up('w');
  await guest.keyboard.up('j');

  await hostCtx.close();
  await guestCtx.close();
});
