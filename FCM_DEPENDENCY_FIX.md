# FCM dependency fix

This project pins the transitive `jose` dependency to `5.10.0` through npm overrides.

Why: Firebase Admin 14.x currently pulls `jwks-rsa` 4.x, which CommonJS-loads `jose`.
`jose` 6 is ESM-only, producing `ERR_REQUIRE_ESM` in Vercel CommonJS serverless functions.
The pinned 5.10.0 release provides the CommonJS-compatible implementation required by that dependency path.

Deploy with Node.js 22+. Vercel will install dependencies from package-lock.json.
