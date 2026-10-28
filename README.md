# Control de Gastos

PWA multipágina para registrar, compartir y analizar gastos personales y de hogar. Construida con JavaScript ES Modules, HTML y CSS sin framework ni bundler; se apoya en Firebase Authentication, Cloud Firestore y Firebase Hosting, y funciona offline gracias a la caché persistente de Firestore y a un Service Worker propio.

## Funcionalidad

- Carga manual, por dictado de voz o interpretada por IA (backend externo autenticado con ID token).
- Gastos personales y compartidos por hogar, con responsables, categorías, métodos de pago y presupuestos.
- Compras en cuotas con distribución exacta de centavos y guardado atómico mediante `WriteBatch`.
- Resumen con KPIs, deudas entre miembros, fondos, gráficos e inventario.
- Invitaciones de hogar con token aleatorio, expiración, consumo transaccional y revocación.
- Instalación como PWA con estrategia Network-First para navegación y Stale-While-Revalidate para assets.

## Arquitectura en capas

```text
HTML multipágina
      |
      v
Controladores (js/controller_*.js)
      |
      +--> Store (CargaStore)
      +--> Servicios de dominio (js/services/)
      +--> Componentes de UI (js/ui/)
      +--> Repositorios (js/api/)
      |
      v
Firebase (Auth + Firestore) y backend de IA
```

Los controladores orquestan eventos y autenticación; las reglas de negocio viven en `js/services/`, el estado de la pantalla de carga en `js/store/`, el renderizado en `js/ui/` y el acceso a Firestore en `js/api/`. Ningún controlador importa `firebase/firestore`.

| Ruta | Responsabilidad |
|---|---|
| `js/controller_*.js` | Entrada de cada página y coordinación. |
| `js/services/` | Reglas de negocio: formulario, guardado, categorías, resumen, voz, IA, hogar. |
| `js/api/` | Repositorios y servicios de acceso a datos. |
| `js/ui/` | Componentes y renderizadores de DOM. |
| `js/utils/` | Utilidades compartidas y navegación contextual. |
| `firestore.rules` | Contrato de seguridad multi-tenant. |
| `firestore.indexes.json` | Índices compuestos de Firestore (vacío: el esquema actual no los requiere). |

## Motor contable en centavos

Los importes se persisten redondeados a dos decimales y la aritmética se realiza en centavos para evitar errores de punto flotante. `AppUtils` expone `aCentavos()`, `aPesos()`, `redondearMonto()` y `sumarMontos()`. En compras en cuotas, el remanente de la división se distribuye para que la suma de las cuotas coincida exactamente con el total.

## Seguridad multi-tenant en Firestore

- `isSignedIn()` exige sesión con `email_verified == true`, en línea con `auth_guard.js`.
- Los gastos personales viven en `/usuarios/{uid}/gastos` y los compartidos en `/hogares/{hogarId}/gastos`; no existe colección raíz de gastos.
- Las reglas validan esquema y tipos (`gastoValido`, `hogarValido`, `perfilPublicoValido`), pertenencia al hogar, rol de administrador, `hogar_id` del gasto y límites defensivos de tamaño en `/config`.
- Los perfiles de otros miembros se leen desde la proyección `perfiles_publicos` (`get` autenticado, `list` denegado).
- `firebase.json` aplica CSP y cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- Todo contenido dinámico se escapa una sola vez en el punto de renderizado (`innerHTML`) y se asigna directo en `textContent`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run check` | Verifica la sintaxis de todos los módulos con `node --check`. |
| `firebase deploy --only hosting,firestore:rules` | Publica la PWA y las reglas de seguridad. |
| `firebase deploy --only firestore:indexes` | Publica los índices de Firestore. |

## Despliegue

Requisitos: Node.js 20+, Firebase CLI autenticado y acceso al proyecto `control-gastos-cf09c` (definido en `.firebaserc`).

```bash
npm run check
firebase deploy --only hosting,firestore:rules
```

Hosting sirve la raíz del repositorio; `firebase.json` excluye documentación, scripts, reglas e índices. El Service Worker se sirve con `Cache-Control: no-cache` y cada cambio de app shell debe incrementar `CACHE_NAME` en `sw.js` (`gastos-v30.2` es la versión actual).

## Documentación

- `ARCHITECTURE.md`: informe de arquitectura, contrato de seguridad y deuda técnica.
- `01_La_Cara_Visual_DOM_HTML.md` a `04_Base_De_Datos_Firebase.md`: material didáctico del proyecto.
