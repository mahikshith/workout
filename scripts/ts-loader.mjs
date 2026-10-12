// Lets plain Node run the app's pure TS modules for self-checks: extensionless imports and JSON imports.
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith('.')) for (const ext of ['.ts', '.tsx']) { try { return await next(spec + ext, ctx); } catch {} }
    throw e;
  }
}
export async function load(url, ctx, next) {
  return next(url, url.endsWith('.json') ? { ...ctx, importAttributes: { type: 'json' } } : ctx);
}
