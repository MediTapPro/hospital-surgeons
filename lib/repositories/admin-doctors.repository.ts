import { getDb } from '@/lib/db';
import { doctors } from '@/src/db/drizzle/migrations/schema';
import { asc } from 'drizzle-orm';

export class AdminDoctorsRepository {
  constructor(private readonly db: any = getDb()) {}
  async list() {
    return this.db.select({ id: doctors.id, firstName: doctors.firstName, lastName: doctors.lastName }).from(doctors).orderBy(asc(doctors.firstName), asc(doctors.lastName));
  }
}
