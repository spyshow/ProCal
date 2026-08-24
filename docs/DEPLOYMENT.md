# ProCal Dual-Tier Deployment Guide

This guide describes ProCal's production and staging release architecture.

---

## 1. Architecture Overview

ProCal uses a **Dual-Tier Release Pipeline**:

| Environment | Purpose | Hosting Platform | Database | Trigger Branch / Event | URL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QA / Staging** | Continuous integration, QA verification, feature previews | **Render** | Render PostgreSQL / Staging DB | Push / PR merge to `master` | [`https://procal.onrender.com`](https://procal.onrender.com) |
| **Production** | Live public production service | **Vercel** | **Supabase** (PostgreSQL) | Release Tag (`v*.*.*`) or GitHub Release | Production Domain / `https://procal.vercel.app` |

---

## 2. Release Flow Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / QA
    participant GH as GitHub (master)
    participant Render as Render (QA)
    participant GHA as GitHub Actions (release.yml)
    participant Supa as Supabase (Prod DB)
    participant Vercel as Vercel (Production)

    Dev->>GH: Push commits / merge PR
    GH->>Render: Webhook: Auto-deploy to QA Checkpoint
    Render-->>Dev: QA Checkpoint live at procal.onrender.com

    Note over Dev,GH: QA verification complete. Ready for release!

    Dev->>GH: Publish Release / Git Tag (e.g. v1.0.0)
    GH->>GHA: Trigger release.yml workflow
    GHA->>GHA: Run full Typecheck & Vitest Suite (552+ tests)
    GHA->>Supa: Apply 'npx prisma migrate deploy' & upsert catalog
    GHA->>GH: Fast-forward 'production' branch to tag commit
    GH->>Vercel: Native Git Integration detects 'production' branch update
    Vercel->>Vercel: Build & deploy production release
    Vercel-->>Dev: Production Live!
```

---

## 3. Initial Setup Checklist

### A. GitHub Repository Secrets
Navigate to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions** and configure the following repository secrets:

| Secret Name | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `SUPABASE_DATABASE_URL` | **Yes** | Supabase Transaction Pooler connection string (Port 6543) | `postgresql://postgres.xxx:pass@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `SUPABASE_DIRECT_URL` | **Yes** | Supabase Direct Session connection string (Port 5432) for running migrations | `postgresql://postgres.xxx:pass@aws-0-eu-west-2.pooler.supabase.com:5432/postgres` |
| `SEED_ADMIN_PASSWORD` | Optional | Initial password for the bootstrap admin account (`engineer`) | `SecurePassword123!` |

---

### B. Vercel Configuration
1. **Import Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/new) and import `spyshow/ProCal`.
2. **Configure Git Settings**:
   - Under **Project Settings** → **Git**:
     - Set **Production Branch** to `production`.
3. **Configure Environment Variables**:
   - Under **Project Settings** → **Environment Variables**, add:
     - `DATABASE_URL`: Your Supabase pooler URL (`...:6543/postgres?pgbouncer=true`)
     - `DIRECT_URL`: Your Supabase direct connection URL (`...:5432/postgres`)
     - `JWT_SECRET`: Random 64-character hex string
     - `NEXT_PUBLIC_APP_URL`: Your production domain (e.g., `https://procal.app`)
     - `RESEND_API_KEY`: Your Resend API key for project invitations and lead notifications
     - `RESEND_FROM_EMAIL`: `ProCal <no-reply@yourdomain.com>`
     - `DATABASE_SSL_REJECT_UNAUTHORIZED`: `false`

---

### C. Render (QA Server) Configuration
- Render continues listening to the `master` branch.
- **Build Command**: `npm install --include=dev && npx prisma generate && npx prisma migrate deploy && npx tsx prisma/seed.ts && npm run build`
- **Start Command**: `npm run start`

---

## 4. How to Create a Production Release

### Option 1: Via GitHub UI (Recommended)
1. Go to your GitHub repository → **Releases** → **Draft a new release**.
2. Choose or create a tag (e.g. `v1.0.0`).
3. Select target: `master`.
4. Enter release title and notes, then click **Publish release**.
5. The GitHub Actions workflow `Production Release (Supabase & Vercel)` will automatically:
   - Run tests & typecheck
   - Run Supabase migrations & catalog updates
   - Fast-forward the `production` branch
   - Trigger the Vercel production build

### Option 2: Via Git CLI
```bash
# Ensure master is up to date and QA-verified
git checkout master
git pull origin master

# Create and push a semver release tag
git tag v1.0.0
git push origin v1.0.0
```

---

## 5. Troubleshooting & FAQ

- **Q: What happens if a release migration fails?**
  - The GitHub Action will abort immediately before touching the `production` branch. Vercel will not deploy broken code.
- **Q: Can I test a release manually without creating a tag?**
  - Yes! Go to GitHub Actions → **Production Release (Supabase & Vercel)** → **Run workflow** (Workflow Dispatch).
