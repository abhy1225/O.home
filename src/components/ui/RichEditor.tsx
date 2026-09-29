'use client';
// 리치 텍스트 에디터 (TipTap) — 프로필 탭 등 HTML 콘텐츠 작성용
// 자체 스타일 툴바 (7장 — 기본 UI 금지) · 출력은 HTML, 저장 시 새니타이즈는 렌더 쪽에서 (6.3)
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';
import { useFonts } from '@/lib/fontStore';



// 문단별 정렬·줄간격을 HTML style로 저장한다. 별도 패키지 없이 TipTap의 paragraph/heading에
// 속성만 확장하므로 기존 글과도 호환된다. 값이 없으면 환경설정의 전역 줄간격을 따른다.


// 선택한 글자(또는 현재 커서 이후 입력)에 개별 글꼴을 적용한다.
// span의 inline font-family로 저장하므로 게시글을 다시 열어도 글꼴 정보가 유지된다.
const EditorFont = Mark.create({
  name: 'editorFont',
  addAttributes() {
    return {
      family: {
        default: null,
        parseHTML: el => (el as HTMLElement).style.fontFamily || null,
        renderHTML: attrs => attrs.family ? { style: `font-family:${attrs.family}` } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[style*="font-family"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});


const EditorFontSize = Mark.create({
  name: 'editorFontSize',
  addAttributes() { return { size: { default: null, parseHTML: el => (el as HTMLElement).style.fontSize || null,
    renderHTML: attrs => attrs.size ? { style: `font-size:${attrs.size}` } : {} } }; },
  parseHTML() { return [{ tag: 'span[style*="font-size"]' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
});
const FONT_SIZE_OPTIONS = Array.from({ length: 8 }, (_, i) => `${i + 8}pt`);

const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: null }, controls: { default: true } };
  },
  parseHTML() { return [{ tag: 'video[src]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'controls', playsinline: 'playsinline', style: 'max-width:100%;height:auto;' })];
  },
});

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(url) || /\/video\/upload\//i.test(url);
}

const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: el => el.style.textAlign || null,
          renderHTML: attrs => attrs.textAlign ? { style: `text-align:${attrs.textAlign}` } : {},
        },
        lineHeight: {
          default: null,
          parseHTML: el => el.style.lineHeight || null,
          renderHTML: attrs => attrs.lineHeight ? { style: `line-height:${attrs.lineHeight}` } : {},
        },
      },
    }];
  },
});

const LINE_HEIGHT_OPTIONS = [
  { label: '기본간격', value: '' },
  { label: '140%', value: '1.4' },
  { label: '150%', value: '1.5' },
  { label: '160%', value: '1.6' },
  { label: '180%', value: '1.8' },
];

/** 로컬 모드용 — 파일을 그대로 본문에 심는다 (서버가 없어 올릴 곳이 없을 때) */
function toDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function TBtn({ on, label, title, onClick }: { on?: boolean; label: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button type="button" data-tip={title} className={`re-btn ${on ? 'on' : ''}`}
      onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {label}
    </button>
  );
}

export function RichEditor({ value, onChange, placeholder }: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const toast = useToast();
  const { fonts, familyOf } = useFonts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const editor = useEditor({
    extensions: [StarterKit, Image, Video, ParagraphFormat, EditorFont, EditorFontSize],
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 're-content prose' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const setParagraphAttr = (attr: 'textAlign' | 'lineHeight', value: string | null) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    chain.updateAttributes('paragraph', { [attr]: value });
    chain.updateAttributes('heading', { [attr]: value });
    chain.run();
  };
  const currentAlign = editor?.getAttributes('paragraph').textAlign
    || editor?.getAttributes('heading').textAlign || 'left';
  const currentLineHeight = editor?.getAttributes('paragraph').lineHeight
    || editor?.getAttributes('heading').lineHeight || '';
  const currentFontFamily = editor?.getAttributes('editorFont').family || '';
  const currentFontSize = editor?.getAttributes('editorFontSize').size || '';
  const setEditorFontSize = (size: string) => {
    if (!editor) return;
    if (!size) editor.chain().focus().unsetMark('editorFontSize').run();
    else editor.chain().focus().setMark('editorFontSize', { size }).run();
  };

  const setEditorFont = (fontId: string) => {
    if (!editor) return;
    if (!fontId) {
      editor.chain().focus().unsetMark('editorFont').run();
      return;
    }
    const family = familyOf(fontId);
    if (!family) return;
    editor.chain().focus().setMark('editorFont', { family }).run();
  };

  // 외부 값이 완전히 바뀐 경우(탭 전환) 동기화
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="re-wrap" style={{ minHeight: 200 }} />;

  /* 이미지는 **올려서** 넣는다 (v2.0 사용자 요청 — 예전엔 URL을 직접 적게 했다).
     다른 이미지들과 같은 경로(putBlob)를 타므로 서버 모드면 저장소에 올라가고 공개 주소가 나온다.
     서버가 없는 로컬 모드에서는 그 주소가 이 브라우저 안에서만 뜻이 있는 파일 id라
     <img>가 읽지 못한다 — 그때만 본문에 그대로 심는다(개발·오프라인용). */
  const insertMediaUrl = (raw: string) => {
    const src = raw.trim();
    if (!/^https?:\/\//i.test(src)) { toast('http:// 또는 https://로 시작하는 주소를 입력해 주세요'); return; }
    if (isVideoUrl(src)) editor.chain().focus().insertContent({ type: 'video', attrs: { src } }).run();
    else editor.chain().focus().setImage({ src }).run();
    setMediaUrl('');
    setUrlOpen(false);
  };

  const insertMedia = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      toast('이미지, GIF 또는 동영상 파일만 올릴 수 있습니다'); return;
    }
    // Cloudinary 무료 플랜의 기본 최대치에 맞춘 클라이언트 가드. GIF는 image로 취급된다.
    const max = f.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (f.size > max) { toast(`파일이 너무 큽니다 — ${f.type.startsWith('video/') ? '동영상 100MB' : '이미지/GIF 10MB'} 이하로 올려 주세요`); return; }
    setBusy(true);
    try {
      const ref = await putBlob(f);
      const src = /^https?:/.test(ref) ? ref : await toDataUrl(f);
      if (f.type.startsWith('video/')) editor.chain().focus().insertContent({ type: 'video', attrs: { src } }).run();
      else editor.chain().focus().setImage({ src }).run();
    } catch (e) {
      toast(`미디어를 올리지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  return (
    <div className="re-wrap">
      <div className="re-toolbar">
        <select className="re-select" title="글꼴" aria-label="글꼴"
          value={fonts.find(f => familyOf(f.id) === currentFontFamily)?.id || ''}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => setEditorFont(e.target.value)}
          style={{ maxWidth: 150 }}>
          <option value="">기본 글꼴</option>
          {fonts.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select className="re-select" title="글자 크기" aria-label="글자 크기" value={currentFontSize}
          onMouseDown={e => e.stopPropagation()} onChange={e => setEditorFontSize(e.target.value)} style={{ width: 76 }}>
          <option value="">기본 크기</option>
          {FONT_SIZE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="re-sep" />
        <TBtn title="굵게" label={<b>B</b>} on={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <TBtn title="기울임" label={<i>I</i>} on={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <TBtn title="취소선" label={<s>S</s>} on={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()} />
        <span className="re-sep" />
        <TBtn title="제목" label="H2" on={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <TBtn title="소제목" label="H3" on={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <span className="re-sep" />
        <TBtn title="글머리 목록" label="•≡" on={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <TBtn title="번호 목록" label="1≡" on={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <TBtn title="인용" label="❝" on={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <TBtn title="구분선" label="—" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <span className="re-sep" />
        <TBtn title="왼쪽 정렬" label="≡←" on={currentAlign === 'left'} onClick={() => setParagraphAttr('textAlign', 'left')} />
        <TBtn title="가운데 정렬" label="≡↔" on={currentAlign === 'center'} onClick={() => setParagraphAttr('textAlign', 'center')} />
        <TBtn title="오른쪽 정렬" label="→≡" on={currentAlign === 'right'} onClick={() => setParagraphAttr('textAlign', 'right')} />
        <TBtn title="양쪽 정렬" label="☰" on={currentAlign === 'justify'} onClick={() => setParagraphAttr('textAlign', 'justify')} />
        <select className="re-select" title="줄간격" aria-label="줄간격" value={currentLineHeight}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => setParagraphAttr('lineHeight', e.target.value || null)}>
          {LINE_HEIGHT_OPTIONS.map(o => <option key={o.value || 'default'} value={o.value}>{o.label}</option>)}
        </select>
        <span className="re-sep" />
        <TBtn title={busy ? '올리는 중…' : '이미지·GIF·동영상 올리기'} label={busy ? '⏳' : '🖼'}
          onClick={() => { if (!busy) fileRef.current?.click(); }} />
        <TBtn title="이미지·동영상 URL로 삽입" label="🔗" on={urlOpen}
          onClick={() => setUrlOpen(v => !v)} />
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void insertMedia(f); }} />
        {/* 실행 취소·다시 실행은 모바일에서 숨김 — 툴바가 두 줄로 넘어가 본문 영역을 침범 (v1.9 사용자 확정)
            (단축키 Ctrl+Z / Ctrl+Shift+Z는 그대로 동작) */}
        <span className="re-sep re-hide-m" />
        <span className="re-hide-m" style={{ display: 'contents' }}>
          <TBtn title="실행 취소" label="↶" onClick={() => editor.chain().focus().undo().run()} />
          <TBtn title="다시 실행" label="↷" onClick={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      {urlOpen && (
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--line, #ddd)' }}>
          <input className="k-input" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insertMediaUrl(mediaUrl); } }}
            placeholder="이미지/GIF/MP4 직접 주소 (https://...)" style={{ flex: 1 }} />
          <button type="button" className="btn btn-dark" onClick={() => insertMediaUrl(mediaUrl)}>삽입</button>
        </div>
      )}
      {/* 플레이스홀더는 본문 영역 기준으로 — 툴바가 두 줄이 돼도 안 밀림 (v1.9 사용자 발견) */}
      <div className="re-body">
        <EditorContent editor={editor} />
        {placeholder && editor.isEmpty && <div className="re-ph">{placeholder}</div>}
      </div>
    </div>
  );
}
