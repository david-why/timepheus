import { INIT_DATABASE } from './src/database'

async function initDatabase() {
  console.log('Initializing database...')
  await INIT_DATABASE
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
