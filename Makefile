.DEFAULT_GOAL := run

HOST ?= 0.0.0.0
PORT ?= 8080
MEDIA_VIDEOS ?= $(abspath public/videos)
MEDIA_THUMBS ?= $(abspath public/thumbnails)

.PHONY: build run preview dev clean cache ensure-media

build: ensure-media
	npm run build

preview:
	npm run preview -- --host $(HOST) --port $(PORT)

run: cache build preview

dev: cache ensure-media
	npm run dev -- --host $(HOST) --port $(PORT)

clean:
	@rm -rf dist

cache: ensure-media
	@node scripts/cache-videos.js

ensure-media:
	@mkdir -p "$(MEDIA_VIDEOS)" "$(MEDIA_THUMBS)"
