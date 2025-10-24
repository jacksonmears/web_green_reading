import React, { useEffect, useState, useRef } from "react";

export default function TestMath() {
  const [status, setStatus] = useState("Loading WASM...");
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [particleCount, setParticleCount] = useState(null);

  const [moduleInstance, setModuleInstance] = useState(null);
  const [malloc, setMalloc] = useState(null);
  const [free, setFree] = useState(null);

  const canvasRef = useRef(null);

  // helper: is the module ready for use?
  const ready = !!moduleInstance && typeof malloc === "function" && typeof free === "function";

  useEffect(() => {
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

        // Debug: inspect exported keys (useful in console)
        try {
          const keys = Object.keys(module).filter((k) => k && k.length > 0);
          console.log("✅ WASM module object keys (sample):", keys.slice(0, 80));
        } catch (e) {
          console.warn("Could not list module keys:", e);
        }

        // Try to create wrappers via cwrap, but fallback to raw _malloc/_free exports
        let maybeMalloc = null;
        let maybeFree = null;

        if (typeof module.cwrap === "function") {
          try {
            // cwrap returns a JS function that calls into the C function
            const cwrapMalloc = module.cwrap("malloc", "number", ["number"]);
            const cwrapFree = module.cwrap("free", null, ["number"]);
            if (typeof cwrapMalloc === "function") maybeMalloc = (n) => cwrapMalloc(n);
            if (typeof cwrapFree === "function") maybeFree = (p) => cwrapFree(p);
            console.log("🔧 Using cwrap() for malloc/free");
          } catch (e) {
            console.warn("cwrap malloc/free failed:", e);
          }
        }

        // fallback to raw Emscripten exported functions, which are usually named _malloc/_free
        if (!maybeMalloc && typeof module._malloc === "function") {
          maybeMalloc = (n) => module._malloc(n);
          console.log("🔧 Falling back to module._malloc");
        }
        if (!maybeFree && typeof module._free === "function") {
          maybeFree = (p) => module._free(p);
          console.log("🔧 Falling back to module._free");
        }

        // Set states
        setModuleInstance(module);
        setMalloc(() => (maybeMalloc ? maybeMalloc : null));
        setFree(() => (maybeFree ? maybeFree : null));

        // sanity test if available
        if (module._add || module.cwrap?.("add", "number", ["number", "number"])) {
          try {
            // prefer a quick direct call to confirm runtime works
            const addFn =
              typeof module._add === "function"
                ? (a, b) => module._add(a, b)
                : typeof module.cwrap === "function"
                ? module.cwrap("add", "number", ["number", "number"])
                : null;
            if (addFn) console.log("Test add(2,3) =>", addFn(2, 3));
          } catch (err) {
            console.warn("Test add() failed:", err);
          }
        }

        setStatus("WASM loaded (init done) — check console for details");
      })
      .catch((err) => {
        console.error("❌ Failed to load WASM module:", err);
        setStatus("Failed to load WASM module ❌ (see console)");
      });
  }, []);

  // Handle .xyz file upload
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // if (!file.name.toLowerCase().endsWith(".xyz")) {
    //   alert("Please upload a valid .xyz file.");
    //   event.target.value = "";
    //   return;
    // }

    setFileName(file.name);
    setFileSize(file.size);

    if (!ready) {
      alert("WASM module not ready yet. Look at console to see what's missing.");
      console.warn("WASM readiness:", { moduleInstance, hasMalloc: typeof malloc, hasFree: typeof free });
      return;
    }

    setStatus("Processing file in WASM...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Wrap WASM functions
      // NOTE: your parseXYZFlattened must be exported from the C code (exposed to JS)
      const parseXYZFlattened = moduleInstance.cwrap
        ? moduleInstance.cwrap("parseXYZFlattened", "number", ["number", "number", "number"])
        : null;
      const freeParticles = moduleInstance.cwrap ? moduleInstance.cwrap("freeParticles", null, ["number"]) : null;

      if (!parseXYZFlattened) {
        console.error("parseXYZFlattened not available. Module keys:", Object.keys(moduleInstance).slice(0, 50));
        setStatus("parseXYZFlattened not exported by WASM ❌ (see console)");
        return;
      }

      // Allocate memory in WASM
      const xyzPtr = malloc(bytes.length); // our malloc wrapper
      if (!xyzPtr || xyzPtr === 0) {
        throw new Error("malloc returned invalid pointer: " + xyzPtr);
      }
      const heapU8 = new Uint8Array(moduleInstance.HEAPU8.buffer);
      heapU8.set(bytes, xyzPtr);

      const outCountPtr = malloc(4); // int32 for particle count
      const floatPtr = parseXYZFlattened(xyzPtr, bytes.length, outCountPtr);

      const outCount = new Int32Array(moduleInstance.HEAP32.buffer, outCountPtr, 1)[0];
      if (!outCount || outCount <= 0) {
        console.warn("outCount is zero or invalid:", outCount);
      }
      const floats = new Float32Array(moduleInstance.HEAPF32.buffer, floatPtr, outCount * 6);

      // --- Compute bounding box ---
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < outCount; i++) {
        const x = floats[i * 6 + 0]; // X
        const z = floats[i * 6 + 2]; // Z
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      const width = maxX - minX;
      const height = maxZ - minZ;
      const scaleSize = 800 - 2 * 10; // canvas size minus padding
      const maxDim = Math.max(width || 1, height || 1);
      const scale = scaleSize / maxDim;

      // Compute leftover space for centering
      const xOffset = (scaleSize - width * scale) / 2;
      const yOffset = (scaleSize - height * scale) / 2;

      // Render particles
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas ref missing");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // quick debug: log first particle if any
      if (outCount > 0) {
        console.log("First particle floats:", floats.slice(0, Math.min(6, floats.length)));
      }

      for (let i = 0; i < outCount; i++) {
        const xRaw = floats[i * 6 + 0];
        const zRaw = floats[i * 6 + 2];
        const r = floats[i * 6 + 3];
        const g = floats[i * 6 + 4];
        const b = floats[i * 6 + 5];

        // Map coordinates: X increases left→right, Z increases top→bottom
        const x = 10 + xOffset + (xRaw - minX) * scale;
        const y = 10 + yOffset + (zRaw - minZ) * scale;

        ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }

      // Free WASM memory
      free(xyzPtr);
      free(outCountPtr);
      if (freeParticles) freeParticles(floatPtr);

      setParticleCount(outCount);
      setStatus(`File rendered successfully ✅ (${bytes.length} bytes, ${outCount} particles)`);
    } catch (err) {
      console.error("Processing error:", err);
      setStatus("Failed to process file ❌ (see console)");
    }
  };

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h3>testing, version 1.5</h3>
        <h3>📁 Upload an .xyz File</h3>

        {/* Ready indicators so you can see what's missing */}
        <div style={{ marginBottom: 8 }}>
          <small>
            WASM ready: <strong style={{ color: ready ? "green" : "crimson" }}>{ready ? "yes" : "no"}</strong> —{" "}
            module: {moduleInstance ? "loaded" : "not loaded"}, malloc: {typeof malloc}, free: {typeof free}
          </small>
        </div>

        <input
          type="file"
          accept="*"
          onChange={handleFileChange}
          style={styles.fileInput}
          disabled={!ready}
        />
        {fileName && (
          <p>
            ✅ Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)
          </p>
        )}
        {particleCount && (
          <p>
            🧩 Rendered particles: <strong>{particleCount}</strong>
          </p>
        )}
        <p>{status}</p>
      </section>

      <canvas
        ref={canvasRef}
        id="canvas"
        width={800}
        height={800}
        style={{ border: "1px solid black", display: "block", marginTop: "1rem" }}
      />
    </div>
  );
}

const styles = {
  container: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "1.5rem",
    marginTop: "1.5rem",
    maxWidth: "820px",
  },
  section: { marginBottom: "1.5rem" },
  fileInput: { marginTop: "0.5rem" },
};
