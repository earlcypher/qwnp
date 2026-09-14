#!/bin/bash
# Replace YOUR_USERNAME with your actual GitHub username
GITHUB_USERNAME="YOUR_USERNAME"

echo "Setting up remote..."
git remote add origin https://github.com/$GITHUB_USERNAME/qwen-proxy-v2.git 2>/dev/null || git remote set-url origin https://github.com/$GITHUB_USERNAME/qwen-proxy-v2.git

echo "Pushing to GitHub..."
git branch -M main
git push -u origin main

echo "✓ Pushed to GitHub!"
echo "Next: Encode your credentials and deploy to Render"
