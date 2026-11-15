// Text only by design (spec: no illustrations, no emoji); the message itself should say what to do next.
export function EmptyState({ message }: { message: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{message}</p>;
}
