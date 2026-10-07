"use client";

import { useEffect, useRef } from "react";

export function ContainerScroll({ titleComponent, children, footer, status = "ONLINE" }: { titleComponent: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; status?: string }) {
  const section = useRef<HTMLElement>(null);
  const tablet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!section.current || !tablet.current) return;
      const bounds = section.current.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (-bounds.top + viewport * .1) / Math.max(viewport * .75, 520)));
      tablet.current.style.setProperty("--scroll-progress", progress.toFixed(4));
      tablet.current.style.setProperty("--tablet-rotate", `${(18 * (1 - progress)).toFixed(2)}deg`);
      tablet.current.style.setProperty("--tablet-scale", (.84 + progress * .16).toFixed(4));
      tablet.current.style.setProperty("--tablet-y", `${Math.round(85 * (1 - progress))}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return <section className="scroll-map-hero" ref={section}>
    <div className="scroll-hero-title">{titleComponent}</div>
    <div className="tablet-perspective"><div className="map-tablet" ref={tablet}><div className="tablet-hardware"><i/><span>SARATHI · LIVE OPERATIONS</span><b>{status}</b></div><div className="tablet-screen">{children}</div></div></div>
    {footer && <div className="scroll-hero-action">{footer}</div>}
  </section>;
}
