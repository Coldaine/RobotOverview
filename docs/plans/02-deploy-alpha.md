---
title: Deploy Alpha Plan
date: 2026-06-13
author: Patrick MacLyman
status: queued
last_confirmed: 2026-06-16
---

# Deploy Alpha

## Objective

Publish the stabilized alpha so the Hangar can be opened from a real URL and reviewed outside the local dev environment.

## Status

Queued. Alpha stabilization has already landed.

## Infrastructure

The Hangar deploys to the same single-node k3s cluster that hosts MooseGoose Studio — a Linux laptop exposed publicly via Cloudflare Tunnel. This matches the existing stack: Next.js standalone container, imported image tarball, k3s Deployment and Service, Cloudflare Tunnel ingress rule.

Secrets managed via Doppler. No Vercel, no GitHub Pages.

## Implement

- Enable `output: 'standalone'` in `next.config.ts`.
- Write a `Dockerfile` that builds the Next.js standalone output and copies `.next/standalone` + `.next/static` + `public/`.
- Build the image on the k3s host machine (not icarus-laptop): `docker build -t hangar-web:v0.1.0 .`
- Import into k3s: `docker save hangar-web:v0.1.0 | sudo k3s ctr images import -`
- Write a k3s manifest (`k8s/hangar.yaml`) with Deployment, Service, and an Ingress or Cloudflare Tunnel route entry pointing to the service port.
- Add the Hangar hostname to the Cloudflare Tunnel ingress config (same tunnel as MooseGoose).
- Wire any required env vars through Doppler and a k3s Secret.
- Preserve clean App Router deep-link behavior — standalone output handles this natively.

## Verify

- Run `npm run lint`.
- Run `npm run build`.
- Confirm `output: 'standalone'` produces `.next/standalone/`.
- Smoke-test the running container locally before importing to k3s.
- Check the deployed app routes:
  - Hub opens.
  - Mission detail opens.
  - Unit detail opens.
  - Quartermaster source toggle works.
  - Reloading a clean deep route returns to the expected view.

## Handoff

- Commit `Dockerfile`, `k8s/hangar.yaml`, and updated `next.config.ts` as a coherent chunk.
- Push the branch.
- Open a ready, non-draft PR that includes the deployment URL or the exact remaining k3s step.
