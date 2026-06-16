import type { InstallmentCalculation } from "@/types";

export function calculateFrenchInstallment(
  pv: number,
  tna: number,
  n: number
): InstallmentCalculation {
  const r = tna / 100 / 12;
  const installment_amount = r === 0
    ? pv / n
    : pv * (r / (1 - Math.pow(1 + r, -n)));
  const total_to_pay = installment_amount * n;
  return {
    installment_amount: round2(installment_amount),
    total_to_pay: round2(total_to_pay),
    financing_cost: round2(total_to_pay - pv),
  };
}

export function calculateNoInterest(pv: number, n: number): InstallmentCalculation {
  const installment_amount = pv / n;
  return {
    installment_amount: round2(installment_amount),
    total_to_pay: round2(pv),
    financing_cost: 0,
  };
}

export function calculateImpliedTNA(pv: number, cuota: number, n: number): number {
  // Newton-Raphson para encontrar r mensual tal que cuota = pv * r/(1-(1+r)^-n)
  let r = 0.05;
  for (let i = 0; i < 100; i++) {
    const f = pv * r / (1 - Math.pow(1 + r, -n)) - cuota;
    const df = pv * (
      (1 - Math.pow(1 + r, -n) + n * r * Math.pow(1 + r, -n - 1)) /
      Math.pow(1 - Math.pow(1 + r, -n), 2)
    );
    const r1 = r - f / df;
    if (Math.abs(r1 - r) < 1e-8) { r = r1; break; }
    r = r1;
  }
  return round2(r * 12 * 100);
}

export function generatePaymentDates(firstPaymentDate: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(firstPaymentDate);
    d.setMonth(d.getMonth() + i);
    return d;
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
