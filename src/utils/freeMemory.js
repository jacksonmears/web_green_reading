

export function freeMemory(free, freeParticles, xyzPtr, outCountPtr, cellPtrPtr, cellCountPtr, floatPtr, cellPtr) {
    free(xyzPtr);
    free(outCountPtr);
    free(cellPtrPtr);
    free(cellCountPtr);
    if (freeParticles) freeParticles(floatPtr);
    if (freeParticles) freeParticles(cellPtr);
}