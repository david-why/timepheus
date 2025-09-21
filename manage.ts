import { sql } from "bun"

async function initDatabase() {
  console.log('Initializing database...')
  await sql.file('sql/init.sql')
  console.log('Database cleared and initialized!')
}

const commands: Record<string, (args: string[]) => Promise<unknown>> = {
  init: initDatabase,
}

async function main(argv: string[]) {
  if (argv.length === 0) {
    console.error('usage: bun manage.ts <command> [arguments...]')
    process.exit(1)
  }
  const command = argv[0]!
  const func = commands[command]
  if (!func) {
    console.error(`error: unknown command: ${command}`)
    process.exit(1)
  }
  await func(argv.slice(1))
}

if (require.main === module) {
  main(process.argv.slice(2))
}
