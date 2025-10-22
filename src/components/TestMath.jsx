import React, { useEffect, useState } from "react";

export default function TestMath() {
  const [status, setStatus] = useState("Loading WASM...");
  const [sum, setSum] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);

  const [moduleInstance, setModuleInstance] = useState(null);

  // ---- Load WebAssembly module ----
  useEffect(() => {
    import("../wasm/math.js")
      .then(async (createModule) => {
        const module = await createModule.default();
        setModuleInstance(module);

        const result = module._add(5, 8); // test function
        setSum(result);
        setStatus("WASM loaded successfully ✅");
      })
      .catch((err) => {
        console.error("Failed to load WASM module:", err);
        setStatus("Failed to load WASM module ❌");
      });
  }, []);



  // ---- Handle .xyz file upload ----
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

    if (!moduleInstance) {
      alert("WASM module not loaded yet!");
      return;
    }

    setStatus("Processing file in WASM...");

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const ptr = moduleInstance._malloc(bytes.length);
      moduleInstance.HEAPU8.set(bytes, ptr);

      moduleInstance.ccall(
        "parseXYZ",
        null,
        ["number", "number"],
        [ptr, bytes.length]
      );

      moduleInstance._free(ptr);

      setStatus(`File processed successfully ✅ (${bytes.length} bytes)`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to process file ❌");
    }
  };

  return (
    <div style={styles.container}>
      {/* WASM Demo */}
      <section style={styles.section}>
        <h2>🧮 Test Math WASM</h2>
        <p>{status}</p>
        {sum !== null && (
          <p>
            5 + 8 = <strong>{sum}</strong>
          </p>
        )}
      </section>

      {/* File Upload Box */}
      <section style={styles.section}>
        <h3>📁 Upload an .xyz File</h3>
        <input
          type="file"
          accept=".xyz"
          onChange={handleFileChange}
          style={styles.fileInput}
        />
        {fileName && (
          <p>
            ✅ Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)
          </p>
        )}
      </section>
    </div>
  );
}

// ---- Inline styles ----
const styles = {
  container: {
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "1.5rem",
    marginTop: "1.5rem",
    maxWidth: "600px",
  },
  section: {
    marginBottom: "1.5rem",
  },
  fileInput: {
    marginTop: "0.5rem",
  },
};
