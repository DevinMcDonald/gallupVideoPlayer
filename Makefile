.DEFAULT_GOAL := run

IMAGE ?= gallup-video-player
CONTAINER ?= gallup-video-player
PORT ?= 8080
MEDIA_VIDEOS ?= $(abspath public/videos)
MEDIA_THUMBS ?= $(abspath public/thumbnails)

.PHONY: build run stop logs clean cache ensure-media

build:
	docker build -t $(IMAGE) .

run: stop ensure-media build
	docker run --name $(CONTAINER) -d -p $(PORT):80 \
		-v "$(MEDIA_VIDEOS)":/usr/share/nginx/html/videos:ro \
		-v "$(MEDIA_THUMBS)":/usr/share/nginx/html/thumbnails:ro \
		$(IMAGE)
	@echo "App running at http://localhost:$(PORT)"

stop:
	@if docker ps -a --format '{{.Names}}' | grep -Eq '^$(CONTAINER)$$'; then \
	  echo "Stopping/removing existing container $(CONTAINER)"; \
	  docker rm -f $(CONTAINER); \
	else \
	  echo "No existing container named $(CONTAINER)"; \
	fi

logs:
	docker logs -f $(CONTAINER)

clean: stop

cache:
	@node scripts/cache-videos.js

ensure-media:
	@mkdir -p "$(MEDIA_VIDEOS)" "$(MEDIA_THUMBS)"
