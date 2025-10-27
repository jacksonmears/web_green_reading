import { useState, useEffect } from "react";

export function useWasmModule(setStatus) {
  const [moduleInstance, setModuleInstance] = useState(null);
  const [malloc, setMalloc] = useState(null);
  const [free, setFree] = useState(null);

  // helper: is module ready?
  const ready =
    !!moduleInstance &&
    typeof malloc === "function" &&
    typeof free === "function";

  useEffect(() => {
    let cancelled = false;

    import("../wasm/main.js")
      .then(async (createModule) => {
        console.log("⏳ Initializing WASM module...");
        const module = await createModule.default({
          locateFile: (path) => {
            const resolved = `${import.meta.env.BASE_URL}wasm/${path}`;
            console.log("🔍 locateFile resolved:", resolved);
            return resolved;
          },
        });

        if (cancelled) return;

        try {
          const keys = Object.keys(module).filter(Boolean);
          console.log("✅ WASM module object keys (sample):", keys.slice(0, 80));
        } catch (e) {
          console.warn("Could not list module keys:", e);
        }

        let maybeMalloc = null;
        let maybeFree = null;

        if (typeof module.cwrap === "function") {
          try {
            const cwrapMalloc = module.cwrap("malloc", "number", ["number"]);
            const cwrapFree = module.cwrap("free", null, ["number"]);
            if (typeof cwrapMalloc === "function") maybeMalloc = (n) => cwrapMalloc(n);
            if (typeof cwrapFree === "function") maybeFree = (p) => cwrapFree(p);
            console.log("🔧 Using cwrap() for malloc/free");
          } catch (e) {
            console.warn("cwrap malloc/free failed:", e);
          }
        }

        if (!maybeMalloc && typeof module._malloc === "function") {
          maybeMalloc = (n) => module._malloc(n);
          console.log("🔧 Falling back to module._malloc");
        }
        if (!maybeFree && typeof module._free === "function") {
          maybeFree = (p) => module._free(p);
          console.log("🔧 Falling back to module._free");
        }

        setModuleInstance(module);
        setMalloc(() => (maybeMalloc ? maybeMalloc : null));
        setFree(() => (maybeFree ? maybeFree : null));
        setStatus?.("WASM loaded (init done) — check console for details");
      })
      .catch((err) => {
        console.error("❌ Failed to load WASM module:", err);
        setStatus?.("Failed to load WASM module ❌ (see console)");
      });

    return () => {
      cancelled = true;
    };
  }, [setStatus]);

  return { moduleInstance, malloc, free, ready };
}
