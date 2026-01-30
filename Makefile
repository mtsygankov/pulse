# Makefile for Pulse Project Tailwind CSS

.PHONY: build build-prod watch clean help deploy

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

deploy:
	rsync --progress -avz --relative ./app/main.py ./app/config.json ./app/static/ ./app/templates/ ./icons/ ./*.toml ubuntu@35.166.88.10:~/pulse/

# Help
help:
	@echo "Available commands:"
	@echo "  make build      - Build Tailwind CSS once"
	@echo "  make watch      - Watch for changes and rebuild automatically"
	@echo "  make build-prod - Build for production (same as build)"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make deploy     - Deploy to production server"
	@echo "  make help       - Show this help message"
