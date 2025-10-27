


export function callParseXYZ(moduleInstance, buffer, malloc) {

    const bytes = new Uint8Array(buffer);
    
    const xyzPtr = malloc(bytes.length);
    if (!xyzPtr || xyzPtr === 0) {
    throw new Error("malloc returned invalid pointer: " + xyzPtr);
    }
    const heapU8 = new Uint8Array(moduleInstance.HEAPU8.buffer);
    heapU8.set(bytes, xyzPtr);

    const outCountPtr = malloc(4);
    const cellCountPtr = malloc(4);
    const cellPtrPtr = malloc(4);

    const parseXYZFlattened = moduleInstance.cwrap
        ? moduleInstance.cwrap("parseXYZFlattened", "number", ["number", "number", "number", "number", "number"])
        : null;
    
    const freeParticles = moduleInstance.cwrap ? moduleInstance.cwrap("freeParticles", null, ["number"]) : null;

    if (!parseXYZFlattened) {
        throw new Error("parseXYZFlattened not exported by WASM");
    }

    const floatPtr = parseXYZFlattened(xyzPtr, bytes.length, outCountPtr, cellPtrPtr, cellCountPtr);

    const outCount = new Int32Array(moduleInstance.HEAP32.buffer, outCountPtr, 1)[0];
    const cellCount = new Int32Array(moduleInstance.HEAP32.buffer, cellCountPtr, 1)[0];
    const cellPtr = new Int32Array(moduleInstance.HEAP32.buffer, cellPtrPtr, 1)[0];

    const floats = new Float32Array(moduleInstance.HEAPF32.buffer, floatPtr, outCount * 6);
    const cells = new Float32Array(moduleInstance.HEAPF32.buffer, cellPtr, cellCount * 16);

    return { floatPtr, outCount, cellCount, cellPtr, freeParticles, outCountPtr, cellCountPtr, cellPtrPtr, floats, cells, xyzPtr, bytes };
}
