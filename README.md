# Control de Gastos

![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?style=flat-square&logo=pwa&logoColor=white)
![Vanilla JS ES Modules](https://img.shields.io/badge/Vanilla%20JS-ES%20Modules-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Firebase v12](https://img.shields.io/badge/Firebase-v12-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Service Worker v30.3](https://img.shields.io/badge/Service%20Worker-v30.3-0F172A?style=flat-square&logo=javascript&logoColor=white)
![Demo](https://img.shields.io/badge/Demo-en%20producci%C3%B3n-22c55e?style=flat-square&logo=firebase&logoColor=white)

PWA multipágina para registrar, compartir y analizar gastos personales y de hogar. Construida con JavaScript ES Modules, HTML y CSS sin framework ni bundler; se apoya en Firebase Authentication, Cloud Firestore y Firebase Hosting, y funciona offline gracias a la caché persistente de Firestore y a un Service Worker propio.

**Demo en producción:** https://control-gastos-cf09c.web.app

## Funcionalidad

- Carga manual, por dictado de voz o interpretada por IA (backend externo autenticado con ID token).
- Gastos personales y compartidos por hogar, con responsables, categorías, métodos de pago y presupuestos.
- Compras en cuotas con distribución exacta de centavos y guardado atómico mediante `WriteBatch`.
- Resumen con KPIs, deudas entre miembros, fondos, gráficos e inventario.
- Invitaciones de hogar con token aleatorio, expiración, consumo transaccional y revocación.
- Instalación como PWA con estrategia Network-First para navegación y Stale-While-Revalidate para assets.
- Feedback no intrusivo al pasar a modo sin conexión y al recuperar la red.

## Decisiones de ingeniería

| Decisión | Implementación | Por qué importa |
|---|---|---|
| **Aritmética en centavos** | `AppUtils` expone `aCentavos()`, `aPesos()`, `redondearMonto()`, `sumarMontos()` y `distribuirEnCuotas()`; el remanente de las cuotas se reparte para que la suma coincida exactamente con el total. | Evita errores de punto flotante y descuadres de centavos en totales, deudas y compras en cuotas. |
| **Reglas multi-tenant** | `firestore.rules` valida sesión con email verificado, esquema, tipos, pertenencia al hogar, rol de administrador y límites de tamaño; gastos aislados en `/usuarios/{uid}/gastos` y `/hogares/{hogarId}/gastos`. | El aislamiento de datos vive en el servidor y no depende de la UI ni del cliente. |
| **Offline-First con SWR** | Firestore con caché persistente multitab + Service Worker propio: Network-First para navegación, Stale-While-Revalidate para assets y precache versionado del app shell. | La app abre y registra gastos sin red; los cambios se sincronizan al recuperar la conexión. |
| **Invitaciones criptográficas** | Token generado con `crypto.getRandomValues`, almacenado en subcolección con expiración de 48 h, consumo transaccional, revocación y validación en reglas. | Evita colisiones, reutilización indefinida y uniones concurrentes que pisen la membresía. |

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
- El texto del usuario se persiste crudo (solo `trim()`) y se escapa una sola vez en el punto de renderizado (`innerHTML`). `AppUtils.desescaparHTMLBasico()` normaliza entidades heredadas (`&#39;`, `&amp;`, `&quot;`) para evitar el doble escape.

## Offline y sincronización

- Firestore mantiene una caché local persistente: las escrituras sin red se resuelven en el dispositivo y se replican al reconectar.
- `pwa.js` escucha los eventos `online` y `offline` y muestra un aviso no intrusivo con el estado de sincronización.
- `IAService.despertarServidor()` hace un ping silencioso al backend de IA al abrir la pantalla de carga (máximo una vez cada 10 minutos por sesión) para mitigar el cold start de Render.

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

Hosting sirve la raíz del repositorio; `firebase.json` excluye documentación, scripts, reglas e índices. El Service Worker se sirve con `Cache-Control: no-cache` y cada cambio de app shell debe incrementar `CACHE_NAME` en `sw.js` (`gastos-v30.3` es la versión actual).

## Documentación

- `ARCHITECTURE.md`: informe de arquitectura, contrato de seguridad y deuda técnica.
- `01_La_Cara_Visual_DOM_HTML.md` a `04_Base_De_Datos_Firebase.md`: material didáctico del proyecto.
