#!/bin/sh
# Script to fix import paths

# Log current file system
echo "Current lib directory contents:"
ls -la lib/

# Check if the file exists with the correct case
if [ -f "lib/fandangoScraper.ts" ]; then
  echo "Found lib/fandangoScraper.ts"
  # Make a copy with different casing to handle case-sensitive imports
  cp lib/fandangoScraper.ts lib/FandangoScraper.ts
  echo "Created a copy as lib/FandangoScraper.ts"
fi

# Update import paths in API routes
find app/api -name "*.ts" -exec sed -i 's/@\/lib\/fandangoScraper/@\/lib\/FandangoScraper/g' {} \;
echo "Updated import paths in API routes"

echo "Fixed imports completed" 