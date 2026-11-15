// Decorative placeholder: hidden from assistive tech so a screen reader is not read a list of empty boxes.
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block rounded-tile bg-control ${className ?? ''}`.trim()} />;
}
