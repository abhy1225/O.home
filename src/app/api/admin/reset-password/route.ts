import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: '서버의 Supabase 관리자 환경변수가 설정되지 않았습니다.' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return NextResponse.json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return NextResponse.json({ ok: false, error: '로그인 정보를 확인할 수 없습니다.' }, { status: 401 });

  const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', caller.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ ok: false, error: '관리자만 비밀번호를 초기화할 수 있습니다.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { userId?: string; newPassword?: string } | null;
  const userId = body?.userId?.trim() ?? '';
  const newPassword = body?.newPassword ?? '';
  if (!userId || newPassword.length < 6) {
    return NextResponse.json({ ok: false, error: '회원과 6자 이상의 임시 비밀번호를 확인해 주세요.' }, { status: 400 });
  }
  if (userId === caller.user.id) {
    return NextResponse.json({ ok: false, error: '관리자 본인의 비밀번호는 마이페이지에서 변경해 주세요.' }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
