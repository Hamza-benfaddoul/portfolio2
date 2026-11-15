# Portfolio — hamza-benfaddoul.me

Personal portfolio of Hamza Benfaddoul. One static page, no build step, no framework.
GitHub Pages serves the `main` branch at https://www.hamza-benfaddoul.me (see `CNAME`),
so **pushing to `main` publishes the site**. Work on a branch and merge when it is checked.

## Files

| Path | What it is |
|---|---|
| `index.html` | All content, the icon sprite, and the inline SVG drawings (stack figure, route map fallback) |
| `css/site.css` | Tokens, then components in page order, then the responsive rules |
| `js/site.js` | Vanilla JS, progressive enhancement only. Sections are numbered 0–8 in comments |
| `assets/img/` | The optimized WebP images the page actually loads; `assets/img/logos/` holds the company and school logos |
| `images/` | Originals the WebP files were made from (not loaded by the page), plus `Hamza-Benfaddoul.jpg` (social preview, 1200×627) and `hbenfadd.jpeg` (structured data) |
| `hamza-benfaddoul.pdf` | The CV behind every "CV" link |
| `tools/shot.mjs` | Headless-Chrome screenshot and health-check tool (see Checking) |

## Rules for content

- Every fact comes from Hamza: his site, his CV, his LinkedIn, or what he says. Never invent
  clients, numbers, duties, dates or tech stacks. If a detail is missing, ask.
- He is on the **dev team** at Jafar AI (AI integrations, web platform, MCP servers); a separate
  AI team builds the agents. The product is Cali, an AI receptionist for healthcare (mycali.ai).
- Languages are Arabic and English. Do not show his age.
- The contact form posts to Formspree. Keep its `action` and field names
  (`name`, `Subject`, `_replyto`, `message`) exactly, and never submit it while testing.

## Rules for code

- No frameworks, CDN scripts or icon fonts. Google Fonts is the only third party.
- The page must be complete with JavaScript off: anything hidden-until-revealed hangs off the
  `js` class the inline head script adds to `<html>`. Reveals fire once and never reset.
- Respect `prefers-reduced-motion`: no idle animation, no auto-spin, no drawing effects.
- Keep the section ids `about`, `experience`, `skill`, `portfolio`, `contact`.
- Colours go through the tokens at the top of `site.css`. Dark is the default theme; light
  overrides the same tokens under `:root[data-theme="light"]`. Text on yellow or orange is
  `--dark`; text on `--ink` chips is `--on-ink`; text on the accent is `--on-accent`.
- The route panel (`.hud`) stays dark in both themes on purpose; it uses the `--hud-*` tokens.
- The top bar is sticky. Its breakpoints are 1560, 1239, 1079 (compact, menu button), 459, 399
  and 349px — re-measure it at each one after changing anything inside it.

## The route map (js section 7)

The mountain is a function `height(x, y)`; marching squares turns it into contour loops once,
and each frame re-projects them. Stops live in two lists: `WAY` (the route's waypoints) and
`pins` (which waypoint each pin sits on). The route runs in date order and each job sits higher
than the one before it.

To add or move a stop: edit `WAY` and `pins`, add the pin `<g class="pin pin--ID">` and the
label `<p class="map__lab map__lab--ID">` in `index.html`, add the log entry
`<li class="stop" data-stop="ID">`, and update the legend and the summary under the map.

The SVG markup inside `.map__svg` is the no-JavaScript drawing. After changing the model,
refresh it: load the page with reduced motion (the map then sits at its front view), copy
`document.querySelector('.map__svg').innerHTML` back into `index.html` without the
`map__route--back` path and any `is-far` classes, and copy each label's `--x` / `--y`.

## Checking a change

Preview from the repo root with any static server, for example `python3 -m http.server 5500`.

```bash
node tools/shot.mjs index.html /tmp/shots --preset desktop   # also: mobile, small (320px), tablet
node tools/shot.mjs index.html /tmp/shots --preset desktop --no-js --mode full
node tools/shot.mjs index.html /tmp/shots --preset desktop --reduced-motion --mode full
node tools/shot.mjs index.html /tmp/shots --selector ".hud" --scale 2 --name map
```

Each run prints a JSON report: horizontal overflow and its offenders, console errors, failed
requests, broken images. All of them must be clean. Open the JPEGs it writes and look at them.
Check both themes (click `[data-theme-toggle]` with `--eval`) and widths from 320 to 1600px.

After changing the hero, regenerate the social preview from it:

```bash
node tools/shot.mjs index.html /tmp/og --w 1200 --h 627 --dpr 1 --mode viewport --name og
magick /tmp/og/og-viewport.jpg -strip -quality 86 images/Hamza-Benfaddoul.jpg
```
