# GuevaraTech - Sistema de Control de Asistencia

Sistema web de control de asistencia y cálculo de planilla para empleados, diseñado para empresas en Perú.

## Funcionalidades

### Administrador
- Agregar y eliminar empleados
- Restablecer contraseñas
- Ver reportes de asistencia (semanal/mensual)
- Calcular y exportar planilla (CSV)

### Empleados
- Registro de entrada (Clock In)
- Salida y regreso de almuerzo
- Registro de salida (Clock Out)
- Ver actividad del día

## Reglas de Planilla (Perú)

- **Salario mensual**: S/ 1,130.00 por empleado
- **Tarifa diaria**: salario mensual / días del mes (30 o 31)
- **Horario**: Lunes a Sábado, 8 horas diarias, 48 horas semanales
- **Pago dominical**: proporcional a los días trabajados en la semana
  - 6/6 días = pago dominical completo
  - 5/6 días = 5/6 del pago dominical
  - etc.
- **Feriados**: si un empleado trabaja en feriado, gana triple (tarifa regular + 2 extras)
- **16 feriados de ley** del Perú incluidos

## Tecnologías

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de datos**: PostgreSQL
- **Autenticación**: NextAuth.js

## Configuración

1. Clonar el repositorio
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```
4. Configurar la base de datos PostgreSQL y actualizar `DATABASE_URL`
5. Ejecutar migraciones:
   ```bash
   npx prisma migrate dev
   ```
6. (Opcional) Cargar datos de prueba:
   ```bash
   npm run db:seed
   ```
7. Iniciar el servidor:
   ```bash
   npm run dev
   ```

## Cuentas de Prueba (después del seed)

- **Admin**: admin@guevaratech.com / admin123
- **Empleado**: carlos@guevaratech.com / empleado123
