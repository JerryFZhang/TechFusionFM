#!/usr/bin/env node
// Refresh stale boilerplate links in episode posts.
//
//   node scripts/refresh-post-links.mjs            # rewrite files in place
//   node scripts/refresh-post-links.mjs --check    # list what would change, exit 1 if anything
//
// Deterministic string replacement over source/_posts/*.md, body only (front
// matter is never touched). Re-runnable: every rule is idempotent, so a second
// run changes nothing. The non-episode pages (faq, donate, thanks, 404) are
// skipped on purpose; they are maintained separately.
//
// Decisions recorded when the rules were written (2026-11-17, via curl):
// - 99l.tv answers 500/503 on both http and https, so it is NOT upgraded.
// - supertop.co fails the TLS handshake; its only link (/castro/) is
//   rewritten to castro.fm instead, and other supertop.co links are left alone.
// - i.youku.com/<user> now redirects to a generic index page, not a profile,
//   so i.youku.com links are treated as dead, like Google Play Music,
//   Breaker and Tudou.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const POSTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'source', '_posts')
const SKIP = new Set(['faq.md', 'donate.md', 'thanks.md', '404.md'])

// Characters that end a URL in Markdown / HTML attribute context.
const U = `[^\\s)\\]"'<>]`

const DEAD_HOSTS = [
  'playmusic\\.app\\.goo\\.gl', // Google Play Music (shut down 2020)
  'breaker\\.audio', // Breaker (shut down 2021)
  '(?:www\\.)?tudou\\.com', // Tudou
  'i\\.youku\\.com', // Youku profile pages no longer resolve
]
const DEAD_URL = `https?://(?:${DEAD_HOSTS.join('|')})(?:[/?#]${U}*)?`

const HTTPS_HOSTS = [
  'pca.st',
  'www.ximalaya.com',
  'music.163.com',
  'weibo.com',
  'instagram.com',
  'twitter.com',
  'www.lizhi.fm',
  'supertop.co',
]

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Ordered list of [name, fn(text) => text]. Order matters. */
const RULES = [
  // Dead services: drop whole Markdown list items that link to them, then
  // unlink any remaining inline [text](dead-url) to plain text.
  ['dead: list items', t => t.replace(new RegExp(`^[ \\t]*[-*+][ \\t][^\\n]*\\]\\(${DEAD_URL}\\)[^\\n]*\\n`, 'gim'), '')],
  ['dead: inline links', t => t.replace(new RegExp(`\\[([^\\]]*)\\]\\(${DEAD_URL}\\)`, 'gi'), '$1')],

  // Apple: itunes.apple.com/<cc>/podcast/<slug>/id<N> -> podcasts.apple.com/podcast/id<N>
  // Keeps an episode ?i=<N> or a reviews anchor; drops other tracking query.
  ['apple: podcast', t => t.replace(
    new RegExp(`https?://itunes\\.apple\\.com/(?:[a-z]{2}(?:-[a-z]{2})?/)?podcast/(?:${U}*?/)?id(\\d+)(${U}*)`, 'gi'),
    (_, id, rest) => {
      const ep = /[?&]i=(\d+)/.exec(rest)
      const query = ep ? `?i=${ep[1]}` : /reviews/i.test(rest) ? '?see-all=reviews' : ''
      return `https://podcasts.apple.com/podcast/id${id}${query}`
    })],
  ['apple: artist', t => t.replace(
    new RegExp(`https?://itunes\\.apple\\.com/(?:[a-z]{2}(?:-[a-z]{2})?/)?artist/(?:${U}*?/)?(?:id)?(\\d+)${U}*`, 'gi'),
    'https://podcasts.apple.com/artist/$1')],

  // Renamed / moved services (before the generic https upgrade).
  ['castro', t => t.replace(/https?:\/\/(?:www\.)?supertop\.co\/castro\/?(?=[\s)\]"'<>]|$)/gi, 'https://castro.fm')],
  ['pocketcasts', t => t.replace(/https?:\/\/www\.shiftyjelly\.com\/android\/pocketcasts\/?(?=[\s)\]"'<>]|$)/gi, 'https://pocketcasts.com')],
  ['xiaomiquan', t => t.replace(/(https?:\/\/)?www\.xiaomiquan\.com/gi, (_, s) => `${s ? 'https://' : ''}wx.zsxq.com`)],
  ['telegram', t => t.replace(/https?:\/\/telegram\.me\//gi, 'https://t.me/')],

  // http -> https for hosts confirmed to serve https.
  ['https upgrade', t => t.replace(
    new RegExp(`http://(${HTTPS_HOSTS.map(esc).join('|')})(?=[/?#\\s)\\]"'<>]|$)`, 'gi'),
    'https://$1')],

  // Twitter profile links (twitter.com/<handle>, nothing after it) -> x.com.
  // Status / media links are left on twitter.com.
  ['x.com profiles', t => t.replace(
    /https?:\/\/(?:www\.)?twitter\.com\/([A-Za-z0-9_]{1,15})\/?(?=[\s)\]"'<>]|$)/g,
    'https://x.com/$1')],
]

const splitFrontMatter = src => {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(src)
  return m ? [m[0], src.slice(m[0].length)] : ['', src]
}

const check = process.argv.includes('--check')
let changedFiles = 0
const counts = {}

for (const name of readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).sort()) {
  if (SKIP.has(name)) continue
  const path = join(POSTS_DIR, name)
  const src = readFileSync(path, 'utf8')
  const [front, body] = splitFrontMatter(src)
  let out = body
  for (const [rule, fn] of RULES) {
    const next = fn(out)
    if (next !== out) counts[rule] = (counts[rule] || 0) + 1
    out = next
  }
  if (out !== body) {
    changedFiles++
    if (!check) writeFileSync(path, front + out)
  }
}

for (const [rule, n] of Object.entries(counts)) console.log(`${rule}: ${n} file(s)`)
console.log(`${check ? 'would change' : 'changed'} ${changedFiles} file(s)`)
if (check && changedFiles) process.exitCode = 1
