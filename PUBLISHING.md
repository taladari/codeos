# CodeOS Publishing Guide

## 🚀 Automated CI/CD Pipeline

CodeOS uses GitHub Actions for automated testing and publishing:

### **CI (Continuous Integration)**
- **Triggers**: Push to `main`, Pull Requests
- **Actions**: Lint, Build, Test all packages
- **Status**: Must pass before merging PRs

### **CD (Continuous Deployment)**  
- **Triggers**: Git tags starting with `v*` (e.g., `v0.1.0`)
- **Actions**: Build and publish `@taladari/codeos` to npm
- **Requirements**: NPM_TOKEN secret configured

## 📦 Release Process

### **Option 1: Automated Release (Recommended)**
```bash
# Patch release (0.1.0 → 0.1.1)
pnpm release:patch

# Minor release (0.1.0 → 0.2.0)  
pnpm release:minor

# Major release (0.1.0 → 1.0.0)
pnpm release:major
```

The script will:
1. ✅ Verify you're on `main` branch with clean working directory
2. 📥 Pull latest changes
3. 🧪 Run tests to ensure quality
4. 🔨 Build all packages
5. 📦 Bump version in CLI package
6. 💾 Commit version bump
7. 🏷️ Create and push git tag
8. 🚀 Trigger GitHub Actions to publish to npm

### **Option 2: Manual Release**
```bash
# 1. Update version manually
cd packages/cli
npm version patch  # or minor/major

# 2. Commit and tag
git add package.json
git commit -m "chore: bump version to v0.1.1"
git tag v0.1.1

# 3. Push tag (triggers publish)
git push origin main
git push origin v0.1.1
```

## 🔑 Setup Requirements

### **1. NPM Token**
1. Create npm account: https://www.npmjs.com/signup
2. Generate access token: https://www.npmjs.com/settings/tokens
3. Add to GitHub Secrets: `Settings → Secrets → NPM_TOKEN`

### **2. Package Scope**
- Package name: `@taladari/codeos`
- Requires npm organization or user scope
- Set `publishConfig.access: "public"` for scoped packages

## 📋 Installation Commands

After publishing, users can install:

```bash
# Latest version
npm install -g @taladari/codeos

# Specific version  
npm install -g @taladari/codeos@0.1.0

# Development install (from GitHub)
npm install -g git+https://github.com/taladari/codeos.git#main
```

## 🔍 Monitoring

- **GitHub Actions**: https://github.com/taladari/codeos/actions
- **npm Package**: https://www.npmjs.com/package/@taladari/codeos
- **Download Stats**: https://npmcharts.com/compare/@taladari/codeos

## 🐛 Troubleshooting

### **Publish Failed**
- Check NPM_TOKEN is valid and has publish permissions
- Verify package name is available on npm
- Ensure version number is higher than published version

### **Tests Failed**
- Fix failing tests before releasing
- Check all packages build successfully
- Verify OAuth integration works

### **Tag Already Exists**
```bash
# Delete local and remote tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Create new tag
git tag v0.1.0
git push origin v0.1.0
```
