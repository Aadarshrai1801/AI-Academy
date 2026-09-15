import { HealthController } from './health.controller.js';

describe('HealthController /metrics', () => {
  const savedToken = process.env.METRICS_TOKEN;
  afterEach(() => {
    if (savedToken === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = savedToken;
  });

  const makeRes = () => {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        res.headers[k] = v;
      },
      status(c: number) {
        res.statusCode = c;
        return res;
      },
      json(b: unknown) {
        res.body = JSON.stringify(b);
        return res;
      },
      send(b: string) {
        res.body = b;
        return res;
      },
    };
    return res;
  };

  it('serves Prometheus exposition with process gauges when no token is set', () => {
    delete process.env.METRICS_TOKEN;
    const controller = new HealthController(undefined, null);
    const res = makeRes();
    controller.metrics({ headers: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/plain; version=0.0.4');
    expect(res.body).toContain('# TYPE process_uptime_seconds gauge');
  });

  it('rejects unauthenticated scrapes when METRICS_TOKEN is configured', () => {
    process.env.METRICS_TOKEN = 's3cret';
    const controller = new HealthController(undefined, null);

    const wrong = makeRes();
    controller.metrics({ headers: { authorization: 'Bearer nope' } } as never, wrong as never);
    expect(wrong.statusCode).toBe(403);
    expect(wrong.body).not.toContain('process_uptime_seconds');

    const right = makeRes();
    controller.metrics({ headers: { authorization: 'Bearer s3cret' } } as never, right as never);
    expect(right.statusCode).toBe(200);
    expect(right.body).toContain('process_uptime_seconds');
  });
});