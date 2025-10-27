

export function handleFilePrecheck(event, { ready, moduleInstance, malloc, free, setFileName, setFileSize, setStatus}) {
  const file = event.target.files?.[0];
  if (!file) {
    console.warn("No file selected");
    return { ok: false };
  }

  setFileName(file.name);
  setFileSize(file.size);

  if (!ready) {
    alert("WASM module not ready yet. Look at console to see what's missing.");
    console.warn("WASM readiness:", {
      moduleInstance,
      hasMalloc: typeof malloc,
      hasFree: typeof free,
    });
    return { ok: false };
  }

  setStatus("Processing file in WASM...");
  return { ok: true, file };
}
