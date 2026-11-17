#!/usr/bin/env node
// Feed parity + podcast-directory sanity gate for the built site.
//
//   npm run build && npm run check:feeds
//   node tools/check-feeds.mjs [publicDir]      # default: ./public
//
// Lives in tools/, not scripts/: Hexo loads every file in scripts/ as a
// plugin at build time, and this standalone ESM script is not one.
//
// What it guards (exit 1 on any failure, with one line per problem):
// - podcast.xml / spotlight.xml / gadgets.xml exist and are well-formed
//   (via `xmllint --noout` when xmllint is on PATH; skipped with a warning
//   otherwise).
// - Each feed has at least the baseline number of items (45 / 12 / 4), and
//   every baseline item's <guid>, <link> and enclosure url is still present,
//   byte-for-byte. New episodes may be added; nothing published may change.
//   Baselines: verification/backup-rss.xml (production podcast.xml snapshot)
//   and verification/feed-baseline.json (spotlight / gadgets).
// - Channel tags Apple / Podcast Index expect: itunes:type, itunes:explicit
//   (true|false), itunes:image, itunes:category (Apple's list), podcast:guid
//   (UUID), podcast:locked, atom:link rel="self", language.
// - Every item has an enclosure with url/length/type, itunes:duration and
//   itunes:episode.
// - The itunes:image artwork exists in publicDir and is a square PNG/JPEG
//   between 1400 and 3000 px (dimensions read from the PNG IHDR / JPEG SOF).
//
// No dependencies: the feeds are machine-generated from one template, so a
// small regex extraction is reliable enough here; well-formedness is
// xmllint's job.

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(process.argv[2] || join(ROOT, 'public'))
const VERIFY = join(ROOT, 'verification')

const FEEDS = [
  { file: 'podcast.xml', min: 45 },
  { file: 'spotlight.xml', min: 12 },
  { file: 'gadgets.xml', min: 4 },
]

// Apple Podcasts categories (top level -> subcategories), per
// https://podcasters.apple.com/support/1691-apple-podcasts-categories
const APPLE_CATEGORIES = {
  'Arts': ['Books', 'Design', 'Fashion & Beauty', 'Food', 'Performing Arts', 'Visual Arts'],
  'Business': ['Careers', 'Entrepreneurship', 'Investing', 'Management', 'Marketing', 'Non-Profit'],
  'Comedy': ['Comedy Interviews', 'Improv', 'Stand-Up'],
  'Education': ['Courses', 'How To', 'Language Learning', 'Self-Improvement'],
  'Fiction': ['Comedy Fiction', 'Drama', 'Science Fiction'],
  'Government': [],
  'History': [],
  'Health & Fitness': ['Alternative Health', 'Fitness', 'Medicine', 'Mental Health', 'Nutrition', 'Sexuality'],
  'Kids & Family': ['Education for Kids', 'Parenting', 'Pets & Animals', 'Stories for Kids'],
  'Leisure': ['Animation & Manga', 'Automotive', 'Aviation', 'Crafts', 'Games', 'Hobbies', 'Home & Garden', 'Video Games'],
  'Music': ['Music Commentary', 'Music History', 'Music Interviews'],
  'News': ['Business News', 'Daily News', 'Entertainment News', 'News Commentary', 'Politics', 'Sports News', 'Tech News'],
  'Religion & Spirituality': ['Buddhism', 'Christianity', 'Hinduism', 'Islam', 'Judaism', 'Religion', 'Spirituality'],
  'Science': ['Astronomy', 'Chemistry', 'Earth Sciences', 'Life Sciences', 'Mathematics', 'Natural Sciences', 'Nature', 'Physics', 'Social Sciences'],
  'Society & Culture': ['Documentary', 'Personal Journals', 'Philosophy', 'Places & Travel', 'Relationships'],
  'Sports': ['Baseball', 'Basketball', 'Cricket', 'Fantasy Sports', 'Football', 'Golf', 'Hockey', 'Rugby', 'Running', 'Soccer', 'Swimming', 'Tennis', 'Volleyball', 'Wilderness', 'Wrestling'],
  'Technology': [],
  'True Crime': [],
  'TV & Film': ['After Shows', 'Film History', 'Film Interviews', 'Film Reviews', 'TV Reviews'],
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const errors = []
const warnings = []
const fail = (feed, msg) => errors.push(`${feed}: ${msg}`)

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Text of the first <tag>...</tag> (or null). Raw, not entity-decoded.
const tagText = (xml, tag) => {
  const m = xml.match(new RegExp(`<${esc(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc(tag)}>`))
  return m ? m[1].trim() : null
}
// Attributes of every <tag ...> start/empty tag.
const tagAttrs = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${esc(tag)}(\\s[^>]*?)?\\s*/?>`, 'g'))].map((m) => {
    const attrs = {}
    for (const a of (m[1] || '').matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = a[2]
    return attrs
  })

const splitItems = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
const channelHead = (xml) => {
  const ch = tagText(xml, 'channel') ?? ''
  const i = ch.indexOf('<item>')
  return i === -1 ? ch : ch.slice(0, i)
}

const itemKeys = (item) => ({
  guid: tagText(item, 'guid'),
  link: tagText(item, 'link'),
  enclosure: tagAttrs(item, 'enclosure')[0]?.url ?? null,
})

function loadBaselines() {
  const out = {}
  const backup = join(VERIFY, 'backup-rss.xml')
  if (!existsSync(backup)) errors.push(`baseline missing: ${backup}`)
  else out['podcast.xml'] = splitItems(readFileSync(backup, 'utf8')).map(itemKeys)
  const json = join(VERIFY, 'feed-baseline.json')
  if (!existsSync(json)) errors.push(`baseline missing: ${json}`)
  else Object.assign(out, JSON.parse(readFileSync(json, 'utf8')))
  return out
}

// ---------- image dimensions ----------
function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue }
      const marker = buf[off + 1]
      if (marker === 0xff) { off++; continue }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue }
      const len = buf.readUInt16BE(off + 2)
      // SOF0..SOF15, except DHT (C4), JPG (C8), DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpeg', height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) }
      }
      off += 2 + len
    }
    return { type: 'jpeg', width: null, height: null }
  }
  return null
}

function checkArtwork(feed, href) {
  let pathname
  try { pathname = decodeURIComponent(new URL(href).pathname) } catch { return fail(feed, `itunes:image href is not an absolute URL: ${href}`) }
  const file = join(PUBLIC, pathname)
  if (!existsSync(file)) return fail(feed, `artwork ${href} not found in build (${file})`)
  const size = imageSize(readFileSync(file))
  if (!size) return fail(feed, `artwork ${pathname} is not a PNG or JPEG`)
  if (!size.width || !size.height) return fail(feed, `artwork ${pathname}: could not read JPEG dimensions`)
  const { width: w, height: h } = size
  if (w !== h) fail(feed, `artwork ${pathname} is ${w}x${h}, must be square`)
  if (w < 1400 || w > 3000 || h < 1400 || h > 3000) fail(feed, `artwork ${pathname} is ${w}x${h}, must be 1400-3000 px`)
}

// ---------- xmllint ----------
const xmllintAvailable = spawnSync('xmllint', ['--version'], { encoding: 'utf8' }).error == null
if (!xmllintAvailable) warnings.push('xmllint not found on PATH: well-formedness check skipped')

// ---------- main ----------
const baselines = loadBaselines()

for (const { file, min } of FEEDS) {
  const path = join(PUBLIC, file)
  if (!existsSync(path)) { fail(file, `not found at ${path} (did you run npm run build?)`); continue }
  const xml = readFileSync(path, 'utf8')

  if (xmllintAvailable) {
    const r = spawnSync('xmllint', ['--noout', path], { encoding: 'utf8' })
    if (r.status !== 0) fail(file, `xmllint: not well-formed\n${(r.stderr || '').trim()}`)
  }

  // --- channel ---
  const head = channelHead(xml)
  const type = tagText(head, 'itunes:type')
  if (!type) fail(file, 'missing channel <itunes:type>')
  else if (!['episodic', 'serial'].includes(type)) fail(file, `<itunes:type> is "${type}", expected episodic|serial`)

  const explicit = tagText(head, 'itunes:explicit')
  if (explicit === null) fail(file, 'missing channel <itunes:explicit>')
  else if (!['true', 'false'].includes(explicit)) fail(file, `<itunes:explicit> is "${explicit}", Apple accepts only true|false`)

  const image = tagAttrs(head, 'itunes:image')[0]
  if (!image?.href) fail(file, 'missing channel <itunes:image href>')
  else checkArtwork(file, image.href)

  // Top-level categories are those not nested in another itunes:category.
  const cats = []
  {
    let depth = 0
    for (const m of head.matchAll(/<(\/?)itunes:category(\s[^>]*?)?\s*(\/?)>/g)) {
      if (m[1]) { depth--; continue }
      const text = decode(((m[2] || '').match(/text\s*=\s*"([^"]*)"/) || [])[1] ?? '')
      if (depth === 0) cats.push({ text, subs: [] })
      else cats.at(-1)?.subs.push(text)
      if (!m[3]) depth++
    }
  }
  if (cats.length === 0) fail(file, 'missing channel <itunes:category>')
  for (const c of cats) {
    if (!(c.text in APPLE_CATEGORIES)) { fail(file, `<itunes:category text="${c.text}"> is not an Apple top-level category`); continue }
    for (const s of c.subs) {
      if (!APPLE_CATEGORIES[c.text].includes(s)) fail(file, `<itunes:category text="${s}"> is not an Apple subcategory of ${c.text}`)
    }
  }

  const pguid = tagText(head, 'podcast:guid')
  if (!pguid) fail(file, 'missing channel <podcast:guid>')
  else if (!UUID_RE.test(pguid)) fail(file, `<podcast:guid> "${pguid}" is not a UUID`)

  const locked = tagText(head, 'podcast:locked')
  if (locked === null) fail(file, 'missing channel <podcast:locked>')
  else if (!['yes', 'no'].includes(locked)) fail(file, `<podcast:locked> is "${locked}", expected yes|no`)

  if (!tagAttrs(head, 'atom:link').some((a) => a.rel === 'self' && a.href)) fail(file, 'missing <atom:link rel="self">')
  if (!tagText(head, 'language')) fail(file, 'missing channel <language>')

  // --- items ---
  const items = splitItems(xml)
  if (items.length < min) fail(file, `${items.length} items, expected at least ${min}`)

  items.forEach((item, i) => {
    const label = `item ${i + 1} (${tagText(item, 'guid') ?? 'no guid'})`
    const enc = tagAttrs(item, 'enclosure')[0]
    if (!enc) fail(file, `${label}: missing <enclosure>`)
    else for (const k of ['url', 'length', 'type']) if (!enc[k]) fail(file, `${label}: enclosure has empty/missing ${k}`)
    if (enc?.length && !/^\d+$/.test(enc.length)) fail(file, `${label}: enclosure length "${enc.length}" is not an integer`)
    if (!tagText(item, 'itunes:duration')) fail(file, `${label}: missing <itunes:duration>`)
    if (!tagText(item, 'itunes:episode')) fail(file, `${label}: missing <itunes:episode>`)
  })

  // --- parity with published baseline ---
  const baseline = baselines[file]
  if (baseline) {
    const got = items.map(itemKeys)
    const have = { guid: new Set(got.map((g) => g.guid)), link: new Set(got.map((g) => g.link)), enclosure: new Set(got.map((g) => g.enclosure)) }
    for (const b of baseline) {
      for (const k of ['guid', 'link', 'enclosure']) {
        if (b[k] != null && !have[k].has(b[k])) fail(file, `baseline ${k} missing or changed: ${b[k]}`)
      }
    }
  } else if (!errors.some((e) => e.startsWith('baseline missing'))) {
    fail(file, 'no baseline defined')
  }

  console.log(`  ${file}: ${items.length} items (baseline ${baseline?.length ?? '?'}, min ${min})`)
}

for (const w of warnings) console.warn(`WARN  ${w}`)
if (errors.length) {
  console.error(`\nFAIL  ${errors.length} problem(s):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('\nOK    all feed checks passed')
