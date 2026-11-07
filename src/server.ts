import express from 'express';
import { runCase } from './agent';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * The whole API. One packet in, one result out. No persistence, no auth here -
 * this service is expected to sit behind Athos infrastructure.
 */
app.post('/v0/case', async (req, res) => {
  const started = Date.now();
  try {
    const result = await runCase(req.body);
    res.setHeader('x-elapsed-ms', String(Date.now() - started));
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(400).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
if (require.main === module) {
  app.listen(port, () => {
    console.log(`needs-review-agent listening on :${port}`);
  });
}

export { app };
