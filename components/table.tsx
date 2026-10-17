/* eslint-disable react-hooks/purity */
import {timeAgo} from '~/util'
import Image from 'next/image'
import RefreshButton from './refresh-button'
import {db} from '~/db'
import {usersTable} from '~/db/schema/users'

export default async function Table() {
  const startTime = performance.now()
  const users = await db.select().from(usersTable)
  const duration = (performance.now() - startTime).toFixed()

  return (
    <div className="border-hairline bg-paper-raised mx-auto w-full max-w-xl rounded-lg border p-4 sm:p-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Recent Users</h2>
          <p className="text-ink-muted text-sm">
            Fetched {users.length} users in {duration}ms
          </p>
        </div>
        <RefreshButton />
      </div>
      <div className="divide-hairline divide-y">
        {users.map((user) => (
          <div
            key={user.name}
            className="flex items-center justify-between py-3"
          >
            <div className="flex items-center space-x-4">
              {user.image && (
                <Image
                  src={user.image}
                  alt={user.name}
                  width={48}
                  height={48}
                  className="border-hairline rounded-full border"
                />
              )}

              <div className="space-y-1">
                <p className="leading-none font-medium">{user.name}</p>
                <p className="text-ink-muted text-sm">{user.email}</p>
              </div>
            </div>
            <p className="text-ink-muted text-sm">{timeAgo(user.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
