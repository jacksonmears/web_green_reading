import React, { useEffect, useState } from "react";

export default function TestMath() {
  const [status, setStatus] = useState("Loading WASM...");
  const [sum, setSum] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [particleCount, setParticleCount] = useState(null);

  const [moduleInstance, setModuleInstance] = useState(null);
  const [malloc, setMalloc] = useState(null);
  const [free, setFree] = useState(null);
  const [parseXYZ, setParseXYZ] = useState(null);

  useEffect(() => {
    import("../wasm/main.js")
      .then(async (createModule) => {
        const module = await createModule.default();

        // Wrap exported functions
        setMalloc(() => module.cwrap("malloc", "number", ["number"]));
        setFree(() => module.cwrap("free", null, ["number"]));
        setParseXYZ(() => module.cwrap("parseXYZ", "number", ["number", "number"]));

        setModuleInstance(module);

        // Optional test
        const result = module._add ? module._add(5, 8) : "(no _add exported)";
        setSum(result);
        setStatus("WASM loaded successfully ✅");
      })
      .catch((err) => {
        console.error(err);
        setStatus("Failed to load WASM module ❌");
      });
  }, []);

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

    if (!moduleInstance || !malloc || !free || !parseXYZ) {
      alert("WASM module not loaded yet!");
      return;
    }

    setStatus("Processing file in WASM...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Allocate memory using cwrap-wrapped malloc
      const ptr = malloc(bytes.length);

      // Get HEAPU8 from the WASM module correctly
      const heap = new Uint8Array(moduleInstance.HEAPU8.buffer);
      heap.set(bytes, ptr);

      // Call the C++ function using cwrap
      const count = parseXYZ(ptr, bytes.length);

      // Free allocated memory
      free(ptr);

      setParticleCount(count);
      setStatus(`File processed successfully ✅ (${bytes.length} bytes)`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to process file ❌");
    }
  };


  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h2>🧮 Test Math WASM</h2>
        <p>{status}</p>
        {sum !== null && <p>5 + 8 = <strong>{sum}</strong></p>}
      </section>

      <section style={styles.section}>
        <h3>📁 Upload an .xyz File</h3>
        <input
          type="file"
          accept=".xyz"
          onChange={handleFileChange}
          style={styles.fileInput}
          disabled={!moduleInstance || !malloc || !free || !parseXYZ}
        />
        {fileName && <p>✅ Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)</p>}
        {particleCount !== null && <p>🧩 Parsed particles: <strong>{particleCount}</strong></p>}
      </section>
    </div>
  );
}

const styles = {
  container: { border: "1px solid #ccc", borderRadius: "8px", padding: "1.5rem", marginTop: "1.5rem", maxWidth: "600px" },
  section: { marginBottom: "1.5rem" },
  fileInput: { marginTop: "0.5rem" },
};
