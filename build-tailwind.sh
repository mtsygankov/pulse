#!/bin/bash

# Tailwind CSS Watch Script for Pulse Project
# This script watches for changes in templates and rebuilds CSS

echo "Starting Tailwind CSS watch mode..."
echo "Watching: app/templates/**/*.html"
echo "Output: app/static/tailwind.min.css"
echo "Press Ctrl+C to stop"
echo ""

./tailwindcss -i app/static/input.css -o app/static/tailwind.min.css --watch