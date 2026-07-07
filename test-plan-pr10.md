# Test Plan — PR #10: Empleados name+salary only; Reportes month/year

Target: production https://guevara-tech-asistencia-rouge.vercel.app (PR #10 merged)
Account: admin `admin@guevaratech.com` / `admin123`

## Test 1 — Add employee with only Nombre + Salario (no email/password)
1. Admin → **Empleados** (`/admin`). Click **+ Agregar Empleado**.
   - PASS: form shows exactly two fields — **Nombre Completo** and **Salario Mensual (S/)**. NO "Email" field, NO "Contraseña" field.
   - FAIL if an Email or Contraseña input is present (old behavior).
2. Table header shows **Salario Mensual** column, NOT **Email**.
3. Enter Nombre = "Test Devin QA", Salario = **900** → Guardar.
   - PASS: new row appears; its Salario column reads **S/ 900.00**; status **Activo**; success banner "Empleado agregado exitosamente".
   - FAIL if 400 error "Nombre, email y contraseña son requeridos", or no row added.

## Test 2 — Editar Salario
1. On the "Test Devin QA" row click **Editar Salario** (replaces old "Cambiar Clave").
   - PASS: inline number input appears (not a password field).
2. Change to **1000** → Guardar.
   - PASS: row Salario updates to **S/ 1000.00**; banner "Salario actualizado".
   - FAIL if value unchanged or password-related UI shown.

## Cleanup 1
- Delete "Test Devin QA" via **Eliminar** (confirm dialog) → row removed.

## Test 3 — Reportes month/year + semanal/mensual
1. Admin → **Reportes** (`/admin/reportes`).
   - PASS: header controls include a **Mes** dropdown and a **Año** dropdown (in addition to employee selector + Semanal/Mensual toggle).
   - FAIL if no month/year dropdowns (old behavior).
2. Select Mes=**Julio**, Año=**2026**, view = **Mensual**.
   - PASS: a section titled "Julio 2026" lists employees with worked days (e.g. Gino "2 días trabajados", hours > 0). Employee cards show days trabajados, NOT an email address.
   - FAIL if an email like `empleado-...@guevaratech.local` shows under a name.
3. Select Mes=**Enero**, Año=**2026** (no attendance).
   - PASS: shows "No hay datos para Enero 2026".
   - FAIL if it still shows July data (proves month selector is wired).
4. Back to Julio 2026, switch toggle to **Semanal**.
   - PASS: renders one or more sections labeled "Semana 1"…"Semana N" with date ranges within July; the week containing the clocked-in day shows the employee's hours.
   - FAIL if it shows a single whole-month section identical to Mensual (proves weekly split works).

## Adversarial note
Steps 3 (Enero empty vs Julio populated) and 4 (Semanal week-split vs Mensual single section) would look identical if the month/year + grouping change were broken; they force visibly different output.
