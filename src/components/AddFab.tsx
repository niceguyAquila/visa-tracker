import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";

const SIZE = 56;
const EDGE = 8;
const DRAG_THRESHOLD = 8;

type Pos = { x: number; y: number };

type AddFabProps = {
  to: string;
  label: string;
  storageKey: string;
};

function loadPos(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function bottomReserve(): number {
  const md = window.matchMedia("(min-width: 768px)").matches;
  return md ? 24 : 72;
}

function clampPos(x: number, y: number): Pos {
  const maxX = Math.max(EDGE, window.innerWidth - SIZE - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - SIZE - bottomReserve());
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE + 48, y)),
  };
}

export function AddFab({ to, label, storageKey }: AddFabProps) {
  const [pos, setPos] = useState<Pos | null>(() =>
    typeof window === "undefined" ? null : loadPos(storageKey)
  );
  const elRef = useRef<HTMLAnchorElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    setPos((current) => (current ? clampPos(current.x, current.y) : current));
    function onResize() {
      setPos((current) => (current ? clampPos(current.x, current.y) : current));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!pos) return;
    localStorage.setItem(storageKey, JSON.stringify(pos));
  }, [pos, storageKey]);

  function onPointerDown(e: PointerEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    const rect = elRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
      return;
    }
    drag.moved = true;
    setPos(clampPos(drag.origX + dx, drag.origY + dy));
  }

  function onPointerUp(e: PointerEvent<HTMLAnchorElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) suppressClickRef.current = true;
    dragRef.current = null;
  }

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  return (
    <Link
      ref={elRef}
      to={to}
      aria-label={label}
      title="Drag to move, tap to add"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
      className="fab-add"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-7 pointer-events-none"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
      </svg>
    </Link>
  );
}
