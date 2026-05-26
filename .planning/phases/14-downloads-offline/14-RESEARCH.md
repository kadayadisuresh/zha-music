# Phase 14: Downloads & Offline - Research

**Researched:** 2026-05-27
**Domain:** Offline support, IndexedDB, Binary data management
**Confidence:** HIGH

## Summary

This phase implements offline capabilities by storing audio blobs and metadata in IndexedDB, managed via the `idb` library. A serialized download queue ensures stable network usage, while `navigator.storage` and `navigator.onLine` provide the necessary browser environment hooks for robust offline management.

**Primary recommendation:** Use `idb` for IndexedDB interactions. Store metadata as JSON objects in one store and Blobs in another to allow for efficient querying of song info without loading large binary data.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data Persistence | Browser | — | IndexedDB is a client-side API. |
| Download Management | Browser | — | Serialized queue and blob management runs entirely in the browser context. |
| Network Sensing | Browser | — | Hooks into browser events (`online`/`offline`). |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | 8.0.3 | IndexedDB wrapper | Simplifies async/await interactions with IndexedDB. |

**Installation:**
```bash
npm install idb
```

## Architecture Patterns

### Pattern: Serialized Download Queue
**What:** A queue management system that holds download tasks and processes them sequentially, updating a global status (e.g., in a Zustand store).
**When to use:** Managing multiple song downloads to prevent overwhelming bandwidth and browser memory.
**Example:**
```typescript
// Simple implementation pattern
class DownloadQueue {
  private queue: string[] = [];
  private isProcessing = false;

  enqueue(url: string) {
    this.queue.push(url);
    this.process();
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const url = this.queue.shift();
    await downloadFile(url); // Perform fetch and IndexedDB save
    this.isProcessing = false;
    this.process();
  }
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB API | Raw `indexedDB` calls | `idb` | Raw API requires complex `IDBRequest` event handling. |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — New feature | N/A |
| Live service config | None | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None | N/A |
| Build artifacts | None | N/A |

## Common Pitfalls

### Pitfall 1: Memory Leaks from Blob URLs
**What goes wrong:** Creating multiple `URL.createObjectURL(blob)` calls without calling `URL.revokeObjectURL(url)`.
**Why it happens:** Browser keeps the memory allocated for the Blob indefinitely.
**How to avoid:** Explicitly revoke the URL when the playback component unmounts or the song is removed from the queue.

### Pitfall 2: Bandwidth Saturation
**What goes wrong:** Downloading multiple tracks in parallel on a slow connection.
**Why it happens:** Browser/OS default behavior of maximizing connections.
**How to avoid:** Use a strictly serialized queue (one at a time).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `idb` supports all modern browser features needed | Standard Stack | Minimal, widely supported |

## Open Questions

1. **How to handle large library cleanup?** We will need a mechanism to purge old downloads based on user preference or storage limits.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| IndexedDB | Offline Storage | ✓ | Standard | — |

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate URL before fetch |

### Known Threat Patterns for Offline
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via stored blob metadata | Tampering | Sanitize metadata before storing in IndexedDB |

## Sources

### Primary (HIGH confidence)
- `idb` documentation (npm/GitHub)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH

**Research date:** 2026-05-27
