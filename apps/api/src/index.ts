import { createApp } from './app';

const port = Number(process.env.PORT ?? 8000);
const host = process.env.HOST ?? '0.0.0.0';

const { app } = createApp();

console.log(`Event Taxonomy Tracker API listening on http://${host}:${port}`);

Bun.serve({
  port,
  hostname: host,
  idleTimeout: 120,
  fetch: app.fetch,
});
