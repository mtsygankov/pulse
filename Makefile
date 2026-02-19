# Makefile for Pulse Project Tailwind CSS

USA_IP ?= 35.166.88.10
UK_IP ?= 3.9.199.170
USA_USER ?= ubuntu
UK_USER ?= ubuntu
DATA_DUMP_URL ?= http://35.166.88.10:1971/dump

.PHONY: build build-prod watch clean help deploy_usa deploy_uk data-download dev

# Build Tailwind CSS (one-time)
build:
	./tailwindcss -i app/static/input.css -o app/static/tailwind.min.css --minify
	@echo "✓ Tailwind CSS built successfully"
	@ls -lh app/static/tailwind.min.css | awk '{print "File size: " $$5}'

# Production build (same as build, but named clearly)
build-prod: build

# Watch mode for development
watch:
	@echo "🔍 Starting Tailwind CSS watch mode..."
	@echo "Watching: app/templates/**/*.html"
	@echo "Output: app/static/tailwind.min.css"
	@echo "Press Ctrl+C to stop"
	@echo ""
	./tailwindcss -i app/static/input.css -o app/static/tailwind.min.css --watch

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -f app/static/tailwind.min.css
	@echo "✓ Cleaned"

deploy_usa:
	rsync --progress -avz --relative ./app/main.py ./app/config.json ./app/static/ ./app/templates/ ./icons/ ./*.toml $(USA_USER)@$(USA_IP):~/pulse/

deploy_uk:
	rsync --progress -avz --relative ./app/main.py ./app/config.json ./app/static/ ./app/templates/ ./icons/ ./*.toml $(UK_USER)@$(UK_IP):~/pulse/

data-download:
	@set -e; \
	data_file="data/bp.ndjson"; \
	backup_suffix=$$(date +%Y%m%d_%H%M%S); \
	tmp_file=$$(mktemp); \
	cleanup() { rm -f "$$tmp_file"; }; \
	trap cleanup EXIT; \
	curl -fsSL "$(DATA_DUMP_URL)" -o "$$tmp_file"; \
	if [ ! -s "$$tmp_file" ]; then \
		echo "Download failed or empty; keeping existing data."; \
		exit 1; \
	fi; \
	count=0; \
	while IFS= read -r line; do \
		if [ -z "$$line" ]; then \
			continue; \
		fi; \
		echo "$$line" | jq -e . >/dev/null || exit 1; \
		count=$$((count + 1)); \
	done < "$$tmp_file"; \
	if [ "$$count" -eq 0 ]; then \
		echo "Download is empty after filtering; keeping existing data."; \
		exit 1; \
	fi; \
	if [ -f "$$data_file" ]; then \
		mv "$$data_file" "$$data_file.backup.$$backup_suffix"; \
	fi; \
	mv "$$tmp_file" "$$data_file"

dev:
	uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# Help
help:
	@echo "Available commands:"
	@echo "  make build      - Build Tailwind CSS once"
	@echo "  make watch      - Watch for changes and rebuild automatically"
	@echo "  make build-prod - Build for production (same as build)"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make deploy_usa - Deploy to production server"
	@echo "  make deploy_uk  - Deploy to production server"
	@echo "  make data-download - Backup and download data from USA server"
	@echo "  make dev        - Run the app locally on localhost:8002"
	@echo "  make help       - Show this help message"
