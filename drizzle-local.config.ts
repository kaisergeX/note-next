import {defineConfig} from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/*.ts',
  out: './drizzle/local',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING ?? '',
  },
})
