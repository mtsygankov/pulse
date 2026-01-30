#!/bin/bash

# Tailwind CSS Production Build Script for Pulse Project
# This script builds optimized CSS for production

echo "Building Tailwind CSS for production..."
./tailwindcss -i app/static/input.css -o app/static/tailwind.min.css --minify

echo "Build complete!"
echo "File size: $(ls -lh app/static/tailwind.min.css | awk '{print $5}')"