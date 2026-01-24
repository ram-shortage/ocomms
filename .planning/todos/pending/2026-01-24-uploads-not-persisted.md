---
created: 2026-01-24T13:30
title: Uploads not persisted and images 404
area: api
files:
  - docker-compose.yml
  - src/app/api/upload/attachment/route.ts
  - scripts/CODE_REVIEW_06.MD
---

## Problem

Multiple issues with file uploads:

### 1. No Docker volume for uploads
The `app` container has no volume mount for `public/uploads/`. Files are stored in the container's ephemeral filesystem and lost on rebuild/restart.

### 2. Images returning 404
Shared images show 404 errors. The path is stored correctly (`/uploads/attachments/filename.png`) but files aren't being served.

### 3. Uploads need deeper review
Per CODE_REVIEW_06.MD: "if you want a deeper pass on specific areas (auth, permissions, message rendering, uploads), point me at the modules"

Potential concerns:
- Upload authentication/authorization
- File type validation
- Storage quotas enforcement
- Path traversal prevention
- MIME type spoofing

## Solution

1. Add volume to docker-compose.yml:
```yaml
app:
  volumes:
    - uploads_data:/app/public/uploads

volumes:
  uploads_data:
```

2. After adding volume, re-run seed or manually copy files

3. Schedule deeper upload security review
