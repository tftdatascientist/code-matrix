import { useEffect, useRef } from 'react';

// Katakana range + digits + some symbols
const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';

interface Column {
  x: number;
  y: number;
  speed: number;
  length: number;   // trail length in characters
  chars: number[];   // character indices for this column
  flashTimer: number;
}

interface MatrixRainProps {
  speedMultiplier?: number; // 1.0 = normal, 1.3 = thinking, 0.3 = disconnect
  density?: number;         // 0.0-1.0, fraction of columns active
  opacity?: number;         // background opacity
}

export function MatrixRain({
  speedMultiplier = 1.0,
  density = 0.7,
  opacity = 0.18,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const columnsRef = useRef<Column[]>([]);
  const animRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FONT_SIZE = 14;
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = window.innerWidth + 'px';
      canvas!.style.height = window.innerHeight + 'px';
      ctx!.scale(dpr, dpr);
      initColumns();
    }

    function initColumns() {
      const colCount = Math.floor(window.innerWidth / FONT_SIZE);
      const activeCount = Math.floor(colCount * density);
      const columns: Column[] = [];

      // Pick random column positions
      const indices = Array.from({ length: colCount }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let i = 0; i < activeCount; i++) {
        columns.push(createColumn(indices[i] * FONT_SIZE));
      }

      columnsRef.current = columns;
    }

    function createColumn(x: number): Column {
      const length = 8 + Math.floor(Math.random() * 12); // 8-19 chars trail
      return {
        x,
        y: -Math.random() * window.innerHeight, // start above screen
        speed: 20 + Math.random() * 60, // 20-80 px/s
        length,
        chars: Array.from({ length: length + 1 }, () => Math.floor(Math.random() * CHARS.length)),
        flashTimer: 0,
      };
    }

    function render(timestamp: number) {
      const elapsed = timestamp - lastFrameRef.current;
      if (elapsed < FRAME_INTERVAL) {
        animRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameRef.current = timestamp - (elapsed % FRAME_INTERVAL);

      const dt = elapsed / 1000; // seconds
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx!.clearRect(0, 0, w, h);
      ctx!.font = `${FONT_SIZE}px "MS Gothic", "Hiragino Kaku Gothic", monospace`;
      ctx!.textBaseline = 'top';

      for (const col of columnsRef.current) {
        col.y += col.speed * speedMultiplier * dt;

        // Randomly change a character in the trail
        if (Math.random() < 0.03) {
          const idx = Math.floor(Math.random() * col.chars.length);
          col.chars[idx] = Math.floor(Math.random() * CHARS.length);
        }

        // Random flash
        col.flashTimer -= dt;
        if (Math.random() < 0.002) {
          col.flashTimer = 0.1; // 100ms flash
        }

        // Draw each character in the column
        for (let i = 0; i <= col.length; i++) {
          const charY = col.y - i * FONT_SIZE;
          if (charY < -FONT_SIZE || charY > h) continue;

          const char = CHARS[col.chars[i]];

          if (i === 0) {
            // Head: brightest
            const isFlash = col.flashTimer > 0;
            ctx!.fillStyle = isFlash ? '#ffffff' : '#00FF41';
            ctx!.globalAlpha = isFlash ? 0.9 : 0.85;
          } else {
            // Trail: fade from bright to dim
            const fade = 1 - (i / col.length);
            const g = Math.floor(100 + 155 * fade);
            ctx!.fillStyle = `rgb(0, ${g}, ${Math.floor(20 * fade)})`;
            ctx!.globalAlpha = 0.15 + 0.6 * fade;
          }

          ctx!.fillText(char, col.x, charY);
        }

        // Reset column when fully off screen
        if (col.y - col.length * FONT_SIZE > h) {
          Object.assign(col, createColumn(col.x));
        }
      }

      ctx!.globalAlpha = 1;
      animRef.current = requestAnimationFrame(render);
    }

    resize();
    animRef.current = requestAnimationFrame(render);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [density, speedMultiplier]);

  return (
    <canvas
      ref={canvasRef}
      className="matrix-rain"
      style={{ opacity }}
    />
  );
}
