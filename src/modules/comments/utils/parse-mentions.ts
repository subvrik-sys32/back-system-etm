const MENTION_REGEX = /@([a-zA-Z0-9_.]+)/g

export function extractMentionedUsernames(message: string): string[] {

  const matches = message.matchAll(MENTION_REGEX)
  const usernames = new Set<string>()

  for (const match of matches) {
    usernames.add(match[1].toLowerCase())
  }

  return Array.from(usernames)

}