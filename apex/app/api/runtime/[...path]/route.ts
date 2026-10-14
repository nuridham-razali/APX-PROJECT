import { proxyRuntime } from '@/lib/runtime-proxy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) { return proxyRuntime(request, (await context.params).path.join('/')); }
export async function POST(request: Request, context: Context) { return proxyRuntime(request, (await context.params).path.join('/')); }
