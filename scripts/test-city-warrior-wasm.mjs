import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const directory = new URL("../public/embedded/city-warrior/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("release.json", directory), "utf8"));
for (const [name, artifact] of Object.entries(manifest.files)) {
  const data = await readFile(new URL(name, directory));
  assert.equal(data.byteLength, artifact.bytes);
  assert(data.byteLength < 25 * 1024 * 1024, `${name} exceeds the Workers asset limit`);
  assert.equal(createHash("sha256").update(data).digest("hex"), artifact.sha256);
}
const html = await readFile(new URL("index.html", directory), "utf8");
assert(html.indexOf('src="cloudflare-wasm.js"') >= 0);
assert(html.indexOf('src="cloudflare-wasm.js"') < html.indexOf('src="index.js"'));
let failPart = false;
const calls = [];
const nativeFetch = async (input) => {
  const url = new URL(input instanceof Request ? input.url : String(input), "https://example.test/embedded/city-warrior/index.html");
  calls.push(url.pathname);
  if (failPart && url.pathname.endsWith(".partb")) return new Response("Missing", { status: 404 });
  if (url.pathname.endsWith(".parta") || url.pathname.endsWith(".partb")) {
    return new Response(await readFile(new URL(url.pathname.split("/").at(-1), directory)));
  }
  return new Response("passthrough");
};
const window = { fetch: nativeFetch };
vm.runInNewContext(await readFile(new URL("cloudflare-wasm.js", directory), "utf8"), {
  window, document: { baseURI: "https://example.test/embedded/city-warrior/index.html" },
  URL, Request, Response, Blob,
});

for (const input of ["index.wasm", new URL("https://example.test/embedded/city-warrior/index.wasm"), new Request("https://example.test/embedded/city-warrior/index.wasm")]) {
  const response = await window.fetch(input);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/wasm");
  const bytes = await response.arrayBuffer();
  assert.equal(Number(response.headers.get("Content-Length")), bytes.byteLength);
  assert.equal(createHash("sha256").update(new Uint8Array(bytes)).digest("hex"), manifest.wasm_sha256);
  if (input === "index.wasm") assert((await WebAssembly.compile(bytes)) instanceof WebAssembly.Module);
}
assert.equal(await (await window.fetch("index.pck")).text(), "passthrough");
assert.equal(await (await window.fetch("https://other.test/index.wasm")).text(), "passthrough");
failPart = true;
assert.equal((await window.fetch("index.wasm")).status, 404);
assert(calls.some((path) => path.endsWith(".parta")));
console.log("CITY_WARRIOR_WASM_TEST_PASS");
