import { NextResponse } from 'next/server';

export async function GET() {
  // 伺服器會回傳它當下的標準時間，這完全不受使用者手機影響
  return NextResponse.json({ now: new Date().toISOString() });
}