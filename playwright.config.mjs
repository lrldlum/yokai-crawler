import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  timeout: 120000,
  expect: { timeout: 25000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 720 },
    headless: true,
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-loopback-in-peer-connection',
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--autoplay-policy=no-user-gesture-required',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=swiftshader',
      ],
    },
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    port: 4173,
    reuseExistingServer: true,
    cwd: '.',
  },
});
