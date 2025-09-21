import { sql } from 'bun'

export async function getValue(key: string): Promise<string | null> {
  const result = await sql<
    { value: string }[]
  >`SELECT value FROM config WHERE key = ${key}`
  if (result.length) {
    return result[0]!.value
  }
  return null
}

export async function setValue(key: string, value: string): Promise<void> {
  await sql`INSERT INTO config ${sql({ key, value })} ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`
}

export async function deleteValue(key: string): Promise<void> {
  await sql`DELETE FROM config WHERE key = ${key}`
}

// user hints

export async function getUserHint(userId: string): Promise<boolean> {
  return !!(await getValue(`hint.${userId}`))
}

export async function setUserHint(userId: string): Promise<void> {
  await setValue(`hint.${userId}`, '1')
}

// user optouts

export async function getUserOptout(userId: string): Promise<boolean> {
  return !!(await getValue(`optout.${userId}`))
}

export async function optoutUser(userId: string): Promise<void> {
  await setValue(`optout.${userId}`, '1')
}

export async function optinUser(userId: string): Promise<void> {
  await deleteValue(`optout.${userId}`)
}
