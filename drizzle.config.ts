import type {Config} from 'drizzle-kit'

// Face error: "Transforming const to the configured target environment ("es5") is not supported yet"?
// https://github.com/drizzle-team/drizzle-orm/issues/803
export default {
  schema: './db/schema/*',
  driver: 'pg',
  out: './drizzle',
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL ?? '',
  },
} satisfies Config
