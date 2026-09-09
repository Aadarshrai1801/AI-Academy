import { SetMetadata } from '@nestjs/common';

/** Mark a route as consuming 1 unit of `feature` quota after the quota check passes. */
export const QUOTA_FEATURE_KEY = 'quota_feature';
export const RequireQuota = (feature: string) => SetMetadata(QUOTA_FEATURE_KEY, feature);
