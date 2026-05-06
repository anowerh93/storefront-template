# Publishing `@replybd/storefront-template`

This package is the source of truth for every Reply.BD tenant's storefront.
When you publish a new version, every tenant's next deploy or "Update template"
button picks it up automatically.

---

## One-time setup

1. **Reserve the npm scope.** Visit <https://www.npmjs.com/org/create>
   and create the `replybd` organisation (free for public packages).

2. **Authenticate the local CLI:**

   ```sh
   npm login
   ```

   Use the npm account that owns the `replybd` org.

3. **Verify ownership:**

   ```sh
   npm org ls replybd
   ```

---

## Publishing a new version

From `C:\laragon\www\storefront-template`:

```sh
# 1. Bump the version (semver)
#    Choose ONE of:
npm version patch      # 1.0.0 → 1.0.1   (bug fixes only)
npm version minor      # 1.0.0 → 1.1.0   (new features, backwards compatible)
npm version major      # 1.0.0 → 2.0.0   (breaking changes — also bump
                       #                  config('services.vercel.package_version')!)

# 2. Verify what will be uploaded (dry run; uploads nothing)
npm pack --dry-run

# 3. Ship it
npm publish
```

`prepublishOnly` runs `tsc --noEmit` automatically — a typecheck failure
will abort the publish before anything is uploaded.

---

## After publishing

- Tenants on **first deploy** get the new version automatically (the thin
  shell's `package.json` declares `"@replybd/storefront-template": "^1.0.0"`).

- Tenants who deployed earlier get the new version when they click
  **"Redeploy"** in their Reply.BD dashboard. We can also expose an
  **"Update template"** affordance that bumps `VERCEL_TEMPLATE_VERSION`
  on their project and redeploys.

- A breaking-version bump (e.g. 1.x → 2.0.0) requires updating the Laravel
  config so newly-built tarballs depend on the right major:

  ```env
  VERCEL_TEMPLATE_VERSION="^2.0.0"
  ```

---

## Hot-fixing a tenant's site

If a tenant reports a bug specific to the storefront UI:

1. Reproduce locally (`npm run dev` with their slug in `.env.local`)
2. Fix in this repo, push to GitHub
3. `npm version patch && npm publish`
4. From the dashboard, click **Redeploy** for that tenant — they're back
   on the latest version in ~60 seconds

No tenant-side code changes needed.

---

## Unpublishing

`npm unpublish` is intentionally undocumented. If you publish a broken
version, **publish a patch over it** rather than unpublishing — npm's
72-hour unpublish window is restrictive and yanks can break tenant
installs that already pulled the bad version.
