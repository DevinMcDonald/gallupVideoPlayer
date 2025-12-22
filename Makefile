.DEFAULT_GOAL := build

MEDIA_VIDEOS ?= $(abspath public/videos)
MEDIA_THUMBS ?= $(abspath public/thumbnails)

.PHONY: build serve clean cache ensure-media

build: ensure-media
	npm run build

serve:
	python3 -m http.server 8080 --directory dist

clean:
	@rm -rf dist

cache: ensure-media
	@node scripts/cache-videos.js

ensure-media:
	@mkdir -p "$(MEDIA_VIDEOS)" "$(MEDIA_THUMBS)"
