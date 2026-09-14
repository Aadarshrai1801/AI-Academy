import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Enterprise pagination query: bounded limit + offset.
 * Existing list endpoints use ad-hoc `limit` clamping; new endpoints should
 * accept this DTO and return `{ data, page: { limit, offset, hasNext } }`.
 */
export class PaginationQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export interface Page<T> {
  data: T[];
  page: { limit: number; offset: number; hasNext: boolean };
}

export function toPage<T>(rows: T[], limit: number, offset: number): Page<T> {
  const hasNext = rows.length > limit;
  return { data: hasNext ? rows.slice(0, limit) : rows, page: { limit, offset, hasNext } };
}
