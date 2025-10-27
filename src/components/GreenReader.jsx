import { useState, useRef } from "react";
import { useWasmModule } from "../hooks/useWasmModule.js";
import { drawCellArrows } from "../render/drawCellArrows.js"
import { drawParticles } from "../render/drawParticles.js"
import { callParseXYZ } from "../utils/parseXYZ.js";
import { callConfig } from "../utils/config.js";
import { freeMemory } from "../utils/freeMemory.js";
import { initCanvas } from "../utils/initCanvas.js";
import { handleFilePrecheck } from "../utils/handleFilePrecheck.js";


export default function GreenReader() {
  const [status, setStatus] = useState(" Waiting for WASM...");
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [particleCount, setParticleCount] = useState(null);
  const [cellCount, setCellCount] = useState(null);
  const canvasRef = useRef(null);

  const { moduleInstance, malloc, free, ready } = useWasmModule(setStatus);

  const handleFileChange = async (event) => {
    const { ok, file } = handleFilePrecheck(event, {
      ready,
      moduleInstance,
      malloc,
      free,
      setFileName,
      setFileSize,
      setStatus,
    });

    if (!ok) return; 

    try {
      const buffer = await file.arrayBuffer();

      const { floatPtr, outCount, cellCount, cellPtr, freeParticles, 
              outCountPtr, cellCountPtr, cellPtrPtr, floats, cells, xyzPtr, bytes } = 
              callParseXYZ(moduleInstance, buffer, malloc);

      const { minX, minZ, scale, xOffset, yOffset } = callConfig(outCount, floats);

      const { ctx } = initCanvas(canvasRef);
      
      drawParticles(floats, ctx, outCount, xOffset, yOffset, minX, minZ, scale);

      drawCellArrows(cellCount, ctx, cells, xOffset, yOffset, minX, minZ, scale);

      freeMemory(free, freeParticles, xyzPtr, outCountPtr, cellPtrPtr, cellCountPtr, floatPtr, cellPtr);            

      setParticleCount(outCount);
      setCellCount(cellCount);
      setStatus(`File rendered successfully (${bytes.length} bytes, ${outCount} particles, ${cellCount} cells)`);
    } catch (err) {
      console.error("Processing error:", err);
      setStatus("Failed to process file (see console)");
    }
  };

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h3>testing, version 3.3</h3>
        <h3>Upload an .xyz File</h3>

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
            Uploaded file: <strong>{fileName}</strong> ({fileSize} bytes)
          </p>
        )}
        {particleCount && (
          <p>
            Rendered particles: <strong>{particleCount}</strong>
          </p>
        )}
        {cellCount && (
          <p>
            Cell buffer length: <strong>{cellCount}</strong>
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
