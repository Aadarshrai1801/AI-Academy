import { SetMetadata } from '@nestjs/common';

export const SKIP_THROTTLE_KEY = 'skip_throttle';
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
