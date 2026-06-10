import { Chat } from '@/components/Chat';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Housing Element</h1>
        <p className="text-gray-500">
          Ask about a ZIP code or describe an area to explore its climate and insurance risks.
        </p>
      </header>
      <Chat />
    </main>
  );
}
