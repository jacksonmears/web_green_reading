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

  // Load WASM
  useEffect(() => {
    import("../wasm/main.js")
      .then(async (createModule) => {
        const module = await createModule.default({
          locateFile: (path) => {
            return `${import.meta.env.BASE_URL}wasm/${path}`;
          },
        });


        setMalloc(() => module.cwrap("malloc", "number", ["number"]));
        setFree(() => module.cwrap("free", null, ["number"]));
        setModuleInstance(module);
        setStatus("WASM loaded successfully ✅");
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to load WASM module ❌");
      });
  }, []);

  // Handle .xyz file upload
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xyz")) {
      alert("Please upload a valid .xyz file.");
      event.target.value = "";
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    if (!moduleInstance || !malloc || !free) {
      alert("WASM module not loaded yet!");
      return;
    }

    setStatus("Processing file in WASM...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Wrap WASM functions
      const parseXYZFlattened = moduleInstance.cwrap(
        "parseXYZFlattened",
        "number",          
        ["number", "number", "number"]
      );
      const freeParticles = moduleInstance.cwrap("freeParticles", null, ["number"]);

      // Allocate memory in WASM
      const xyzPtr = malloc(bytes.length);
      const heapU8 = new Uint8Array(moduleInstance.HEAPU8.buffer);
      heapU8.set(bytes, xyzPtr);

      const outCountPtr = malloc(4); // int32 for particle count
      const floatPtr = parseXYZFlattened(xyzPtr, bytes.length, outCountPtr);

      const outCount = new Int32Array(moduleInstance.HEAP32.buffer, outCountPtr, 1)[0];
      const floats = new Float32Array(moduleInstance.HEAPF32.buffer, floatPtr, outCount * 6);

      // --- Compute bounding box ---
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
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
      const maxDim = Math.max(width, height);
      const scale = scaleSize / maxDim;

      // Compute leftover space for centering
      const xOffset = (scaleSize - width * scale) / 2;
      const yOffset = (scaleSize - height * scale) / 2;

      // Render particles
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < outCount; i++) {
        const xRaw = floats[i * 6 + 0];
        const zRaw = floats[i * 6 + 2];
        const r = floats[i * 6 + 3];
        const g = floats[i * 6 + 4];
        const b = floats[i * 6 + 5];

        const x = 10 + xOffset + ((xRaw - minX) * scale); // flip X if needed: (maxX - xRaw)
        const y = 10 + yOffset + ((zRaw - minZ) * scale); // invert Z for top-down

        ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
        ctx.fillRect(x, y, 1, 1);
      }


      // Free WASM memory
      free(xyzPtr);
      free(outCountPtr);
      freeParticles(floatPtr);

      setParticleCount(outCount);
      setStatus(`File rendered successfully ✅ (${bytes.length} bytes, ${outCount} particles)`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to process file ❌");
    }
  };

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h3>📁 Upload an .xyz File</h3>
        <input
          type="file"
          accept=".xyz"
          onChange={handleFileChange}
          style={styles.fileInput}
          disabled={!moduleInstance || !malloc || !free}
        />
        {fileName && <p>✅ Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)</p>}
        {particleCount && <p>🧩 Rendered particles: <strong>{particleCount}</strong></p>}
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
    maxWidth: "820px"
  },
  section: { marginBottom: "1.5rem" },
  fileInput: { marginTop: "0.5rem" },
};
