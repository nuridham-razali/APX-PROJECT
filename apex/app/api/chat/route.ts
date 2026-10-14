import { proxyRuntime } from '@/lib/runtime-proxy';
export const runtime = 'nodejs';
export async function POST(request: Request) { return proxyRuntime(request, 'chat'); }
