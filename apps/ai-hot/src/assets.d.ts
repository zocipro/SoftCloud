declare module '*.md' { const content: string; export default content; }

// Dashboard-owned controls stay absent from deployment vars; missing means disabled.
interface Env { COLLECT_ENABLED?: string; MODEL_CALLS_ENABLED?: string; FREE_PLAN_VERIFIED?: string }
