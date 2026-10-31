Write-Host "Building frontend..."
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

$currentBranch = (git branch --show-current).Trim()
Write-Host "Current branch: $currentBranch"

Write-Host "Switching to orphan gh-pages branch..."
git branch -D gh-pages 2>$null
git checkout --orphan gh-pages
git reset --hard

Write-Host "Copying dist files..."
Copy-Item -Path "frontend\dist\*" -Destination "." -Recurse -Force
# GitHub Pages needs .nojekyll so it serves _assets and assets properly
New-Item -ItemType File -Name ".nojekyll" -Force | Out-Null
# Copy index.html to 404.html for SPA routing
Copy-Item "index.html" "404.html" -Force

git add -f index.html 404.html .nojekyll assets/ thumbs/ models/ quantum/ screenshots/
git commit -m "deploy(github-pages): live working deployment of MarrowQ 2.0"
Write-Host "Pushing to origin gh-pages..."
git push -f origin gh-pages

Write-Host "Switching back to $currentBranch..."
git checkout $currentBranch
Write-Host "Deployment completed successfully!"

