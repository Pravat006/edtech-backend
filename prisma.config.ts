import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
    schema: 'prisma/schema.prisma',
    datasource: {
        url: process.env.NODE_ENV === 'development' 
            ? process.env.DEV_DATABASE_URL! 
            : process.env.DATABASE_URL!,
    },
    migrations: {
        seed: 'npx tsx prisma/seed.ts',
    },
})
