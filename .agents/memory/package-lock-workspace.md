---
name: Package lock in pnpm workspace
description: Creating an npm lockfile for a pnpm workspace root may require an isolated temporary package directory.
---

The root project uses pnpm workspace tooling, while this Discord bot is intended to support Docker's `npm ci`. Generate the npm lockfile from a temporary copy of the package manifest when the package-management helper refuses to add root dependencies.

**Why:** The package-management helper uses pnpm and rejects adding dependencies to a workspace root; direct npm lock generation in the workspace can collide with pnpm's installed tree.

**How to apply:** Keep `package-lock.json` aligned with the root `package.json`, validate it with `npm ci` in a clean temporary directory, and avoid exposing tokens during Git operations.