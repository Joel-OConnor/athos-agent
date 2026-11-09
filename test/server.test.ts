import type { Server } from 'node:http';
import { app } from '../src/server';
import { loadCase } from './helpers';

describe('HTTP surface', () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it('answers the health check', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('runs a case and reports how long it took', async () => {
    const res = await fetch(`${base}/v0/case`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(loadCase('001-clean-100k-seon-approve.json')),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-elapsed-ms')).toMatch(/^\d+$/);
    const body = (await res.json()) as { recommendation: string };
    expect(body.recommendation).toBe('send_emails');
  });

  it('returns 400 with the reason for a bad packet', async () => {
    const res = await fetch(`${base}/v0/case`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: 'nope' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toBe('');
  });
});
