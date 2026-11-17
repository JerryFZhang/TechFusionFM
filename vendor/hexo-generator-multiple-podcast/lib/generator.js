'use strict'

const nunjucks = require('nunjucks')
const pathFn = require('path')
const fs = require('fs')

const env = new nunjucks.Environment()
env.addFilter('date_to_rfc822', str => (new Date(str)).toUTCString())

const rss2TmplSrc = pathFn.join(__dirname, '../rss2.xml')
const rss2Tmpl = nunjucks.compile(fs.readFileSync(rss2TmplSrc, 'utf8'), env)

// Plain-text <itunes:summary> support (vendor/PATCHES.md §3).
// The template autoescapes, so this returns *unescaped* text; entities that
// marked already emitted are decoded first to avoid double escaping.
const SUMMARY_MAX = 4000
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decodeEntities = str => str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') {
    const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    try { return String.fromCodePoint(cp) } catch (_) { return m }
  }
  const named = NAMED_ENTITIES[e.toLowerCase()]
  return named === undefined ? m : named
})
const htmlToText = html => decodeEntities(String(html || '')
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  .replace(/>\s*\n\s*</g, '><') // source newlines between tags are not text
  .replace(/\s*\n\s*/g, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<li[^>]*>/gi, '- ')
  .replace(/<\/(li|tr)>/gi, '\n')
  .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote|pre|table)>/gi, '\n\n')
  .replace(/<[^>]*>/g, ''))
  .replace(/[ \t\u00a0]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
const truncate = (str, max) => {
  const chars = Array.from(str) // count code points, never split a surrogate pair
  return chars.length <= max ? str : chars.slice(0, max - 1).join('').trimEnd() + '…'
}
const buildSummary = (subtitle, html) => {
  subtitle = htmlToText(subtitle)
  let body = htmlToText(html)
  // Most posts open with the subtitle verbatim; don't repeat it.
  if (subtitle && body.startsWith(subtitle)) body = body.slice(subtitle.length).trim()
  return truncate([subtitle, body].filter(Boolean).join('\n\n'), SUMMARY_MAX)
}

const getFeedConfig = (feed, config) => {
  let cfg = Object.assign({
    type: 'rss2',
    limit: 20,
    content: true,
    content_encoded: true,
    media_base_url: '/',
    default_media_type: 'audio/mpeg',
    itunes: {
      explicit: 'false'
    }
  }, feed)

  // <language>: per-feed `language`, else `itunes.language`, else zh-cn.
  cfg.language = cfg.language || cfg.itunes.language || 'zh-cn'
  cfg.default_media_type = cfg.default_media_type || 'audio/mpeg'
  cfg.itunes.type = cfg.itunes.type || 'episodic'

  // Default file name to the type of feed being generated
  cfg.path = cfg.path || `${cfg
    .type
    .toLowerCase()}.xml`

  // Default file extension to xml
  if (!pathFn.extname(cfg.path)) 
    cfg.path += '.xml'

  cfg.self_url = config.url + config.root + cfg.path
  cfg.itunes.author = cfg.itunes.author || config.author
  cfg.itunes.subtitle = cfg.itunes.subtitle || config.title
  cfg.itunes.summary = cfg.itunes.summary || `A podcast from ${config.title}`

  return cfg
}

module.exports = function (locals) {
  let config = this.config
  let template = rss2Tmpl

  let output = []

  for (let feeds of config.podcasts) {
    
    const feedConfig = getFeedConfig(feeds.feed, config)
    const url = config.url + config.root + (feedConfig.non_feed_url || '')
    // The posts that will make up the feed
    const podcast_posts = feedConfig.category
      ? locals
        .categories
        .findOne({name: feedConfig.category})
        .posts
      : feedConfig.tag
        ? locals
          .tags
          .findOne({name: feedConfig.tag})
          .posts
        : [] // TODO: Find posts that have a media item defined
    var episode = podcast_posts.length + 1;
    const episodes = podcast_posts
      .sort('date', -1)
      .limit(feedConfig.limit)
      .data
      .map((post) => {
        const content = typeof feedConfig.content === 'function'
          ? feedConfig.content(post)
          : feedConfig.content
            ? post.content
            : null
        const content_encoded = typeof feedConfig.content_encoded === 'function'
          ? feedConfig.content_encoded(post)
          : feedConfig.content_encoded
            ? post.content
            : null
        episode--
        return {
          title:"#" + episode + ": " + post.title,
          itunes_title: post.title,
          number: episode,
          episode_type: post.episode_type || 'full',
          summary: buildSummary(post.subtitle || '', post.content),
          date: post.date,
          // Hexo >= 5 normalizes post.permalink through WHATWG URL, which
          // lowercases the host (TechFusionFM.com -> techfusionfm.com).
          // Feed <guid>s are opaque case-sensitive strings, so rebuild the
          // permalink the way Hexo 3 did to keep every published GUID
          // byte-identical. See vendor/PATCHES.md §2.
          permalink: config.url + config.root + post.path,
          content_encoded,
          subtitle: post.subtitle || '',
          author: post.author || config.author,
          image: post.image || feedConfig.image,
          media: feedConfig.media_base_url + post.media,
          length: post.length,
          media_type: post.media_type || feedConfig.default_media_type,
          duration: post.duration,
          explicit: post.explicit || feedConfig.itunes.explicit,
          chapters: post.chapters
        }
      })

    output.push({
      path: feedConfig.path,
      data: template.render({
        config,
        feedConfig,
        url,
        hexo_version: this.env.version,
        as_of: (episodes[0] || {
          date: Date()
        }).date,
        episodes
      })
    })
  }
  return output
}
