'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { KInput } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

export default function PasswordResetPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, ready, updateProfile } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase가 복구 링크의 토큰을 처리해 세션을 만드는 데 잠깐 걸릴 수 있다.
    // ready 이후에도 user가 없으면 링크 만료/이미 사용 등의 가능성을 안내한다.
  }, [ready, user]);

  const save = async () => {
    setErr('');
    if (pw.length < 6) { setErr('새 비밀번호는 6자 이상 입력해 주세요.'); return; }
    if (pw !== pw2) { setErr('새 비밀번호가 서로 다릅니다.'); return; }
    if (!user) { setErr('재설정 링크가 만료되었거나 이미 사용되었습니다. 새 링크를 요청해 주세요.'); return; }
    setSaving(true);
    const r = await updateProfile({ newPassword: pw });
    setSaving(false);
    if (!r.ok) { setErr(r.error ?? '비밀번호 변경에 실패했습니다.'); return; }
    toast('비밀번호가 변경되었습니다');
    router.replace('/login');
  };

  return (
    <section className="page">
      <div className="panel" style={{ padding: 28, maxWidth: 480, margin: '40px auto 0' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '.2em', textAlign: 'center', margin: '4px 0 8px', color: 'var(--ink)' }}>
          RESET PASSWORD
        </h1>
        <p style={{ textAlign: 'center', fontSize: 12, marginBottom: 18, color: 'var(--muted)' }}>
          이메일의 재설정 링크로 인증되었습니다. 새 비밀번호를 입력해 주세요.
        </p>
        {!ready ? (
          <p style={{ textAlign: 'center', fontSize: 12 }}>인증 정보를 확인하고 있습니다…</p>
        ) : (
          <div style={{ display: 'grid', gap: 9 }}>
            <KInput placeholder="새 비밀번호 (6자 이상)" type="password" value={pw} onChange={e => setPw(e.target.value)} />
            <KInput placeholder="새 비밀번호 확인" type="password" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void save(); }} />
            {err && <p style={{ fontSize: 11.5, color: 'var(--accent)' }}>{err}</p>}
            <button className="btn btn-dark" style={{ justifyContent: 'center', padding: 10 }} onClick={() => void save()} disabled={saving || !user}>
              {saving ? '변경 중…' : '비밀번호 변경'}
            </button>
            {ready && !user && <p style={{ fontSize: 11.5, lineHeight: 1.6 }}>링크가 열렸지만 인증 세션을 만들지 못했습니다. Supabase의 Redirect URL 설정과 링크 만료 여부를 확인해 주세요.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
