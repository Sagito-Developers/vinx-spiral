import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Image as ImageIcon, RefreshCcw, SlidersHorizontal, Upload } from "lucide-react";

// ---- Utility helpers ----
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

export default function SpiralPortraitApp() {
  const [img, setImg] = useState(null);
  const [imgURL, setImgURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloadURL, setDownloadURL] = useState("");
  const [error, setError] = useState("");

  // Controls
  const [turns, setTurns] = useState(140);
  const [lineSpacing, setLineSpacing] = useState(3);
  const [minWidth, setMinWidth] = useState(0.6);
  const [maxWidth, setMaxWidth] = useState(4.2);
  const [gamma, setGamma] = useState(1.15);
  const [invert, setInvert] = useState(false);
  const [cropToCircle, setCropToCircle] = useState(true);
  const [resolution, setResolution] = useState(2048);

  const inputRef = useRef(null);
  const canvasRef = useRef(null);
  const hiddenRef = useRef(null);

  // Load image
  const onFile = (file) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      setImg(im);
      setImgURL(url);
    };
    im.onerror = () => {
      setError("Couldn't load that image. Try another file.");
    };
    im.src = url;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith("image/")) {
        onFile(it.getAsFile());
        break;
      }
    }
  };

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const renderSpiral = async () => {
    if (!img || !canvasRef.current) return;
    setBusy(true);
    setError("");
    setDownloadURL("");

    const size = resolution;
    const canvas = canvasRef.current;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const hcan = hiddenRef.current;
    hcan.width = size;
    hcan.height = size;
    const hctx = hcan.getContext("2d");

    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    const scale = Math.min(size / img.width, size / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;

    hctx.clearRect(0, 0, size, size);
    hctx.drawImage(img, dx, dy, drawW, drawH);

    const imgData = hctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    const sample = (x, y) => {
      const ix = Math.floor(clamp(x, 0, size - 1));
      const iy = Math.floor(clamp(y, 0, size - 1));
      const idx = (iy * size + ix) * 4;
      const r = data[idx + 0];
      const g = data[idx + 1];
      const b = data[idx + 2];
      let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum /= 255;
      if (invert) lum = 1 - lum;
      lum = clamp(Math.pow(lum, gamma), 0, 1);
      return lum;
    };

    if (cropToCircle) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - maxWidth, 0, Math.PI * 2);
      ctx.clip();
    }

    const cx = size / 2;
    const cy = size / 2;
    const b = lineSpacing / (2 * Math.PI);
    const maxR = size / 2 - maxWidth * 1.5;
    const maxTheta = Math.min(maxR / b, Math.PI * 2 * turns);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    const dTheta = 0.015;
    let theta = 0;
    let lastX = 0;
    let lastY = 0;
    let first = true;
    let currentWidth = null;

    ctx.beginPath();

    while (theta < maxTheta) {
      const r = b * theta;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      const ix = x + cx;
      const iy = y + cy;
      const lum = sample(ix, iy);
      const shade = 1 - lum;
      const w = lerp(minWidth, maxWidth, shade);

      if (first) {
        lastX = x;
        lastY = y;
        currentWidth = w;
        first = false;
        ctx.moveTo(x, y);
      } else {
        ctx.lineWidth = w;
        ctx.lineTo(x, y);
      }

      lastX = x;
      lastY = y;
      theta += dTheta;
    }
    ctx.stroke();
    ctx.restore();

    if (cropToCircle) ctx.restore();

    canvas.toBlob((blob) => {
      if (!blob) {
        setBusy(false);
        setError("Failed to generate image blob.");
        return;
      }
      const url = URL.createObjectURL(blob);
      setDownloadURL(url);
      setBusy(false);
    }, "image/png", 0.98);
  };

  useEffect(() => {
    if (img) renderSpiral();
  }, [img, turns, lineSpacing, minWidth, maxWidth, gamma, invert, cropToCircle, resolution]);

  const reset = () => {
    setTurns(140);
    setLineSpacing(3);
    setMinWidth(0.6);
    setMaxWidth(4.2);
    setGamma(1.15);
    setInvert(false);
    setCropToCircle(true);
    setResolution(2048);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-zinc-50 to-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-black text-white grid place-items-center font-bold">V</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Vinx Spiral</h1>
              <p className="text-xs text-zinc-500 -mt-0.5">Spiral Portrait Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="px-3 py-2 rounded-xl bg-white border border-zinc-200 shadow-sm active:scale-[.98] flex gap-2 items-center text-sm">
              <RefreshCcw className="w-4 h-4"/> Reset
            </button>
            {downloadURL && (
              <a href={downloadURL} download="vinx-spiral.png" className="px-3 py-2 rounded-xl bg-black text-white shadow-sm active:scale-[.98] flex gap-2 items-center text-sm">
                <Download className="w-4 h-4"/> Download PNG
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <section>
          {!img && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-dashed border-zinc-300 rounded-2xl bg-white p-8 grid place-items-center text-center cursor-pointer"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e)=>e.preventDefault()}
            >
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10"/>
                <div className="space-y-1">
                  <p className="text-base font-medium">Drop an image here, click to browse, or paste from clipboard</p>
                  <p className="text-xs text-zinc-500">JPG/PNG/WebP • High-contrast faces work best</p>
                </div>
                <button className="mt-3 px-4 py-2 rounded-xl bg-black text-white text-sm">Choose Image</button>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e)=>onFile(e.target.files?.[0])}/>
            </motion.div>
          )}

          {img && (
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-3">
              <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white p-2">
                <canvas ref={canvasRef} className="w-full h-auto block"/>
              </div>
              <button onClick={renderSpiral} disabled={busy} className="px-3 py-2 rounded-xl bg-white border border-zinc-200 shadow-sm active:scale-[.98] flex gap-2 items-center text-sm">
                <SlidersHorizontal className="w-4 h-4"/> Re-render
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </motion.div>
          )}
          <canvas ref={hiddenRef} className="hidden"/>
        </section>
      </main>
    </div>
  );
}
