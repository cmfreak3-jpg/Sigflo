import { db } from '../db/index.js';

export async function upsertUser(userId: string, email: string): Promise<void> {
  await db.query(
    `insert into users (id, email) values ($1, $2)
     on conflict (id) do update set email = excluded.email`,
    [userId, email],
  );
}
