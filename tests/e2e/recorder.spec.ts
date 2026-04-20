/**
 * Recorder Popup — Smoke Test
 *
 * Mounts /recorder with a stubbed getUserMedia and stubbed Supabase
 * REST/Storage endpoints, then asserts that the IndexedDB `segments`
 * store receives at least one chunk row for the session.
 *
 * Skips when no TEST_ADMIN_EMAIL/TEST_ADMIN_PASSWORD are configured, to
 * match the project's auth-gated E2E conventions.
 */

import { test, expect } from '@playwright/test';
import { loginAsAdmin, hasCredentials } from './helpers/auth';

const MOCK_SESSION_ID = '11111111-1111-4111-8111-111111111111';
const MOCK_MEETING_ID = '22222222-2222-4222-8222-222222222222';

const INIT_SCRIPT = `
  (function () {
    // Stub getUserMedia with a silent synthetic audio stream so MediaRecorder
    // can capture chunks without any real microphone access.
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        const dest = ctx.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();
        return dest.stream;
      };
    }
  })();
`;

test.describe('Recorder popup smoke', () => {
  test('captures a chunk into IndexedDB after starting the recorder', async ({ page }) => {
    if (!hasCredentials()) {
      test.skip();
      return;
    }
    const loggedIn = await loginAsAdmin(page);
    if (!loggedIn) {
      test.skip();
      return;
    }

    await page.addInitScript(INIT_SCRIPT);

    // Stub the session-insert REST call so the test doesn't depend on a real
    // meeting row or RLS policy. Anything touching the new recorder tables is
    // intercepted; downstream storage uploads return OK.
    await page.route(/\/rest\/v1\/church_leadership_recording_sessions.*/, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ id: MOCK_SESSION_ID }]),
        });
        return;
      }
      if (method === 'PATCH') {
        await route.fulfill({ status: 204, body: '' });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: MOCK_SESSION_ID,
            meeting_id: MOCK_MEETING_ID,
            user_id: null,
            status: 'active',
            started_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
            ended_at: null,
            last_live_path: null,
            mime_type: 'audio/webm',
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route(/\/rest\/v1\/church_leadership_recording_segments.*/, async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'seg-1',
              session_id: MOCK_SESSION_ID,
              segment_index: 0,
              storage_path: `sessions/${MOCK_SESSION_ID}/segments/00000.webm`,
              started_at: new Date().toISOString(),
              ended_at: new Date().toISOString(),
              duration_seconds: 2,
              size_bytes: 1024,
              mime_type: 'audio/webm',
              created_at: new Date().toISOString(),
            },
          ]),
        });
        return;
      }
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.continue();
    });

    await page.route(/\/storage\/v1\/object\/.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"Key":"ok"}',
      });
    });

    await page.goto(`/recorder?meetingId=${MOCK_MEETING_ID}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the recorder to enter the "Grabando" state.
    await expect(page.getByRole('heading', { name: 'Grabando' })).toBeVisible({
      timeout: 15000,
    });

    // Let a few dataavailable ticks accumulate, then stop — stopSession
    // flushes the current chunks into IndexedDB.
    await page.waitForTimeout(2500);

    const stopButton = page.getByRole('button', { name: /Detener/ }).first();
    await stopButton.click();

    // Allow onstop + flushSegment + async IDB write to settle.
    await page.waitForTimeout(2000);

    const chunkCount = await page.evaluate(async (sessionId) => {
      return await new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('casa-recorder', 1);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction('segments', 'readonly');
            const store = tx.objectStore('segments');
            const idx = store.index('by_session');
            const countReq = idx.count(IDBKeyRange.only(sessionId));
            countReq.onsuccess = () => {
              db.close();
              resolve(countReq.result);
            };
            countReq.onerror = () => {
              db.close();
              reject(countReq.error);
            };
          } catch (err) {
            db.close();
            reject(err);
          }
        };
        req.onerror = () => reject(req.error);
      });
    }, MOCK_SESSION_ID);

    expect(chunkCount).toBeGreaterThan(0);
  });
});
