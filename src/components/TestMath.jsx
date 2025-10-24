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

  const ready = !!moduleInstance && typeof malloc === "function" && typeof free === "function";

  useEffect(() => {
    import("../wasm/main.js")
      .then(async (createModule) => {
        const module = await createModule.default({
          locateFile: (path) => `${import.meta.env.BASE_URL}wasm/${path}`,
        });

        let maybeMalloc = module.cwrap?.("malloc", "number", ["number"]) || module._malloc;
        let maybeFree = module.cwrap?.("free", null, ["number"]) || module._free;

        setModuleInstance(module);
        setMalloc(() => maybeMalloc);
        setFree(() => maybeFree);

        setStatus("WASM loaded (init done)");
      })
      .catch((err) => {
        console.error("Failed to load WASM module:", err);
        setStatus("Failed to load WASM module ❌");
      });
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    if (!ready) {
      alert("WASM module not ready yet.");
      return;
    }

    setStatus("Processing file in WASM...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const parseXYZFlattened = moduleInstance.cwrap
        ? moduleInstance.cwrap("parseXYZFlattened", "number", ["number", "number", "number"])
        : null;
      const freeParticles = moduleInstance.cwrap ? moduleInstance.cwrap("freeParticles", null, ["number"]) : null;

      const xyzPtr = malloc(bytes.length);
      const heapU8 = new Uint8Array(moduleInstance.HEAPU8.buffer);
      heapU8.set(bytes, xyzPtr);

      const outCountPtr = malloc(4);
      const floatPtr = parseXYZFlattened(xyzPtr, bytes.length, outCountPtr);

      const outCount = new Int32Array(moduleInstance.HEAP32.buffer, outCountPtr, 1)[0];
      const particles = new Float32Array(moduleInstance.HEAPF32.buffer, floatPtr, outCount * 6);

      // calculate number of cells
      const totalBytes = moduleInstance.HEAPF32.buffer.byteLength;
      const cellsBufferOffset = floatPtr + outCount * 6 * 4;
      const remainingFloats = (totalBytes - cellsBufferOffset) / 4;
      const cellCountLocal = Math.floor(remainingFloats / 16);
      const cells = new Float32Array(moduleInstance.HEAPF32.buffer, cellsBufferOffset, cellCountLocal * 16);

      setParticleCount(outCount);
      setCellCount(cellCountLocal);

      // compute bounding box for X and Z (2D projection)
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < outCount; i++) {
        const x = particles[i * 6 + 0];
        const z = particles[i * 6 + 2];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }

      const width = maxX - minX || 1;
      const height = maxZ - minZ || 1;
      const scaleSize = 800 - 2 * 10;
      const scale = scaleSize / Math.max(width, height);
      const xOffset = (scaleSize - width * scale) / 2;
      const yOffset = (scaleSize - height * scale) / 2;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // draw particles
      for (let i = 0; i < outCount; i++) {
        const x = 10 + xOffset + (particles[i * 6 + 0] - minX) * scale;
        const y = 10 + yOffset + (particles[i * 6 + 2] - minZ) * scale;
        const r = particles[i * 6 + 3];
        const g = particles[i * 6 + 4];
        const b = particles[i * 6 + 5];

        ctx.fillStyle = `rgb(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)})`;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }

      // draw arrows properly aligned with particles
      // for (let i = 0; i < cellCountLocal; i++) {
      //   const base = i * 16;
      //   if (cells[base + 15] !== 1.0) continue; // valid flag

      //   const startX = 10 + xOffset + (cells[base + 12] - minX) * scale; // xBar
      //   const startY = 10 + yOffset + (cells[base + 14] - minZ) * scale; // zBar
      //   const endX = 10 + xOffset + (cells[base + 8] - minX) * scale;
      //   const endY = 10 + yOffset + (cells[base + 10] - minZ) * scale;
      //   const color = cells[base + 11];

      //   // line
      //   ctx.strokeStyle = `rgb(${Math.floor(color * 255)},0,${Math.floor((1 - color) * 255)})`;
      //   ctx.lineWidth = 1.5;
      //   ctx.beginPath();
      //   ctx.moveTo(startX, startY);
      //   ctx.lineTo(endX, endY);
      //   ctx.stroke();

      //   // arrowhead
      //   const ARROW_SIZE = 5;
      //   const angle = Math.atan2(endY - startY, endX - startX);
      //   const leftX = endX - ARROW_SIZE * Math.cos(angle - Math.PI / 6);
      //   const leftY = endY - ARROW_SIZE * Math.sin(angle - Math.PI / 6);
      //   const rightX = endX - ARROW_SIZE * Math.cos(angle + Math.PI / 6);
      //   const rightY = endY - ARROW_SIZE * Math.sin(angle + Math.PI / 6);

      //   ctx.beginPath();
      //   ctx.moveTo(endX, endY);
      //   ctx.lineTo(leftX, leftY);
      //   ctx.lineTo(rightX, rightY);
      //   ctx.lineTo(endX, endY);
      //   ctx.fillStyle = `rgb(${Math.floor(color * 255)},0,${Math.floor((1 - color) * 255)})`;
      //   ctx.fill();
      // }

      free(xyzPtr);
      free(outCountPtr);
      if (freeParticles) freeParticles(floatPtr);

      setStatus(`File rendered ✅ (${bytes.length} bytes, ${outCount} particles, ${cellCountLocal} arrows)`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to process file ❌");
    }
  };

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h3>testing, version 2.2</h3>
        <h3>📁 Upload an .xyz File</h3>

        <div style={{ marginBottom: 8 }}>
          <small>
            WASM ready: <strong style={{ color: ready ? "green" : "crimson" }}>{ready ? "yes" : "no"}</strong> — module: {moduleInstance ? "loaded" : "not loaded"}, malloc: {typeof malloc}, free: {typeof free}
          </small>
        </div>

        <input type="file" accept="*" onChange={handleFileChange} style={styles.fileInput} disabled={!ready} />
        {fileName && <p>✅ Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)</p>}
        {particleCount && <p>🧩 Rendered particles: <strong>{particleCount}</strong></p>}
        {cellCount && <p>📐 Rendered arrows: <strong>{cellCount}</strong></p>}
        <p>{status}</p>
      </section>

      <canvas ref={canvasRef} width={800} height={800} style={{ border: "1px solid black", display: "block", marginTop: "1rem" }} />
    </div>
  );
}

const styles = {
  container: { border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", marginTop: "1.5rem", maxWidth: "820px" },
  section: { marginBottom: "1.5rem" },
  fileInput: { marginTop: "0.5rem" },
};
