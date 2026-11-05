# City Warrior release

Game source: `/Users/harryzhu/godot/city-warrior`.

Build the committed game in a clean worktree with `python3 tools/build_web.py`.
That command tests each of the three stages from the actual exported pack.
Import that release into this website:

```sh
python3 scripts/import-city-warrior.py /path/to/city-warrior/build/web --commit GAME_GIT_SHA
node scripts/test-city-warrior-wasm.mjs
npm run typecheck
npm run build
```

Commit the website route, lobby card, preview, importer/adapter/tests, and
`public/embedded/city-warrior/`. Pushing to `main` runs the existing checked
build and Cloudflare deployment workflow. Never publish unrelated working-tree
changes; use a clean website worktree when necessary.

The importer preserves the tested PCK and splits Godot's WASM into two assets
under Cloudflare's 25 MiB limit. `cloudflare-wasm.js` reconstructs the exact
binary for Godot's normal loader. The tests check string/URL/Request inputs,
error propagation, passthrough requests, SHA-256 equality, and WASM compilation.
`release.json` records the source commit and every deployed artifact's hash.

Play at `/city-warrior`; the existing Game Center password gate is unchanged.
The release uses Godot's single-threaded WebGL 2 template and needs no
SharedArrayBuffer/cross-origin-isolation headers. No service worker is enabled.
