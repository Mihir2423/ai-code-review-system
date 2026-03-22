export function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('Shader error:', gl.getShaderInfoLog(s));
    return s;
}

export function loadTexture(gl: WebGLRenderingContext, url: string, unit: number, onSize?: (w: number, h: number) => void) {
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    const img = new Image();
    img.onload = () => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        onSize?.(img.naturalWidth, img.naturalHeight);
    };
    img.src = url;
}

export function coverTransform(texW: number, texH: number, canW: number, canH: number): [number, number, number, number] {
    const canAspect = canW / canH;
    const texAspect = texW / texH;

    let scaleX: number, scaleY: number;
    if (canAspect > texAspect) {
        scaleX = 1;
        scaleY = texAspect / canAspect;
    } else {
        scaleX = canAspect / texAspect;
        scaleY = 1;
    }
    const offsetX = (1 - scaleX) / 2;
    const offsetY = (1 - scaleY) / 2;
    return [scaleX, scaleY, offsetX, offsetY];
}
