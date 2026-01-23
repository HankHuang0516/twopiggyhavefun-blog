---
description: Build, Verify, and Push
---
This workflow automatically builds the project, runs the internal verification script to check for broken links and legacy paths, and if successful, pushes the changes to the remote repository.

1. Build the project
   > npm run build

2. Run verification script
   > node verify_site.js --internal-only

3. Push to repository
   > git push
