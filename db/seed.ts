import {db} from '.'
import {UsersTable, type NewUser, type User} from './schema/users'

const newUsers: NewUser[] = [
  {
    name: 'Archivist',
    email: 'archivist@gmail.com',
    image: 'https://ui-avatars.com/api/?name=Archivist',
    role: 'archivist',
  },
  {
    name: 'Random Guy',
    email: 'randguy@gmail.com',
    image: 'https://ui-avatars.com/api/?name=Random+Guy',
  },
]

async function seed() {
  try {
    const insertedUsers: User[] = await db
      .insert(UsersTable)
      .values(newUsers)
      .returning()
    console.log(`Seeded ${insertedUsers.length} users`)
    process.exit(0)
  } catch (error) {
    console.error('Seed failed', error)
    process.exit(1)
  }
}

void seed()
