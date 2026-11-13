'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { Client, PaymentMethod, Product, Sale, Service } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, inputCls, PageHeader } from '@/components/ui';
import { currency, dateTime } from '@/lib/format';

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  CHECK: 'Cheque',
};

interface CartItem {
  key: string;
  kind: 'product' | 'service';
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxStock?: number;
}

export default function VendasPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pdv' | 'historico'>('pdv');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientId, setClientId] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('PIX');
  const [discount, setDiscount] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [restored, setRestored] = useState(false);

  // O rascunho da venda sobrevive à ida para "Clientes" (cadastro de cliente novo).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('pdv-draft');
      if (raw) {
        const d = JSON.parse(raw);
        setCart(d.cart ?? []);
        setClientId(d.clientId ?? '');
        setPayment(d.payment ?? 'PIX');
        setDiscount(d.discount ?? '');
      }
    } catch {}
    // cliente recém-cadastrado vem na URL: /vendas?cliente=<id>
    const novo = new URLSearchParams(window.location.search).get('cliente');
    if (novo) {
      setClientId(novo);
      window.history.replaceState(null, '', '/vendas');
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem('pdv-draft', JSON.stringify({ cart, clientId, payment, discount }));
    } catch {}
  }, [restored, cart, clientId, payment, discount]);

  const { data: products = [] } = useQuery({
    queryKey: ['products', '', 'pdv'],
    queryFn: async () => (await api.get<Product[]>('/products', { params: { active: 'true' } })).data,
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await api.get<Service[]>('/services', { params: { active: 'true' } })).data,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', '', 'active'],
    queryFn: async () => (await api.get<Client[]>('/clients', { params: { active: 'true' } })).data,
  });
  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => (await api.get<Sale[]>('/sales')).data,
    enabled: tab === 'historico',
  });

  const q = search.trim().toLowerCase();
  const catalog = useMemo(() => {
    const p = products
      .filter((x) => !q || x.name.toLowerCase().includes(q) || x.sku?.toLowerCase().includes(q))
      .map((x) => ({ kind: 'product' as const, id: x.id, name: x.name, price: x.price, sub: `${x.stock} ${x.unit} em estoque`, stock: x.stock }));
    const s = services
      .filter((x) => !q || x.name.toLowerCase().includes(q))
      .map((x) => ({ kind: 'service' as const, id: x.id, name: x.name, price: x.price, sub: `Serviço · ${x.duration} min`, stock: undefined }));
    return [...p, ...s];
  }, [products, services, q]);

  const add = (item: (typeof catalog)[number]) => {
    setMessage(null);
    const key = `${item.kind}:${item.id}`;
    setCart((c) => {
      const found = c.find((i) => i.key === key);
      if (found) {
        if (found.maxStock !== undefined && found.quantity >= found.maxStock) return c;
        return c.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      if (item.stock === 0) return c;
      return [...c, { key, kind: item.kind, id: item.id, name: item.name, price: item.price, quantity: 1, maxStock: item.stock }];
    });
  };

  const setQty = (key: string, qty: number) =>
    setCart((c) =>
      c.flatMap((i) => {
        if (i.key !== key) return [i];
        if (qty <= 0) return [];
        return [{ ...i, quantity: i.maxStock !== undefined ? Math.min(qty, i.maxStock) : qty }];
      }),
    );

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountValue = Math.min(Number(discount.replace(',', '.')) || 0, subtotal);
  const total = subtotal - discountValue;

  const finish = useMutation({
    mutationFn: async () =>
      (
        await api.post<Sale>('/sales', {
          paymentMethod: payment,
          ...(clientId && { clientId }),
          ...(discountValue > 0 && { discount: discountValue }),
          items: cart.map((i) => (i.kind === 'product' ? { productId: i.id, quantity: i.quantity } : { serviceId: i.id, quantity: i.quantity })),
        })
      ).data,
    onSuccess: (sale) => {
      setMessage({ ok: true, text: `Venda concluída: ${currency(sale.total)}` });
      setCart([]);
      setDiscount('');
      setClientId('');
      ['products', 'sales', 'dashboard', 'financial'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => setMessage({ ok: false, text: errorMessage(e) }),
  });

  return (
    <>
      <PageHeader title="Vendas" subtitle="Ponto de venda e histórico" />

      <div className="mb-4 flex gap-2">
        {(['pdv', 'historico'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            {t === 'pdv' ? 'Nova venda' : 'Histórico'}
          </button>
        ))}
      </div>

      {tab === 'pdv' ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <input className={`${inputCls} mb-3`} placeholder="Buscar produto ou serviço…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Card>
              {catalog.length === 0 ? (
                <Empty>Nada encontrado</Empty>
              ) : (
                <ul className="max-h-[28rem] divide-y divide-gray-100 overflow-y-auto">
                  {catalog.map((it) => {
                    const out = it.stock === 0;
                    return (
                      <li key={`${it.kind}:${it.id}`}>
                        <button
                          disabled={out}
                          onClick={() => add(it)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{it.name}</span>
                            <span className={`block text-xs ${out ? 'text-red-500' : 'text-gray-500'}`}>{out ? 'Sem estoque' : it.sub}</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-primary-700">{currency(it.price)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card className="h-fit space-y-3 p-4 lg:col-span-2">
            <h2 className="font-semibold">Carrinho</h2>
            {cart.length === 0 ? (
              <Empty>Clique em um item para adicionar</Empty>
            ) : (
              <ul className="divide-y divide-gray-100">
                {cart.map((i) => (
                  <li key={i.key} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.name}</span>
                    <div className="flex items-center gap-1">
                      <button className="h-6 w-6 rounded border border-gray-200 hover:bg-gray-100" onClick={() => setQty(i.key, i.quantity - 1)} aria-label="Diminuir">−</button>
                      <span className="w-6 text-center">{i.quantity}</span>
                      <button className="h-6 w-6 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40" disabled={i.maxStock !== undefined && i.quantity >= i.maxStock} onClick={() => setQty(i.key, i.quantity + 1)} aria-label="Aumentar">+</button>
                    </div>
                    <span className="w-20 text-right font-medium">{currency(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Cliente (opcional)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Link href="/clientes?novo=1&voltar=/vendas" className="mt-1 inline-block text-xs text-primary-600 hover:underline">
                + Cadastrar cliente novo
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
                {Object.entries(paymentLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className={inputCls} inputMode="decimal" placeholder="Desconto (R$)" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>

            <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
              {discountValue > 0 && <div className="flex justify-between text-gray-500"><span>Desconto</span><span>− {currency(discountValue)}</span></div>}
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency(total)}</span></div>
            </div>

            {message && (message.ok ? <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message.text}</div> : <ErrorBox message={message.text} />)}

            <div className="flex gap-2">
              <button className={btnGhost} disabled={cart.length === 0} onClick={() => setCart([])}>Limpar</button>
              <button className={`${btnPrimary} flex-1`} disabled={cart.length === 0 || finish.isPending} onClick={() => finish.mutate()}>
                {finish.isPending ? 'Finalizando…' : 'Finalizar venda'}
              </button>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          {sales.length === 0 ? (
            <Empty>{loadingSales ? 'Carregando…' : 'Nenhuma venda registrada'}</Empty>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="hidden px-4 py-3 md:table-cell">Itens</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Pagamento</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">{dateTime(s.date)}</td>
                    <td className="px-4 py-3">{s.client?.name ?? <span className="text-gray-400">Balcão</span>}</td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-gray-500 md:table-cell">
                      {s.items.map((i) => `${i.quantity}× ${i.product?.name ?? i.service?.name}`).join(', ')}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{paymentLabel[s.paymentMethod]}</td>
                    <td className="px-4 py-3 text-right font-medium">{currency(s.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </>
  );
}
