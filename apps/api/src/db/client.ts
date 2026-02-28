import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema.js'

const dataDir = path.resolve(process.cwd(), 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbFilePath = path.join(dataDir, 'tracking-plan.db')
const sqlite = new Database(dbFilePath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite, dbFilePath }
