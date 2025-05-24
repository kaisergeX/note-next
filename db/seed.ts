import {db} from '.'
import {notesTable, type NewNote, type Note} from './schema/notes'
import {usersTable, type NewUser, type User} from './schema/users'

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

const newNotes: NewNote[] = [
  {
    authorId: '01894f3f-f26f-0c56-1305-a91fd88623ee',
    title: 'title 1 ✏️',
  },
  {
    content:
      "🍀 <strong><i>Lorem Ipsum</i></strong> is simply dummy text <code>Hello world!</code> of <del>the printing</del> and <mark>typesetting industry</mark>. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.",
    authorId: '01894f3f-f26f-0c56-1305-a91fd88623ee',
  },
  {
    title:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a g",
    content:
      '<p class="m-0">abcdewweesssseee   123</p><blockquote><p>To start syncing your workspace, just sign in with Google in the menu.</p></blockquote>',
    authorId: '01894f3f-f26f-0c56-1305-a91fd88623ee',
  },
  {
    authorId: '01894f3f-f26f-0c56-1305-a91fd88623ee',
    title: '🤡 title 1',
    content: '<blockquote><p>Quote nhảm</p></blockquote>',
  },
]

async function handleSeedUsers() {
  const users = await db.select().from(usersTable)
  if (users.length === 0) {
    const insertedUsers: User[] = await db
      .insert(usersTable)
      .values(newUsers)
      .returning()
    console.log(`Seeded ${insertedUsers.length} users`)
    return
  }

  console.log('Seeding process skipped: users table is not empty')
}

async function seed() {
  try {
    await handleSeedUsers()

    const insertedNotes: Note[] = await db
      .insert(notesTable)
      .values(newNotes)
      .returning()
    console.log(
      `Seeded ${insertedNotes.length} notes for user ${newNotes[0].authorId}`,
    )
    process.exit(0)
  } catch (error) {
    console.error('Seed failed', error)
    process.exit(1)
  }
}

void seed()
