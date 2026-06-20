import 'dotenv/config';
import { getDb } from '@/lib/db';
import { users } from '@/src/db/drizzle/migrations/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> <password>');
  process.exit(1);
}

async function main() {
  const db = getDb();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.error('User with this email already exists');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashedPassword,
      role: 'admin',
      status: 'active',
      emailVerified: true,
    })
    .returning();

  console.log('Admin created successfully!');
  console.log(`  ID:    ${newUser.id}`);
  console.log(`  Email: ${newUser.email}`);
  console.log(`  Role:  ${newUser.role}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
