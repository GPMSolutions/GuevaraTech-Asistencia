export const DEDUCTION_TYPE_LABELS: Record<string, string> = {
  AFP: "AFP",
  COMISION_AFP: "Comisión AFP",
  ADELANTO: "Adelanto",
  DEUDAS: "Deudas",
  COMPRA_PRODUCTO: "Compra de Producto",
};

export const DEDUCTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "AFP", label: "AFP" },
  { value: "COMISION_AFP", label: "Comisión AFP" },
  { value: "ADELANTO", label: "Adelanto" },
  { value: "DEUDAS", label: "Deudas" },
  { value: "COMPRA_PRODUCTO", label: "Compra de Producto" },
];

export function deductionTypeLabel(type: string): string {
  return DEDUCTION_TYPE_LABELS[type] ?? type;
}
