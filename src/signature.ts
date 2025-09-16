const { SLACK_SIGNING_SECRET } = process.env

function sign(basestring: string) {
  const digest = new Bun.CryptoHasher("sha256", SLACK_SIGNING_SECRET)
    .update(basestring)
    .digest("hex")
  return `v0=${digest}`
}

export async function getVerifiedData(
  req: Request,
): Promise<
  { success: false; data?: never } | { success: true; data: string }
> {
  const body = await req.clone().text()
  const signature = req.headers.get("x-slack-signature")
  if (!signature) return { success: false }
  const tsString = req.headers.get("X-Slack-Request-Timestamp")
  if (!tsString) return { success: false }
  const timestamp = Number(tsString)
  if (isNaN(timestamp)) return { success: false }
  if (Date.now() - timestamp * 1000 > 1000 * 60 * 5) return { success: false }
  const basestring = `v0:${timestamp}:${body}`
  const correctSignature = sign(basestring)
  if (signature !== correctSignature) return { success: false }
  return { success: true, data: body }
}
