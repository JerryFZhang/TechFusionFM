# TechFusionFM

Podcast hosting and feed generation site for [TechFusionFM.com](https://TechFusionFM.com) — 《科技聚变》, a Chinese-language podcast about the internet and the people who make it.

## Status

The show is rebooting. This repo is the working tree for the redesign and rewrite — see [PLAN.md](./PLAN.md) for the phased plan.

The currently-deployed site is a static build of this repo's `master` branch (Hexo 3.8 + a customized [Anatole](https://github.com/hi-caicai/farbox-theme-Anatole) theme). The reboot will modernize both the stack and the design; until then, `master` reflects production.

## Local development

> The current build chain is pinned to Hexo 3.8 and the deprecated `hexo-renderer-jade`. It does not install cleanly on modern Node. Stack modernization is Phase 2 — until then, build on Node 10 or use the archived deploy box.

```sh
npm install
npx hexo generate   # outputs to ./public
npx hexo server     # local preview on :4000
```

## Deployment

Production today is a self-hosted Apache 2 box; `autodep.sh` rsyncs `public/` into `/var/www/html/`. Hosting is being re-evaluated as part of the reboot.

## Credits

- CMS: [Hexo](https://hexo.io)
- Theme (current): based on [Anatole](https://github.com/hi-caicai/farbox-theme-Anatole)
- Telegram bot, custom deployment script, show notes, custom XML parser, theme customization: [Jerry Fengwei Zhang](https://github.com/JerryFZhang)

## License

[Creative Commons 4.0 BY-NC-ND](https://creativecommons.org/licenses/by-nc-nd/4.0/) for everything under `source/`; MIT for the rest.

All textual content, images, logos, and audio on [TechFusionFM.com](https://TechFusionFM.com) are exclusively owned by TechFusionFM.com unless otherwise authorized.

<a rel="license" href="http://creativecommons.org/licenses/by-nc-nd/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-nd/4.0/88x31.png" /></a>
