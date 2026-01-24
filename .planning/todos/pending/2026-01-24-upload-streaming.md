---
created: 2026-01-24T15:00
title: "PERF: Stream uploads to disk instead of memory buffer"
area: performance
priority: low
source: CODE_REVIEW_06.MD
files:
  - src/app/api/upload/attachment/route.ts
---

## Problem

Upload route reads the entire file into memory before writing to disk. With 25MB max file size:

1. Concurrent uploads can spike memory usage
2. GC pressure increases
3. Risk of OOM on resource-constrained servers

Reference: `src/app/api/upload/attachment/route.ts:60, 96`

Current code:
```typescript
const bytes = await file.arrayBuffer();
const buffer = Buffer.from(bytes);
await fs.writeFile(filePath, buffer);
```

## Impact

- 10 concurrent 25MB uploads = 250MB+ memory spike
- Server may become unresponsive during GC
- Limits concurrent upload capacity

## Solution

Stream file directly to disk with size validation:

```typescript
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

// Stream to temp file with size limit
const tempPath = `${filePath}.tmp`;
const writeStream = createWriteStream(tempPath);
let bytesWritten = 0;

const readableStream = file.stream();
const reader = readableStream.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  bytesWritten += value.length;
  if (bytesWritten > MAX_SIZE) {
    writeStream.destroy();
    await fs.unlink(tempPath);
    throw new Error('File too large');
  }

  // Validate magic bytes from first chunk
  if (bytesWritten === value.length) {
    validateMagicBytes(value);
  }

  writeStream.write(value);
}

await new Promise(resolve => writeStream.end(resolve));
await fs.rename(tempPath, filePath);
```

## Implementation Notes

- Magic byte validation can use first chunk only
- Temp file prevents partial uploads on error
- Consider using busboy or similar for multipart parsing
- May need to adjust for Next.js App Router constraints
