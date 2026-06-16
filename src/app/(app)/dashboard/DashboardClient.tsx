"use client";
import { useState } from "react";
import PendingTransactionsBanner from "@/components/PendingTransactionsBanner";
import type { PendingTransaction } from "@/types";

interface Props {
  pending: PendingTransaction[];
  userId: string;
}

export default function DashboardClient({ pending: initialPending }: Props) {
  const [pending, setPending] = useState(initialPending);

  async function handleConfirm(id: string) {
    const item = pending.find((p) => p.id === id);
    if (!item?.neo_interpretation) return;

    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: item.neo_interpretation.type,
        amount: item.neo_interpretation.amount,
        currency_code: item.neo_interpretation.currency_code,
        description: item.neo_interpretation.description,
        date: new Date().toISOString().split("T")[0],
      }),
    });

    await fetch(`/api/pending/${id}`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }), headers: { "Content-Type": "application/json" } });
    setPending((p) => p.filter((x) => x.id !== id));
  }

  async function handleDismiss(id: string) {
    await fetch(`/api/pending/${id}`, { method: "PATCH", body: JSON.stringify({ status: "dismissed" }), headers: { "Content-Type": "application/json" } });
    setPending((p) => p.filter((x) => x.id !== id));
  }

  return (
    <PendingTransactionsBanner
      pending={pending}
      onConfirm={handleConfirm}
      onDismiss={handleDismiss}
    />
  );
}
