# Gallup Video Player

React-based kiosk video player that reads a `videos.json` config, shows thumbnails, and plays videos full-screen. Any tap/click while a video is playing stops playback and returns to the home screen.

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
- `id` (optional): unique identifier; auto-generated if omitted.
- `title`: display name for the card.
- `description` (optional): short helper copy.
- `src`: path to the video file (place files under `public/videos/`).
- `thumbnailImage` (optional): path to a static image poster (e.g., `public/thumbnails/...`).
- `thumbnailTime` (optional): time in seconds to grab a frame from the video and use as the thumbnail when no `thumbnailImage` is provided.

## Assets

- Background lives at `public/background.png` (copied from `art/Home Screen BG.png`).
- Place video files in `public/videos/`.
- Place thumbnail images in `public/thumbnails/` (optional; otherwise use `thumbnailTime` for in-video frames).

## Production build

```bash
npm run build
npm run preview   # serve the built assets locally
```

## Docker

Build and run:

```bash
docker build -t gallup-video-player .
docker run -p 8080:80 gallup-video-player
```

The container serves the static build via nginx on port 80. Update `public/videos.json` and assets before building to bake them into the image.

### Makefile helper

```bash
make          # builds the image and runs container on port 8080 by default
PORT=3000 make run   # override host port
make stop     # stop/remove the running container
make logs     # follow container logs
```

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

### Cache videos locally for Docker (avoid re-downloading)

1) Ensure `public/videos.json` has the R2 URLs in `src`.
2) Run the cache script:
   ```bash
   npm run cache:videos   # or: make cache
   ```
   - Downloads any HTTP/HTTPS `src` to `public/videos/<filename>`.
   - Adds `cachedSrc` and `remoteSrc` fields in `videos.json`, pointing to the local copy and original URL.
3) Build the Docker image (`make` or `npm run build && docker build ...`). The downloaded videos are baked into the image, so playback won’t hit R2 unless the local copy fails.

Note: `.gitignore` excludes `public/videos/`, so the large media stay out of git.

### Runtime with bind-mounted media (preferred)
- Place your videos in `public/videos/` and thumbnails in `public/thumbnails/` (or run `make cache` to pull from R2).
- `make` (or `make run`) will:
  - ensure those folders exist,
  - build the image (videos are ignored by `.dockerignore` so they aren’t baked in),
  - run the container with bind mounts:
    - `public/videos` → `/usr/share/nginx/html/videos`
    - `public/thumbnails` → `/usr/share/nginx/html/thumbnails`
- This keeps the image small and uses your local media without re-downloading. Remote URLs in `videos.json` are still present as fallback.
