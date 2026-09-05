export function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-neutral-500">
      {text}
    </main>
  );
}
