


export function drawCellArrows(cellCount, ctx, cells, xOffset, yOffset, minX, minZ, scale) {
    for (let i = 0; i < cellCount; i++) {
        const idx = i * 16;
        const p = {
          xBar: cells[idx + 12],
          zBar: cells[idx + 14],
          slopePercent: cells[idx + 5],
          dx: cells[idx + 6],   // normalized slope x-component
          dz: cells[idx + 7],   // normalized slope z-component
          valid: cells[idx + 15] === 1
        };

        // Skip invalid cells
        if (!p.valid || p.slopePercent < 2) continue;

        const cx = 10 + xOffset + (p.xBar - minX) * scale;
        const cy = 10 + yOffset + (p.zBar - minZ) * scale;

        const arrowLength = 20; // fixed length for all arrows
        const headLength = 5;   // arrowhead size

        // normalize slope vector
        const len = Math.sqrt(p.dx * p.dx + p.dz * p.dz) || 1;
        const nx = (p.dx / len) * arrowLength;
        const ny = (p.dz / len) * arrowLength;

        const ax = cx + nx;
        const ay = cy + ny;

        // draw line
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        // draw arrowhead
        const angle = Math.atan2(ny, nx);
        ctx.beginPath();
        ctx.moveTo(ax - headLength * Math.cos(angle - Math.PI / 6),
                  ay - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax - headLength * Math.cos(angle + Math.PI / 6),
                  ay - headLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }
}