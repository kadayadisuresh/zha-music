# Phase 7: Library, Likes, Playlists, Follow - Research

**Researched:** 2026-05-26
**Domain:** Database Modeling & Content Management
**Confidence:** HIGH

## Summary

This phase implements the user-centric library features, including tracking likes, saved albums, artist follows, and custom playlist management. We will add several new models to the backend to support these features and define the architectural approach for content storage.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Data Modeling | Database | Backend API | SQL relations for library state |
| Playlist Ordering | Backend API | — | Gap-based sorting logic ensures efficient reordering |
| Playlist Cover Storage | S3 (Cloud/Minio) | Backend API | Offload binary storage from application server |

## Standard Stack

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `boto3` | Latest | S3 SDK | Industry standard for AWS-compatible storage |
| `SQLAlchemy`| Latest | ORM | Existing project choice |

## Database Schema Design (Planned Additions)

We need the following models (to be created):
1. `like.py`: Tracks songs or albums liked by users.
2. `saved_album.py`: Tracks albums saved to library.
3. `playlist.py`: Core playlist definitions (name, owner, cover image URL).
4. `playlist_song.py`: Tracks song sequence in a playlist with an `order_index`.
5. `playlist_collaborator.py`: (Optional/GAD) Defines multi-user playlist permissions.

## Architecture Patterns

### Pattern: Lexicographical Ordering (Gap Strategy)
To avoid shifting thousands of rows on playlist reorder:
- Use a `float` or `int` field for `order_index`.
- When inserting between 1000 and 2000, assign 1500.
- Re-index only when the gap becomes too small to divide effectively (e.g., `< 1`).

### Recommended Project Structure
```
backend/app/models/
├── like.py
├── saved_album.py
├── playlist.py
├── playlist_song.py
└── playlist_collaborator.py
```

## Don't Hand-Roll
- **S3 Storage:** Use `boto3` for interacting with S3-compatible storage (e.g., AWS S3, Minio, R2).
- **ORM Relations:** Use SQLAlchemy's `relationship` and `ForeignKey` for all entity links.

## Runtime State Inventory
*None — phase is strictly additive.*

## Common Pitfalls
- **Race conditions in ordering:** Always use database transactions (`db.commit()`) when updating `order_index` values to ensure atomic reordering.
- **S3 Bucket Permissions:** Ensure bucket is private by default, using pre-signed URLs or proxying through backend for access.

## Gray Area Decisions (GADs)

1. **Playlist Collaborators:** Should we implement true collaboration or just owner-only initially? *Decision: Start with owner-only to keep core complexity low.*
2. **Playlist Cover Storage:** Store files in database BLOB or S3? *Decision: S3-compatible storage (standard for media-heavy apps).*

## Assumptions Log
- A1: S3-compatible environment is available or can be set up via Minio. [ASSUMED]

## Open Questions
1. Do we need full CRUD for playlist covers or just updates?
2. Should `like` be polymorphic or split into `song_like` and `album_like`?

## Security Domain
- **ASVS V4 (Access Control):** Every library/playlist operation must verify the `user_id` matches the session.

## Sources
- SQLAlchemy Docs (Relationships)
- AWS Boto3 Docs (S3)
