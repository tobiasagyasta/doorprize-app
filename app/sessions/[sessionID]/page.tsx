export default function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  return <div>Session: {params.sessionId}</div>;
}
