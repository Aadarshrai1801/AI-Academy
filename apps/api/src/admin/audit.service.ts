import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AuditEvent, AuditEventDocument } from './audit-event.schema.js';

export interface AuditInput {
  actor: string;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/**
 * Writes immutable admin/security audit records. The write is part of the
 * request path on purpose: a privileged action that cannot be recorded should
 * not silently succeed (SOC 2 / ISO 27001 expectation).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@InjectModel(AuditEvent.name) private readonly events: Model<AuditEventDocument>) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.events.create({
        actor_id: input.actor,
        action: input.action,
        target: input.target,
        meta: input.meta,
        ip: input.ip,
      });
    } catch (err) {
      // Do not take the whole admin surface down on an audit write failure,
      // but make the failure loud and traceable in logs.
      this.logger.error(
        `audit write failed for ${input.action} by ${input.actor}: ${(err as Error).message}`,
      );
    }
  }

  /** Recent audit entries for the admin UI/support. */
  async recent(limit = 100) {
    const n = Math.min(Math.max(limit, 1), 500);
    return this.events.find().sort({ at: -1 }).limit(n).lean().exec();
  }
}
