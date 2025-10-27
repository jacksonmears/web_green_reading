

export function callConfig(outCount, floats) {
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

    return { minX, minZ, scale, xOffset, yOffset };
}