"use client";

import { useEffect, useRef, useState } from "react";

// Sticky, scroll-spied in-page navigation for long single-page help
// content (see docs/architecture.md's "UI conventions" section). Stays
// pinned under the (non-sticky) site header once scrolled to, and
// highlights whichever section is currently in view — the tab-underline
// visual style directly matches a reference page the user liked
// (2026-09-19 update; originally we'd adapted it to a pill style instead,
// now matching it exactly since the user asked for it specifically).
export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const navHeight = navRef.current?.getBoundingClientRect().height ?? 0;
      const boundary = navHeight + 24;

      let next = sections[0]?.id ?? "";
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= boundary) next = s.id;
      }

      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (atBottom) next = sections[sections.length - 1]?.id ?? next;

      setActiveId((prev) => (prev === next ? prev : next));
    }

    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav className="section-nav" aria-label="Jump to a section" ref={navRef}>
      <div className="section-nav-links">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={s.id === activeId ? "active" : undefined}
            aria-current={s.id === activeId ? "location" : undefined}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
