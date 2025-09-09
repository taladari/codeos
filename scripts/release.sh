#!/bin/bash

# CodeOS Release Script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

VERSION_TYPE=${1:-patch}

echo "🚀 Starting CodeOS release process..."

# Check if we're on main branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
    echo "❌ Please switch to main branch first"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory is not clean. Please commit your changes first."
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Run tests
echo "🧪 Running tests..."
pnpm -r exec vitest --run

# Build packages
echo "🔨 Building packages..."
pnpm -w build

# Update version in all packages
echo "📦 Updating version..."
OLD_VERSION=$(node -p "require('./packages/cli/package.json').version")
pnpm -r version $VERSION_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./packages/cli/package.json').version")

echo "📝 Version updated: $OLD_VERSION → $NEW_VERSION"

# Commit version bump
git add packages/*/package.json
git commit -m "chore: bump version to v$NEW_VERSION"

# Create and push tag
echo "🏷️  Creating tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"

echo "✅ Release v$NEW_VERSION initiated!"
echo "🔗 Check GitHub Actions: https://github.com/taladari/codeos/actions"
echo "📦 Package will be published to: https://www.npmjs.com/package/@taladari/codeos"

# Show installation command
echo ""
echo "📋 Installation command:"
echo "npm install -g @taladari/codeos@$NEW_VERSION"
