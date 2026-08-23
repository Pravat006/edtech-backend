import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres",
    },
    migrations: {
        seed: 'npx tsx prisma/seed.ts',
    },
})
