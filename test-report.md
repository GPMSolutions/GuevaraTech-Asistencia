# Test Report — PR #9: Kiosk login, deductions, payslip PDF

**How tested:** End-to-end on production (https://guevara-tech-asistencia-rouge.vercel.app) after merge. Logged in as the shared kiosk account and clocked a worker in, then as admin added a deduction and downloaded the payslip PDF.

**Result: all 3 tests passed.** No issues found.

## Results

- ✅ Shared kiosk login (`trabajadores@guevaratech.com`) shows the employee grid; workers see no weekly/monthly reports in the nav.
- ✅ Tapping an employee → **Entrada** clocks them in: status → "Trabajando", "Entrada 9:02 PM" logged, and it flowed into payroll (Gino went to 2 días / Dom S/12.16).
- ✅ Admin adds an **Adelanto S/50** deduction → Gino's Total a Pagar drops S/194.42 → **S/144.42**; header total 498.20 → 448.20.
- ✅ **PDF boleta** downloads with earnings breakdown, itemized deduction, green **TOTAL A PAGAR S/144.42**, and a **"Firma del trabajador"** signature line.
- ✅ Deleting the deduction restored Total a Pagar to S/194.42 (cleanup + DELETE endpoint verified).

## Evidence

### Kiosk clock-in
| Employee grid (kiosk login) | After Entrada |
|---|---|
| ![grid](/home/ubuntu/screenshots/ss_2f88fff5.png) | ![clockin](/home/ubuntu/screenshots/ss_3bf09c16.png) |
| Grid of names; nav = "Marcar Asistencia" only | Status "Trabajando", Entrada 9:02 PM logged |

### Deductions in Planilla
| Add Adelanto S/50 | Net pay updated |
|---|---|
| ![add](/home/ubuntu/screenshots/ss_28a2715d.png) | ![net](/home/ubuntu/screenshots/ss_a4f833a3.png) |
| Type dropdown has all 5 types | Descuentos -S/50.00, Total a Pagar S/144.42 |

### Payslip PDF
![pdf](/home/ubuntu/screenshots/ss_a645629e.png)

Boleta shows Ingresos (Total Bruto S/194.42), Descuentos (Adelanto (prueba) -S/50.00), **TOTAL A PAGAR S/144.42**, and the signature line.

## Notes
- Production DB has 3 active employees (Gino, Maria Lourdes, Miluska); the kiosk account and Deduction table are live.
- Delete confirmation uses a native browser `confirm()` dialog.
