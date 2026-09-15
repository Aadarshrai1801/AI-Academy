import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/**
 * Append-only security/administrative audit trail. Every privileged mutation
 * (role change, review decision, generation control, snapshot backfill) is
 * recorded with who/when/what/from-where. No update or delete endpoints exist.
 *
 * Retention (AUDIT_RETENTION_DAYS): positive number of days after which rows
 * expire via a Mongo TTL index on `at` — required by data-minimization audits
 * (see docs/COMPLIANCE.md §5). Unset/0 keeps append-only (default).
 */

export type AuditEventDocument = HydratedDocument<AuditEvent>;

@Schema({ timestamps: { createdAt: 'at', updatedAt: false } })
export class AuditEvent {
  @Prop({ required: true, index: true })
  actor_id!: string;

  /** Dotted action name, e.g. `admin.user.role_changed`. */
  @Prop({ required: true, index: true })
  action!: string;

  /** Subject of the action (user id, question id, date key...). */
  @Prop()
  target?: string;

  @Prop({ type: Object, default: undefined })
  meta?: Record<string, unknown>;

  @Prop()
  ip?: string;

  at?: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ at: -1 });
