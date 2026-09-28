'use client';
// 회원-캐릭터 권한 편집 (3차, v1.9) — 상대 캐릭터에 회원별 권한 부여:
// 역극 플레이(그 캐릭터로 발화 가능) / 편집까지(캐릭터 편집 포함).
// v1.9 개편: 회원 전체 나열 대신 닉네임·아이디 검색으로 추가하고, 권한이 있는 회원만 목록에 표시.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CharGrant } from '@/lib/charStore';
import { useMembers } from '@/lib/members';
import { KInput } from '@/components/ui/Kit';
import { useConfirmDelete } from '@/components/ui/Modal';

// 드롭다운 최대 높이 — 아래 공간이 이만큼 없으면 위로 띄운다 (maxHeight 180 + 패딩)
const POP_H = 192;

export function GrantsEditor({ value, onChange }: {
  value: CharGrant[];
  onChange: (next: CharGrant[]) => void;
}) {
  const pool = useMembers().filter(p => p.id !== 'admin'); // 관리자는 항상 전권
  const del = useConfirmDelete();   // 권한 해제도 되돌릴 수 없는 동작이라 경고를 거친다
  const [q, setQ] = useState('');
  // 드롭다운은 body 포털(fixed) — 카드 overflow에 잘리지 않고, 아래 공간이 없으면 위로 (v1.9 수정)
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // 위로 띄울 때는 top을 계산하지 않고 bottom으로 고정한다 (v2.0 사용자 지적).
  // 예전엔 "입력칸 위 192px"이라는 고정 추정값에 top을 맞춰서, 결과가 한두 개뿐이면
  // 목록이 입력칸에서 멀찍이 떨어진 채 위쪽부터 쌓인 것처럼 보였다.
  // bottom을 입력칸 바로 위에 붙이면 항목 수와 무관하게 아래에서 위로 자란다.
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const openAt = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = window.innerHeight - r.bottom < POP_H + 10;   // 아래 공간 부족 — 위로
    setPos({
      left: r.left,
      width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  };
  const open = pos !== null;
  const setOpen = (v: boolean) => (v ? openAt() : setPos(null));
  useEffect(() => {
    if (!open) return;

    // 검색 결과 자체를 스크롤할 때는 닫지 않는다.
    // window의 capture scroll listener는 자식 요소의 스크롤까지 받기 때문에
    // 예전에는 목록을 휠/스크롤바로 내리는 순간 드롭다운이 사라졌다.
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && popRef.current?.contains(target)) return;
      setPos(null);
    };
    const onResize = () => setPos(null);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && (wrapRef.current?.contains(target) || popRef.current?.contains(target))) return;
      setPos(null);
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const granted = value
    .map(g => ({ ...g, member: pool.find(p => p.id === g.userId) }))
    .filter(g => g.member);
  const matches = pool.filter(p =>
    !value.some(g => g.userId === p.id)
    && (p.nickname.toLowerCase().includes(q.trim().toLowerCase())
      || p.id.toLowerCase().includes(q.trim().toLowerCase())));

  const setLevel = (userId: string, level: 'play' | 'edit') =>
    onChange([...value.filter(g => g.userId !== userId), { userId, level }]);
  const remove = (userId: string) => onChange(value.filter(g => g.userId !== userId));

  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {/* 회원 검색 — 닉네임 또는 아이디 (선택 시 「역극 플레이」로 추가) */}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <KInput placeholder="닉네임·아이디 검색" value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} />
        {open && matches.length > 0 && typeof document !== 'undefined' && createPortal(
          <div ref={popRef} style={{
            position: 'fixed', left: pos!.left, width: pos!.width, zIndex: 120,
            ...(pos!.bottom !== undefined ? { bottom: pos!.bottom } : { top: pos!.top }),
            background: 'var(--panel-solid)', border: '1px solid var(--line)', borderRadius: 10,
            boxShadow: 'var(--sh-dd)', padding: 4, maxHeight: 180, overflow: 'auto',
          }}>
            {matches.map(p => (
              <button key={p.id} type="button"
                style={{
                  display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 7, fontSize: 12.5, color: 'var(--ink)',
                }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setLevel(p.id, 'play'); setQ(''); setOpen(false); }}>
                <span>{p.nickname}</span>
                <small style={{ color: 'var(--faint)' }}>{p.id}</small>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>

      {/* 권한 부여된 회원만 표시 */}
      {granted.map(g => (
        <div key={g.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5 }}>
            {g.member!.nickname} <small style={{ color: 'var(--faint)' }}>{g.userId}</small>
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="mini-seg">
              <button className={g.level === 'play' ? 'on' : ''} onClick={() => setLevel(g.userId, 'play')}>역극 플레이</button>
              <button className={g.level === 'edit' ? 'on' : ''} onClick={() => setLevel(g.userId, 'edit')}>편집까지</button>
            </div>
            <span className="fx" style={{ cursor: 'var(--cur-pointer,pointer)' }} data-tip="권한 해제"
              onClick={() => del.ask(`「${g.member!.nickname}」의 권한을 해제하시겠습니까?`,
                () => remove(g.userId),
                '이 회원은 더 이상 이 캐릭터로 역극에 참여하거나 편집할 수 없습니다.')}>✕</span>
          </div>
        </div>
      ))}
      {granted.length === 0 && (
        <p className="hint" style={{ margin: 0 }}>권한을 준 회원이 없습니다 — 위에서 검색해 추가</p>
      )}
      {del.element}
    </div>
  );
}
