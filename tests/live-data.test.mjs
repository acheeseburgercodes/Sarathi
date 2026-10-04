import test from 'node:test';
import assert from 'node:assert/strict';
import { getLiveSituation, getLiveDashboard } from '../lib/live-data.ts';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
test('all failed providers produce unavailable values, never substitute readings', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  const data = await getLiveDashboard();
  assert.equal(data.status, 'unavailable');
  assert.equal(data.weather, null);
  assert.equal(data.risk, null);
  assert.ok(data.agents.every(agent => agent.value === null && agent.status === 'UNAVAILABLE'));
});
test('successful empty hazard feeds remain available when weather fails', async () => {
  globalThis.fetch = async url => {
    if (String(url).includes('open-meteo')) throw new Error('offline');
    return Response.json(String(url).includes('eonet') ? { events: [] } : { features: [] });
  };
  const data = await getLiveSituation();
  assert.equal(data.status, 'available');
  assert.equal(data.risk, null);
  assert.equal(data.sources[0].status, 'unavailable');
  assert.equal(data.sources[1].status, 'live');
  assert.equal(data.sources[2].status, 'live');
});
test('malformed successful responses do not claim live sources', async () => {
  globalThis.fetch = async () => Response.json({ error: 'bad data' });
  const data = await getLiveSituation();
  assert.equal(data.status, 'unavailable');
  assert.ok(data.sources.every(source => source.status === 'unavailable'));
});
test('hourly precipitation windows use UTC and retain correct 24-hour totals', async () => {
  const hour = Math.floor(Date.now() / 3600000) * 3600000;
  const times = Array.from({ length: 60 }, (_, i) => new Date(hour + (i - 30) * 3600000).toISOString().slice(0, 16));
  globalThis.fetch = async url => {
    if (String(url).includes('open-meteo')) {
      assert.equal(new URL(url).searchParams.get('timezone'), 'UTC');
      return Response.json({ current: { temperature_2m: 20, wind_speed_10m: 10 }, hourly: { time: times, precipitation: times.map(() => 2), precipitation_probability: times.map(() => 30) } });
    }
    return Response.json(String(url).includes('eonet') ? { events: [] } : { features: [] });
  };
  const data = await getLiveSituation();
  assert.equal(data.weather.rain24h, 48);
  assert.equal(data.weather.rainNext24h, 48);
  assert.ok(data.weather.hourly.every(hour => hour.time.endsWith('Z')));
});
