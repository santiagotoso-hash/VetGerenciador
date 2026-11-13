import { Card, PageHeader } from '@/components/ui';

export function ComingSoon({ title, note }: { title: string; note: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="p-10 text-center text-gray-500">
        <div className="mb-2 text-4xl">🚧</div>
        <p className="font-medium text-gray-700">Tela em construção</p>
        <p className="mt-1 text-sm">{note}</p>
      </Card>
    </>
  );
}
