// Godot's WASM exceeds Workers' 25 MiB asset limit. Reassemble the exact
// release binary from smaller static assets before the engine consumes it.
(() => {
  const target = new URL("index.wasm", document.baseURI);
  const parts = ["index.wasm.parta", "index.wasm.partb"];
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
    if (url.href !== target.href) return nativeFetch(input, init);

    const responses = await Promise.all(
      parts.map((part) => nativeFetch(new URL(part, document.baseURI), init)),
    );
    const failed = responses.find((response) => !response.ok);
    if (failed) return failed;

    const blob = new Blob(await Promise.all(responses.map((response) => response.blob())));
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/wasm",
        "Content-Length": String(blob.size),
      },
    });
  };
})();
