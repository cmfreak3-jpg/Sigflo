import { db } from '../db/index.js';
import type { ExchangeId } from '../exchanges/types.js';

export type IntegrationRecord = {
  id: string;
  userId: string;
  exchange: ExchangeId;
  encryptedKey: string;
  encryptedSecret: string;
  encryptedPassphrase: string | null;
  status: 'connected' | 'invalid';
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function upsertIntegration(input: {
  userId: string;
  exchange: ExchangeId;
  encryptedKey: string;
  encryptedSecret: string;
  encryptedPassphrase?: string | null;
  status: 'connected' | 'invalid';
}) {
  const { rows } = await db.query<IntegrationRecord>(
    `insert into exchange_integrations
      (user_id, exchange, encrypted_key, encrypted_secret, encrypted_passphrase, status, last_validated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (user_id, exchange) do update
     set encrypted_key = excluded.encrypted_key,
         encrypted_secret = excluded.encrypted_secret,
         encrypted_passphrase = excluded.encrypted_passphrase,
         status = excluded.status,
         last_validated_at = now(),
         updated_at = now()
     returning id, user_id as "userId", exchange, encrypted_key as "encryptedKey",
       encrypted_secret as "encryptedSecret", encrypted_passphrase as "encryptedPassphrase",
       status, last_validated_at as "lastValidatedAt", created_at as "createdAt", updated_at as "updatedAt"`,
    [input.userId, input.exchange, input.encryptedKey, input.encryptedSecret, input.encryptedPassphrase ?? null, input.status],
  );
  return rows[0];
}

export async function listIntegrations(userId: string) {
  const { rows } = await db.query<IntegrationRecord>(
    `select id, user_id as "userId", exchange, encrypted_key as "encryptedKey",
      encrypted_secret as "encryptedSecret", encrypted_passphrase as "encryptedPassphrase",
      status, last_validated_at as "lastValidatedAt", created_at as "createdAt", updated_at as "updatedAt"
     from exchange_integrations where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows;
}

export async function getIntegration(userId: string, exchange: ExchangeId) {
  const { rows } = await db.query<IntegrationRecord>(
    `select id, user_id as "userId", exchange, encrypted_key as "encryptedKey",
      encrypted_secret as "encryptedSecret", encrypted_passphrase as "encryptedPassphrase",
      status, last_validated_at as "lastValidatedAt", created_at as "createdAt", updated_at as "updatedAt"
     from exchange_integrations where user_id = $1 and exchange = $2 limit 1`,
    [userId, exchange],
  );
  return rows[0] ?? null;
}

export async function deleteIntegration(userId: string, exchange: ExchangeId) {
  await db.query('delete from exchange_integrations where user_id = $1 and exchange = $2', [userId, exchange]);
}

export async function insertAuditEvent(input: {
  userId: string;
  exchange: ExchangeId;
  eventType: 'connect' | 'disconnect' | 'validate_fail';
  detail: string;
}) {
  await db.query(
    `insert into integration_audit_log (user_id, exchange, event_type, detail)
     values ($1, $2, $3, $4)`,
    [input.userId, input.exchange, input.eventType, input.detail],
  );
}
