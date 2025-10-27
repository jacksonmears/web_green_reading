

export function initCanvas(canvasRef) {

    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas ref missing");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    return { ctx };
}