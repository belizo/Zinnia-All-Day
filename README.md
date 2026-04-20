# Zinnia All Day — Schedule Builder

A fully functional 3-page web app with Vimeo API integration.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Full app structure (3 pages + nav) |
| `styles.css` | Zinnia brand design system |
| `app.js` | All app logic + Vimeo API client |

## User Flow

```
Create Playlists  →  Schedule  →  Player
    (Page 1)          (Page 2)   (Page 3)
```

1. **Create Playlists** — Browse/search videos, filter by genre, select multiple, save named playlists
2. **Schedule** — Drag playlists from right panel onto the weekly calendar. Click "Play Now" to go to player
3. **Player** — Queue + embedded Vimeo player

## Vimeo API Setup

### Step 1 — Create a Vimeo App
1. Go to https://developer.vimeo.com/apps
2. Click "Create a new app"
3. Fill in app name and description
4. Under "Permissions", check: **Public**, **Private**, **Video Files**, **Edit**

### Step 2 — Generate Access Token
1. In your app page, go to **Authentication**
2. Under "Generate an Access Token", select scopes: `public`, `private`
3. Click **Generate**
4. Copy the token

### Step 3 — Connect in the App
1. Open the app and click **"Configure Vimeo"** button (top right of playlist page)
2. Paste your Access Token
3. (Optional) Enter your User ID and/or Album/Folder ID to scope which videos load
4. Click **"Connect & Load"**

### Finding Your User/Album ID
- **User ID**: Go to your Vimeo profile → the number in the URL: `vimeo.com/user/12345678`
- **Album ID**: Open a showcase/album → number in URL: `vimeo.com/showcase/9876543`

### API Endpoints Used
```
GET /me/videos                                    ← All your videos
GET /users/:userId/videos                         ← Specific user's videos  
GET /users/:userId/albums/:albumId/videos         ← Videos in an album/showcase
```

All requests use:
```
Authorization: bearer YOUR_TOKEN
Accept: application/vnd.vimeo.*+json;version=3.4
```

## Running Locally

```bash
# Option 1: Python
python3 -m http.server 8080
# Open http://localhost:8080

# Option 2: Node
npx serve .
# Open http://localhost:3000

# Option 3: VS Code
# Install "Live Server" extension → right click index.html → Open with Live Server
```

## Features

- **Vimeo API**: Live video loading with thumbnail, title, duration
- **Genre auto-tagging**: Videos are automatically categorized based on title/tags
- **Drag & Drop scheduling**: Drag playlist chips from sidebar onto calendar cells
- **Persistent storage**: Playlists and schedule saved in localStorage
- **Week navigation**: Browse by week, month label updates
- **Sample data**: 16 seed videos shown when no Vimeo token configured
- **Search + filter**: Real-time video search + genre pill filtering
- **Multi-select**: Select multiple videos, save to named playlists
- **Player**: Embedded Vimeo iframe player when token connected

## Customization

### Colors (in `styles.css` `:root`)
```css
--navy: #072843;       /* Primary dark */
--brand: #ff6050;      /* Brand coral/red */
--bg: #f5f7fa;         /* Page background */
```

### Genre list (in `app.js`)
```js
const GENRES = ['Daily Living', 'Animals', ...];
```

### Seed videos
Edit the `SEED_VIDEOS` array in `app.js` to customize sample content.
