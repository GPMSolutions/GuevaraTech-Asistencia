# Test Plan — PR #9: Kiosk login, deductions, payslip PDF

Target: production URL after merge — https://guevara-tech-asistencia-rouge.vercel.app
Accounts: kiosk `trabajadores@guevaratech.com`/`trabajadores123`; admin `admin@guevaratech.com`/`admin123`
Test employee: **Carlos Pérez**

## Test 1 — Shared worker kiosk clock-in
1. Log in as the kiosk account. Expect redirect to `/kiosk` showing a grid of employee name cards (NOT the single-employee dashboard).
2. Card for "Carlos Pérez" initially shows status "No registrado" (gray).
3. Tap Carlos's card → modal opens with his name and action buttons.
4. Click **Entrada** (CLOCK_IN).
   - PASS: modal status changes to **"Trabajando"** (green); "Actividad de Hoy" lists **Entrada** with a timestamp; after closing, the Carlos grid card shows **"Trabajando"**.
   - FAIL if: 403/"Acceso denegado", redirect to /dashboard or /login, or no entry appears.
5. Negative: confirm the kiosk page/nav shows **no** weekly/monthly reports link (workers must not see that).

## Test 2 — Admin adds a deduction and net pay drops
1. Log in as admin → **Planilla**. Ensure month/year = current period (July 2026).
2. Note Carlos's **Total a Pagar** value (call it N) and **Descuentos** (expect "S/ 0.00" if none).
3. Click **Descuentos** on Carlos's row → modal. Select type **Adelanto**, amount **50**, note "prueba" → **Agregar Descuento**.
   - PASS: deduction appears in list as "Adelanto  prueba  - S/ 50.00"; modal footer "Total a Pagar" = N − 50.
4. Close modal. Row now shows **Descuentos = "- S/ 50.00"** and **Total a Pagar = N − 50** (exact).
   - FAIL if Total a Pagar unchanged or wrong amount.

## Test 3 — Payslip PDF download
1. On Carlos's row click **PDF**. A file `boleta_Carlos_Pérez_Julio_2026.pdf` (approx) downloads.
2. Open the PDF.
   - PASS: contains "Boleta de Pago", "Julio 2026", "Carlos Pérez", earnings rows (Pago Regular/Dominical/Bono Feriado), a **Descuentos** section listing "Adelanto (prueba) - S/ 50.00", a green **TOTAL A PAGAR** = N − 50, and a **"Firma del trabajador"** signature line.
   - FAIL if PDF doesn't download, is blank, or omits the deduction / signature line.

## Cleanup
- In the Descuentos modal, delete the "Adelanto prueba" test deduction.
