import React, { useEffect, useState, useRef } from "react";

export default function TestMath() {
  const [status, setStatus] = useState("Loading WASM...");
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [particleCount, setParticleCount] = useState(null);
  const [cellCount, setCellCount] = useState(null);

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

        try {
          const keys = Object.keys(module).filter((k) => k && k.length > 0);
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

        if (module._add || module.cwrap?.("add", "number", ["number", "number"])) {
          try {
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

      const parseXYZFlattened = moduleInstance.cwrap
        ? moduleInstance.cwrap("parseXYZFlattened", "number", ["number", "number", "number", "number", "number"])
        : null;
      const freeParticles = moduleInstance.cwrap ? moduleInstance.cwrap("freeParticles", null, ["number"]) : null;

      if (!parseXYZFlattened) {
        console.error("parseXYZFlattened not available. Module keys:", Object.keys(moduleInstance).slice(0, 50));
        setStatus("parseXYZFlattened not exported by WASM ❌ (see console)");
        return;
      }

      const xyzPtr = malloc(bytes.length);
      if (!xyzPtr || xyzPtr === 0) {
        throw new Error("malloc returned invalid pointer: " + xyzPtr);
      }
      const heapU8 = new Uint8Array(moduleInstance.HEAPU8.buffer);
      heapU8.set(bytes, xyzPtr);

      const outCountPtr = malloc(4);
      const cellCountPtr = malloc(4);
      const cellPtrPtr = malloc(4);

      const floatPtr = parseXYZFlattened(xyzPtr, bytes.length, outCountPtr, cellPtrPtr, cellCountPtr);

      const outCount = new Int32Array(moduleInstance.HEAP32.buffer, outCountPtr, 1)[0];
      const cellCount = new Int32Array(moduleInstance.HEAP32.buffer, cellCountPtr, 1)[0];
      const cellPtr = new Int32Array(moduleInstance.HEAP32.buffer, cellPtrPtr, 1)[0];

      const floats = new Float32Array(moduleInstance.HEAPF32.buffer, floatPtr, outCount * 6);
      const cells = new Float32Array(moduleInstance.HEAPF32.buffer, cellPtr, cellCount * 16);

      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < outCount; i++) {
        const x = floats[i * 6 + 0];
        const z = floats[i * 6 + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }

      const width = maxX - minX;
      const height = maxZ - minZ;
      const scaleSize = 800 - 2 * 10;
      const maxDim = Math.max(width || 1, height || 1);
      const scale = scaleSize / maxDim;
      const xOffset = (scaleSize - width * scale) / 2;
      const yOffset = (scaleSize - height * scale) / 2;

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas ref missing");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (outCount > 0) {
        console.log("First particle floats:", floats.slice(0, Math.min(6, floats.length)));
      }

      for (let i = 0; i < outCount; i++) {
        const xRaw = floats[i * 6 + 0];
        const zRaw = floats[i * 6 + 2];
        const r = floats[i * 6 + 3];
        const g = floats[i * 6 + 4];
        const b = floats[i * 6 + 5];

        const x = 10 + xOffset + (xRaw - minX) * scale;
        const y = 10 + yOffset + (zRaw - minZ) * scale;

        ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }

      // Draw cells (black dot at centroid)
      for (let i = 0; i < cellCount; i++) {
        const idx = i * 16;
        const p = {
          xBar: cells[idx + 12],
          zBar: cells[idx + 14],
          slopePercent: cells[idx + 5],
          dx: cells[idx + 6],   // normalized slope x-component
          dz: cells[idx + 7],   // normalized slope z-component
          valid: cells[idx + 15] === 1
        };

        // Skip invalid cells
        if (!p.valid || p.slopePercent < 2) continue;

        const cx = 10 + xOffset + (p.xBar - minX) * scale;
        const cy = 10 + yOffset + (p.zBar - minZ) * scale;

        // ctx.fillStyle = "black";
        // ctx.fillRect(Math.round(cx), Math.round(cy), 5, 5); // slightly bigger dot for visibility

        const arrowLength = 20; // fixed length for all arrows
        const headLength = 5;   // arrowhead size

        // normalize slope vector
        const len = Math.sqrt(p.dx * p.dx + p.dz * p.dz) || 1;
        const nx = (p.dx / len) * arrowLength;
        const ny = (p.dz / len) * arrowLength;

        const ax = cx + nx;
        const ay = cy + ny;

        console.log(p.dx, p.dz, ax, ay);

        // draw line
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // draw arrowhead
        const angle = Math.atan2(ny, nx);
        ctx.beginPath();
        ctx.moveTo(ax - headLength * Math.cos(angle - Math.PI / 6),
                  ay - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax - headLength * Math.cos(angle + Math.PI / 6),
                  ay - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        // // Draw upward arrow
        // const arrowLength = 10; // pixels
        // ctx.strokeStyle = "black";
        // ctx.lineWidth = 2;
        // ctx.beginPath();
        // ctx.moveTo(cx, cy);                // start at centroid
        // ctx.lineTo(cx+(arrowLength), cy + 0);  // line upward
        // ctx.stroke();

        // Draw simple arrowhead
        // ctx.beginPath();
        // ctx.moveTo(cx - 2, cy - arrowLength + 4);
        // ctx.lineTo(cx, cy - arrowLength);
        // ctx.lineTo(cx + 2, cy - arrowLength + 4);
        // ctx.stroke();

        // // Fixed-length slope arrow pointing in slope direction
        // const arrowLength = 20; // constant length
        // const len = Math.sqrt(p.dx*p.dx + p.dz*p.dz) || 1; // normalize
        // const ax = cx + (p.dx / len) * arrowLength;
        // const ay = cy + (p.dz / len) * arrowLength; // z → y

        // ctx.strokeStyle = "black";
        // ctx.lineWidth = 2;
        // ctx.beginPath();
        // ctx.moveTo(cx, cy);
        // ctx.lineTo(ax, ay);
        // ctx.stroke();

        // // Draw simple arrowhead
        // const angle = Math.atan2(ay - cy, ax - cx);
        // const headLength = 5;
        // ctx.beginPath();
        // ctx.moveTo(ax - headLength * Math.cos(angle - Math.PI / 6),
        //           ay - headLength * Math.sin(angle - Math.PI / 6));
        // ctx.lineTo(ax, ay);
        // ctx.lineTo(ax - headLength * Math.cos(angle + Math.PI / 6),
        //           ay - headLength * Math.sin(angle + Math.PI / 6));
        // ctx.stroke();


      }



      free(xyzPtr);
      free(outCountPtr);
      free(cellPtrPtr);
      free(cellCountPtr);
      if (freeParticles) freeParticles(floatPtr);
      if (freeParticles) freeParticles(cellPtr);

      setParticleCount(outCount);
      setCellCount(cellCount);
      setStatus(`File rendered successfully ✅ (${bytes.length} bytes, ${outCount} particles, ${cellCount} cells)`);
    } catch (err) {
      console.error("Processing error:", err);
      setStatus("Failed to process file ❌ (see console)");
    }
  };

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h3>testing, version 2.6</h3>
        <h3>📁 Upload an .xyz File</h3>

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
        {cellCount && (
          <p>
            🟦 Cell buffer length: <strong>{cellCount}</strong>
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
