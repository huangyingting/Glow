export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="霁光">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {!compact && (
        <span className="brand-name">
          <strong>霁光</strong>
          <small>JIGUANG</small>
        </span>
      )}
    </span>
  );
}
