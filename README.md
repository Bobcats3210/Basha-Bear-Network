# Basha Bear Network — Website

Static site for BBN, Basha High School’s award-winning student broadcast program.

## File structure

```
├── index.html      Page structure + Google Analytics snippet
├── styles.css      All styling (dark theme, BBN green + gold, responsive)
├── script.js       Scroll-fade animations
└── logo.png        Transparent BBN logo (used in nav + footer)
```

Everything is plain HTML/CSS/JS — no build step, no dependencies. Drop these four files anywhere and it works.

## Google Analytics setup

The site is wired up for **Google Analytics 4 (GA4)**. To activate tracking:

1. Go to https://analytics.google.com and create a GA4 property for the BBN site.
1. Copy your **Measurement ID** (looks like `G-XXXXXXXXXX`).
1. Open `index.html` and replace **both** occurrences of `G-XXXXXXXXXX` with your real ID.
- Line ~12 (the script tag `src`)
- Line ~16 (the `gtag('config', ...)` call)

That’s it. The page will start sending pageviews immediately.

### Custom events being tracked

Beyond automatic pageviews, the site tracks:

|Event              |Fires when                                           |
|-------------------|-----------------------------------------------------|
|`watch_shows_click`|Someone clicks the hero “Watch Our Shows” button     |
|`email_click`      |Someone clicks any email link (Apply / Email Us)     |
|`social_click`     |Someone clicks an Instagram, YouTube, or X link      |
|`nav_click`        |Someone uses an in-page anchor (#about, #shows, etc.)|

YouTube video views inside the embedded players are tracked automatically by GA4’s **Enhanced Measurement** — make sure that’s toggled on in your GA4 admin panel.

## Hosting

Anywhere that serves static files:

- **GitHub Pages** — drop these in a repo, enable Pages
- **Netlify / Vercel** — drag-and-drop deploy
- **School / CUSD hosting** — upload via FTP or whatever the district uses

## Editing tips

- **Add a team member:** find the `<div class="team-grid">` block in `index.html`, copy any `<div class="team-card">` and edit the name/role.
- **Swap a video:** in the `featured-work` or `podcasts` section, replace the YouTube embed ID (the part after `/embed/`).
- **Change colors:** all colors are CSS variables at the top of `styles.css` (`:root { --green: ...; --gold: ...; }`).
- **Update the email address:** search `styles.css` and `index.html` for `skalitzky.glenda@cusd80.com`.