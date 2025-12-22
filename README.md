# Gallup Video Player

React-based kiosk video player that reads a `videos.json` config, shows thumbnails, and plays videos full-screen. Any tap/click while a video is playing stops playback and returns to the home screen.
## Install
1. Run `npm install`
2. Run `make`
3. Open a browser at `http://<hostname>:8080`

## Local development

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5173`.

## Configuration (`public/videos.json`)

Example:

```json
{
  "background": {
    "src": "/background.png",
    "type": "image"
  },
  "videos": [
    {
      "id": "coyote-badger",
      "title": "Coyote and the Badger",
      "description": "Full audio version",
      "src": "/videos/Coyote and the Badger Full Audio.mp4",
      "thumbnailImage": "/thumbnails/coyote.png",
      "thumbnailTime": 5
    },
    {
      "id": "coyote-clip",
      "title": "Coyote Clip (thumb from video)",
      "description": "Example using a frame from the video for the thumbnail",
      "src": "/videos/Coyote and the Badger Full Audio.mp4",
      "thumbnailTime": 30
    }
  ]
}
```

Fields:
- `background` (optional): background media config; can be a string path/URL or an object.
  - `background.src`: image or video path/URL (local file under `public/` or an R2 URL).
  - `background.type` (optional): `image` or `video` (auto-detected from extension if omitted).
  - `background.poster` (optional): poster image to show before a video background loads.
  - `background.cachedSrc` (optional): local cached path written by the cache script.
- `id` (optional): unique identifier; auto-generated if omitted.
- `title`: display name for the card.
- `description` (optional): short helper copy.
- `src`: path to the video file (place files under `public/videos/`).
- `thumbnailImage` (optional): path to a static image poster (e.g., `public/thumbnails/...`).
- `thumbnailTime` (optional): time in seconds to grab a frame from the video and use as the thumbnail when no `thumbnailImage` is provided.

## Assets

- Background lives at `public/background.png` (copied from `art/Home Screen BG.png`) and can be replaced by an image or looping video configured in `public/videos.json`.
- Place video files in `public/videos/`.
- Place thumbnail images in `public/thumbnails/` (optional; otherwise use `thumbnailTime` for in-video frames).

## Production build

```bash
npm run build
npm run preview   # serve the built assets locally
```

### Makefile helper

```bash
make               # build dist/ (one-time or when code changes)
make build         # build dist/ (explicit)
make cache         # update cached videos and videos.json
make clean         # remove dist/
```
Serving is handled separately (e.g., `npx serve dist`). Run `make build` on the device whenever the app code changes.

### Uploading media to Cloudflare R2 (S3 API)

1) Put your R2 credentials and endpoint in `.envs` (or `.env`) using `.env.example` as a template.
2) Upload with the helper script:

```bash
scripts/r2-upload.sh public/videos        # uploads recursively to s3://<bucket>/videos/
scripts/r2-upload.sh public/thumbnails    # uploads recursively to s3://<bucket>/thumbnails/
scripts/r2-upload.sh public/videos/Coyote\ and\ the\ Badger\ Full\ Audio.mp4 custom/prefix
```

The script:
- Loads env from `.envs` (falls back to `.env`).
- Uses the AWS CLI pointed at your R2 endpoint, forcing path-style addressing.
- Sets `--acl public-read` so you can use the URLs directly in `public/videos.json`.

If you don’t have the AWS CLI, install it first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

### Cache videos locally (avoid re-downloading)

1) Ensure `public/videos.json` has the R2 URLs in `src`.
2) Run the cache script:
   ```bash
   npm run cache:videos   # or: make cache
   ```
   - Downloads any HTTP/HTTPS `src` to `public/videos/<filename>`.
   - Downloads any HTTP/HTTPS `background.src` to `public/backgrounds/<filename>`.
   - Adds a `cachedSrc` field in `videos.json` pointing to the local copy.
   - Adds a `background.cachedSrc` field in `videos.json` pointing to the local copy.
   - Removes any unused files from `public/videos` so stale downloads don’t pile up.
3) Build the static app (`make` or `npm run build`). The downloaded videos live in `public/videos`, so playback won’t hit R2 unless the cached file fails (the player falls back to `src`).

Note: `.gitignore` excludes `public/videos/`, so the large media stay out of git.
