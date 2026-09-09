import { AccessToken, TrackSource } from 'livekit-server-sdk';
import {
  FREE_CALL_MINUTES,
  canStartGroupCall,
  capMinutesFor,
  minutesForDuration,
  publishSourcesFor,
} from './policy.js';

describe('call policy', () => {
  it('caps free calls at 15 min (or remaining quota)', () => {
    expect(capMinutesFor('free', 30)).toBe(FREE_CALL_MINUTES);
    expect(capMinutesFor('free', 5)).toBe(5);
    expect(capMinutesFor('pro', 0)).toBeGreaterThan(FREE_CALL_MINUTES);
  });

  it('restricts group calls + screen share to paid tiers', () => {
    expect(canStartGroupCall('free')).toBe(false);
    expect(canStartGroupCall('pro')).toBe(true);
    expect(publishSourcesFor('free')).not.toContain(TrackSource.SCREEN_SHARE);
    expect(publishSourcesFor('pro')).toContain(TrackSource.SCREEN_SHARE);
  });

  it('bills whole minutes, minimum 1', () => {
    expect(minutesForDuration(0)).toBe(1);
    expect(minutesForDuration(61)).toBe(2);
  });

  it('mints room-scoped tokens offline (no SFU needed for signing)', async () => {
    const t = new AccessToken('key', 'secret', { identity: 'u1', ttl: '15m' });
    t.addGrant({ roomJoin: true, room: 'call_abc', canPublish: true, canSubscribe: true });
    const jwt = await t.toJwt();
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    expect(payload.sub).toBe('u1');
    expect(payload.video.room).toBe('call_abc');
  });
});
