import { BadRequestException, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Public } from '../common/public.decorator.js';
import { Role } from '../common/entitlements.service.js';
import { LeaderboardService, percentile } from './leaderboard.service.js';

const dayOrToday = (d?: string) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly board: LeaderboardService) {}

  /** Public: guests see top 10 only (spec §1 conversion funnel). */
  @Get('daily')
  @Public()
  daily(@Query('date') date?: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 10, 1), 10);
    return this.board.topWithNames(dayOrToday(date), n).then((entries) => ({ entries }));
  }

  /** Authed: full top-100 + own rank (Pro topic filters/history land in Phase 7). */
  @Get('top')
  top(@Query('date') date?: string, @Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number(limit) || 50, 1), 100);
    return this.board.topWithNames(dayOrToday(date), n).then((entries) => ({ entries }));
  }

  @Get('me')
  me(@Req() req: { auth: { userId: string; role: Role } }, @Query('date') date?: string) {
    return this.board.rankOf(req.auth.userId, dayOrToday(date));
  }

  /**
   * Daily hardest-questions board (public, like `daily`): the 10 toughest
   * problems attempted since `since` (default today), ranked hard → medium →
   * easy then volume. Returns rank metadata + truncated prompts only — never
   * answers or explanations — so the quota'd practice loop stays the only way
   * to solve. Attempting a listed question deep-links to `/practice?q=<id>`,
   * which is auth- and quota-guarded like `/questions/next`.
   */
  @Get('top-questions')
  @Public()
  topQuestions(@Query('since') since?: string, @Query('limit') limit?: string) {
    const from = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : dayOrToday();
    const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.board.hardestQuestions(from, n).then((questions) => ({ questions }));
  }

  /**
   * Rank history (spec §2.2 Pro trends). Free sees only their own trail;
   * Pro also gets the daily top-5 for context.
   */
  @Get('history')
  async history(@Req() req: { auth: { userId: string; role: Role } }, @Query('days') days?: string) {
    const mine = await this.board.userHistory(req.auth.userId, Number(days) || 30);
    if (req.auth.role !== 'free') {
      const withTop = await Promise.all(
        mine.map(async (p) => ({
          ...p,
          percentile: percentile(p.rank, p.of),
          top: (await this.board.dayBoard(p.day, null, 5)).entries,
        })),
      );
      return { mine: withTop, role: req.auth.role };
    }
    return { mine: mine.map((p) => ({ ...p, percentile: percentile(p.rank, p.of) })), role: req.auth.role };
  }

  /** Persisted board for a past date (Pro; free sees own entry only). */
  @Get('day/:date')
  async day(
    @Req() req: { auth: { userId: string; role: Role } },
    @Param('date') date: string,
    @Query('limit') limit?: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date must be YYYY-MM-DD');
    const full = await this.board.dayBoard(date, req.auth.userId, Number(limit) || 50);
    if (req.auth.role === 'free') return { day: full.day, entries: [], mine: full.mine, snapshot: full.snapshot };
    return full;
  }
}
