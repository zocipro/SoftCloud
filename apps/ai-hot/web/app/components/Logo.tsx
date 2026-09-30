// The site's wordmark (its name from industry/site.ts, set in type) and a small ring mark used as the
// loader. A site with its own logo can replace Wordmark here.
import { SITE } from "@aihot/industry/site";

export function Wordmark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={SITE.name} role="img">
      <img src="/assets/brand-icon.png" alt="" style={{width:30,height:30,borderRadius:10}} />
      <span className="flex flex-col"><span style={{fontSize:Math.min(size,22),fontWeight:650,letterSpacing:'-1px'}}>softcloud<span className="text-accent">.</span></span><span className="mt-1 text-[10px] font-medium tracking-normal text-ink-3">AI 热点</span></span>
    </span>
  );
}

/** A ring with a dot; spinning, it is the loader. */
export function RingMark({ className = "", spinning = false }: { className?: string; spinning?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g style={spinning ? { transformOrigin: "12px 12px", animation: "spin-slow 1.1s linear infinite" } : undefined}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="42 15" />
      </g>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}
