// Test-only stub for the "server-only" marker package.
// The real package throws when resolved outside Next.js's "react-server"
// bundler condition, which Vitest does not set. Aliased in vitest.config.ts.
export {};
