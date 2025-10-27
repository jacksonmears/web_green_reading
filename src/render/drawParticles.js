

export function drawParticles(floats, ctx, outCount, xOffset, yOffset, minX, minZ, scale) {
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
}