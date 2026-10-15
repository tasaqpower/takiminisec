// Browser side WASM CFR encode snippet extracted from generate-prototype-evidence.mjs
// Architecture: Raw RGBA canvas frame -> YUV420p -> libx264 ultrafast + aac 192k -> MP4
const mod = await import('/wasm/ffmpeg/ffmpeg-core.js');
const createCore = mod.default || mod.createFFmpegCore || window.createFFmpegCore;
const core = await createCore({
  mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }))
});
// Exact CFR flags:
// -framerate 30 -i input.yuv -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart output.mp4
