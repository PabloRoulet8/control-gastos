# Informe de arquitectura — Control de Gastos

> **Estado analizado:** rama `main`, commit `a990e97` (2026-10-26).
> **Alcance:** revisión estática de páginas HTML, controladores, servicios, store, acceso a Firestore, reglas de seguridad, PWA/Service Worker y configuración de despliegue.
> **Fuera de alcance:** pruebas E2E, auditoría de accesibilidad visual y verificación del estado real de las reglas en la consola de Firebase.

## 1. Resumen ejecutivo

Control de Gastos es una PWA multipágina para registrar y analizar gastos personales y compartidos por hogar. Está construida con JavaScript ES Modules, HTML y CSS sin framework ni bundler. Firebase Authentication resuelve la identidad, Cloud Firestore la persistencia y Firebase Hosting la distribución. La aplicación incorpora caché persistente de Firestore, Service Worker, reconocimiento de voz, un backend externo de IA y gráficos.

La arquitectura evolucionó desde un controlador monolítico hacia una separación por capas. La pantalla de carga es hoy el mejor ejemplo: `controller_carga.js` orquesta, `CargaStore` centraliza estado, `FormService` y otros servicios concentran reglas de negocio, `FormUI`/`InventarioUI` encapsulan DOM y `GastoRepository` persiste. También se migraron los gastos a rutas anidadas y las compras en cuotas se guardan con `WriteBatch`.

La aplicación escribe y lee gastos exclusivamente bajo `/usuarios/{uid}/gastos` y `/hogares/{hogarId}/gastos`; la colección raíz de gastos y el código de migración legacy fueron eliminados. Además, las reglas no están desplegadas de forma verificable desde el repositorio y su contrato actual no coincide con varios flujos de lectura entre miembros del hogar.

| Dimensión | Estado | Observación |
|---|---|---|
| Separación de capas | Parcial | Excelente en carga; adopción desigual en el resto de controladores. |
| Persistencia | Buena | Rutas anidadas y lotes atómicos para cuotas. |
| Seguridad de datos | En revisión | Reglas versionadas y compiladas en dry-run, con brechas de contrato y XSS residual. |
| Resiliencia offline | Buena base | Caché persistente + Service Worker; falta estrategia de actualización y errores de sincronización. |
| Testabilidad | Baja | Sin framework de tests, lint, build ni integración continua. |
| Escalabilidad de datos | Baja/Media | Lecturas completas de colecciones y filtrado en cliente. |

**Veredicto:** la base es funcional y adecuada para uso personal o grupos pequeños, pero no debería considerarse lista para producción sin resolver primero las deudas de prioridad alta de la sección 5.

## 2. Arquitectura actual

### 2.1 Vista de capas

```text
HTML multipágina
      |
      v
Controladores (DOMContentLoaded + onAuthStateChanged)
      |
      +--> CargaStore (estado global de carga y Pub/Sub)
      +--> Servicios de dominio y utilidades
      |       FormService, CategoryService, InventarioService,
      |       ResumenService, DraftService, VoiceService, IAService
      +--> Componentes de UI
      |       FormUI, InventarioUI, renderizadores, Toast/Modal/Confirm/Chart
      +--> GastoRepository
      |       |
      |       v
      |   Cloud Firestore
      |
      +--> PWA
              pwa.js -> sw.js -> Cache Storage
              firebase-config.js -> IndexedDB (caché persistente)
```

La dirección esperada es `controlador -> servicio/store -> repositorio -> Firebase`. En la práctica, siete de los ocho controladores importan funciones de Firestore directamente y consultan la base sin pasar por el repositorio. Las 33 llamadas directas detectadas se distribuyen así: `controller_resumen` 8, `controller_config_hogar` 7, `controller_dashboard` 6, `controller_admin_hogar` 4, `controller_carga` 3, `controller_perfil` 3 y `controller_historial` 2.

### 2.2 Estructura del repositorio

| Ruta | Responsabilidad |
|---|---|
| `*.html` | Shell de cada pantalla y carga de módulos. |
| `js/controller_*.js` | Entrada de página, autenticación, eventos, coordinación y parte del renderizado. |
| `js/api/GastoRepository.js` | Acceso a gastos, hogares y configuración. |
| `js/services/` | Reglas de negocio y adaptadores: formulario, categorías, inventario, resumen, borradores, voz e IA. |
| `js/store/CargaStore.js` | Store singleton con estado privado, clonado superficial y suscripciones. |
| `js/ui/` | Componentes y renderizadores: formulario, inventario, resumen, historial, perfil, administración, gráficos, modales y toasts. |
| `js/utils/` | Utilidades generales y construcción de navegación contextual. |
| `js/firebase-config.js` | Inicialización de Firebase Auth y Firestore con persistencia local multitab. |
| `js/auth_guard.js` | Redirección por sesión y verificación de email en cliente. |
| `js/pwa.js`, `sw.js`, `manifest.json` | Registro del Service Worker, instalación y precache del app shell. |
| `css/`, `scss/`, `assets/` | Presentación, fuentes de estilo e imágenes. |
| `firestore.rules`, `firebase.json` | Contrato de seguridad y configuración de Hosting/Firestore. |
| `01_*.md` a `04_*.md` | Documentación funcional y técnica previa. |

### 2.3 Páginas y responsabilidades

| Página | Controlador | Responsabilidad principal |
|---|---|---|
| `login.html` | `controller_login.js` | Registro, inicio de sesión, Google y verificación de email. |
| `index.html` | `controller_dashboard.js` | Onboarding, hogares, tarjetas de acceso y unión por invitación. |
| `carga.html` | `controller_carga.js` | Carga manual, dictado, IA, inventario, cuotas, borrador y guardado. |
| `resumen.html` | `controller_resumen.js` | KPIs, presupuestos, deudas, gráficos e ingresos. |
| `historial.html` | `controller_historial.js` | Listado, filtros y eliminación de gastos. |
| `perfil.html` | `controller_perfil.js` | Nombre, categorías, métodos de pago y presupuestos personales. |
| `config_hogar.html` | `controller_config_hogar.js` | Miembros, administradores, nombre y expulsiones del hogar. |
| `admin_hogar.html` | `controller_admin_hogar.js` | Creación y configuración de categorías, fondos y métodos de pago del hogar. |
| `hogar.html` | Ninguno | Página legacy/estática de “Fondo Común”; no está enlazada desde la navegación actual. |

### 2.4 Componentes y responsabilidades

| Módulo | Rol actual |
|---|---|
| `FormService` | Valida monto, categoría, método de pago y cuotas; calcula fechas; construye gastos y cuotas. |
| `CategoryService` | Normaliza categorías, aplica categorías estándar y resuelve coincidencias. |
| `InventarioService` | Normaliza y fusiona productos del inventario. |
| `ResumenService` | Calcula totales personales, fondos, aportes, deudas y compensaciones del hogar. |
| `DraftService` | Guarda, carga y limpia borradores en `localStorage` por usuario, ámbito y hogar. |
| `VoiceService` | Encapsula Web Speech API, estados, reinicios y consolidación de transcripción. |
| `IAService` | Envía texto autenticado al backend de IA y traduce errores HTTP. |
| `CargaStore` | Único estado de la pantalla de carga y notificaciones a suscriptores. |
| `FormUI`, `InventarioUI` | Renderizado y estados visuales del formulario y del inventario. |
| `ResumenRenderer`, `HistorialRenderer`, `PerfilRenderer`, `AdminHogarRenderer` | Renderizado de sus pantallas, con distinto grado de aislamiento. |
| `ToastManager`, `ModalManager`, `ConfirmManager`, `ChartManager` | Interacciones y retroalimentación reutilizable. |
| `NavigationBuilder` | Construye navegación contextual y normaliza el ámbito. |
| `AppUtils` | Formato de moneda, fechas locales, capitalización y escape HTML. |

### 2.5 Modelo de datos en Firestore

```text
usuarios/{uid}
  nombre
  categorias_personales[]
  metodos_pago[]
  fondos[]
  gastos/{gastoId}

hogares/{hogarId}
  nombre
  creador_id
  miembros[]
  administradores[]
  codigo_invitacion
  categorias_compartidas[]
  presupuestos_compartidos[]
  metodos_pago[]
  gastos/{gastoId}

config/hogar_config_{hogarId}
config/estado_deudas_{contextoId}
```

Campos habituales de un gasto:

| Campo | Uso |
|---|---|
| `fecha` | Fecha local `YYYY-MM-DD`. |
| `monto` | Importe numérico. |
| `categoria` | Nombre normalizado de categoría. |
| `detalle_inventario` | Productos asociados a la compra. |
| `responsable` | UID de quien realizó el gasto. |
| `metodo_pago` | `efectivo` o `tarjeta-credito`. |
| `tipo` | `individual`, `general`, `ingreso` o `pagoDeuda`. |
| `ambito` | `personal` o `hogar`. |
| `usuario_id` | UID que creó el documento. |
| `hogar_id` | Solo en gastos de hogar. |
| `creador_email` | Email del creador. |
| `timestamp` | `serverTimestamp()` de Firestore. |
| `es_cuota`, `compra_id` | Marcan cuotas y agrupan una compra financiada. |

La separación física por ámbito es correcta: los gastos personales viven bajo el usuario y los compartidos bajo el hogar. El campo `ambito` y `hogar_id` siguen siendo necesarios para validar y consultar reglas, y permiten que el resumen reconstruya la contabilidad compartida.

### 2.6 Decisiones arquitectónicas relevantes

- **Aplicación estática multipágina:** no hay servidor de aplicación ni router SPA; cada HTML es una entrada independiente y Hosting sirve archivos estáticos.
- **Firebase como backend:** Auth y Firestore evitan mantener una API propia para el CRUD principal. El único backend propio es el servicio de IA.
- **Rutas anidadas:** los gastos se aíslan por usuario u hogar, lo que reduce el riesgo de mezclar datos y facilita reglas por subcolección.
- **Repositorio como fachada:** `GastoRepository` contiene las operaciones de escritura y parte de lectura, pero no es el único punto de acceso.
- **Store solo en carga:** `CargaStore` resuelve el estado de la pantalla más compleja; el resto de páginas mantiene variables locales y lectura directa.
- **Persistencia offline doble:** Firestore usa `persistentLocalCache` con `persistentMultipleTabManager`; el Service Worker cachea el app shell y los módulos.
- **Servicios estáticos:** la mayoría usa clases con métodos estáticos, lo que simplifica el uso pero dificulta inyección y testing.

## 3. Flujo de carga de gastos

### 3.1 Secuencia principal

1. `auth_guard.js` verifica la sesión y, en cliente, exige email verificado.
2. `controller_carga.js` obtiene `ambito` y `hogarId` desde la URL, normaliza el ámbito y construye navegación contextual.
3. `CargaStore` recibe usuario, ámbito, hogar e inventario inicial.
4. El controlador lee el perfil propio y, en ámbito hogar, el documento del hogar para obtener categorías compartidas y miembros.
5. Se llena el selector de responsable con los nombres de los miembros y se carga el borrador correspondiente desde `localStorage`.
6. El usuario carga el gasto manualmente o mantiene presionado el micrófono. `VoiceService` produce transcripción interina/confirmada y `IAService` la envía al backend con el ID token de Firebase.
7. La respuesta de IA se vuelca al formulario: monto, categoría, método de pago, cuotas, referencia e inventario.
8. Al enviar, `FormService.validarFormulario()` valida los datos y `FormService.construirGasto()` o `construirGastosEnCuotas()` genera el payload.
9. `GastoRepository.guardarGasto()` persiste un gasto individual; `guardarGastosEnLote()` usa un `WriteBatch` para las cuotas.
10. Se muestra confirmación, se limpian formulario, borrador e inventario y se actualiza la UI.

### 3.2 Carga manual, voz e IA

La carga manual y la dictada comparten el mismo formulario y las mismas validaciones. La voz no guarda directamente: primero transcribe, luego el backend interpreta el texto y finalmente el usuario puede revisar y corregir los campos. La llamada de IA tiene `AbortController`, timeout de 45 segundos y distintos mensajes para timeout, error de red o error del servidor.

El inventario se mantiene en `CargaStore` y `InventarioService` normaliza unidades y fusiona productos equivalentes. `InventarioUI` solo dibuja el estado y notifica la eliminación mediante callback.

### 3.3 Compra en cuotas

- Solo se habilita para `tarjeta-credito`.
- El mínimo es 2 cuotas y el máximo 36.
- `FormService.calcularFechasCuotas()` desplaza mes a mes y opcionalmente suma un mes si la compra es posterior al cierre.
- Cada cuota conserva el monto dividido, referencia con número de cuota y total, `es_cuota: true` y un `compra_id` común.
- `guardarGastosEnLote()` valida el contexto, crea un `writeBatch`, firma cada documento y confirma el lote completo.
- El límite técnico de 500 operaciones está validado, aunque la UI nunca genera más de 36.

### 3.4 Borradores y estado

`CargaStore` centraliza usuario, ámbito, hogar, nombre del hogar, inventario y categorías. El estado se expone clonado de forma superficial y se notifica a suscriptores. `DraftService` persiste una versión mínima del formulario por contexto para sobrevivir a recargas y navegación. La UI de carga todavía conserva estado local para transcripción, procesamiento de IA y referencias a nodos DOM.

### 3.5 Ruta offline

```text
Firestore write
   -> caché local IndexedDB
   -> confirmación inmediata en UI
   -> sincronización diferida al recuperar conexión

App shell / módulos
   -> Cache Storage (sw.js)
   -> respuesta cache-first
   -> actualización de caché en segundo plano al obtener 200
```

Antes de guardar, el controlador detecta `navigator.onLine === false` y muestra un toast de advertencia, pero no bloquea el guardado. La promesa de Firestore se resuelve localmente y la sincronización real ocurre después. No existe actualmente una UI que informe si una escritura offline fue rechazada al sincronizarse.

## 4. Seguridad y resiliencia

### 4.1 Autenticación y autorización

- Firebase Authentication gestiona email/contraseña y Google.
- El registro por email exige verificación en el cliente; las cuentas de Google se consideran verificadas.
- `auth_guard.js` redirige a `login.html` si no hay sesión y cierra sesión si el email no está verificado.
- Las reglas de Firestore exigen `request.auth != null`, pero no verifican `request.auth.token.email_verified`.
- La autorización de hogar se basa en `miembros`, `creador_id` y `administradores`.

### 4.2 Contrato actual de `firestore.rules`

| Ruta | Lectura | Creación | Actualización | Borrado |
|---|---|---|---|---|
| `/usuarios/{uid}` | Solo el propio usuario (`get`); `list` denegado | Propio usuario | Propio usuario | Denegado |
| `/usuarios/{uid}/gastos/{id}` | Propio usuario | Propio usuario con `usuario_id` y `responsable` iguales al UID | Propietario original y nuevo `usuario_id`/`responsable` propios | Propietario |
| `/hogares/{hogarId}` | Miembro (`get`); `list` filtrado por membresía | Usuario autenticado que se incluye como creador y miembro | Admin, o miembro limitado a nombre/categorías/presupuestos/métodos de pago | Admin |
| `/hogares/{hogarId}/gastos/{id}` | Miembro | Miembro con `usuario_id` propio | Miembro propietario del gasto | Cualquier miembro |
| `/config/{docId}` | Propietario o miembro del contexto | Misma condición | Misma condición | Misma condición |

Las reglas fueron validadas con `firebase deploy --only firestore:rules --dry-run --project control-gastos-cf09c`. El dry-run confirma sintaxis y compilación, no el despliegue ni el comportamiento con datos reales.

### 4.3 Brechas entre reglas y aplicación

1. **Lecturas de perfiles de otros miembros:** `controller_carga`, `controller_historial`, `controller_resumen` y `controller_config_hogar` hacen `getDoc(/usuarios/{otroUid})` para mostrar nombres. La regla actual solo permite `get` del propio usuario. Con las reglas desplegadas, esas lecturas pueden fallar con `permission-denied`.
2. **Unión por código de invitación:** `unirseAHogar()` consulta `hogares` por `codigo_invitacion`, pero la regla `list` exige pertenencia. Un usuario nuevo no puede descubrir el hogar y el flujo queda bloqueado.
3. **Lecturas de hogares:** el flujo normal por `array-contains` sí coincide con la regla de `list`; consultas por código no.

### 4.4 XSS y manejo de contenido

La pantalla de carga está bien protegida: `actualizarTranscripcionUI()` usa `textContent`, `ToastManager` usa `textContent`, `InventarioUI` construye nodos y asigna texto, y `FormService` escapa la referencia antes de persistirla. `AppUtils.escapeHTML()` está disponible y varios renderizadores lo usan.

Sin embargo, la práctica no es uniforme:

- `controller_dashboard.js` interpola `hogar.nombre` en `innerHTML`.
- `controller_config_hogar.js` interpola `userData.nombre` en `innerHTML`.
- `controller_resumen.js` usa `innerHTML` para valores numéricos y textos estáticos, con menor riesgo, pero mantiene el patrón.
- `NavigationBuilder` usa `innerHTML` con valores controlados por código.
- No hay Content Security Policy en `firebase.json`.

Un nombre de hogar malicioso puede persistirse y ejecutarse en el navegador de otro miembro al abrir el dashboard. Es un XSS almacenado de prioridad alta aunque el vector requiera que la víctima abra la pantalla afectada.

### 4.5 Resiliencia y PWA

- `firebase-config.js` inicializa Firestore con caché persistente y soporte multitab.
- `sw.js` usa `gastos-v13.0`, precachea páginas, estilos, módulos, controladores, renderizadores, utilidades e iconos.
- `activate` elimina cachés anteriores y aplica `clients.claim()`.
- `fetch` es cache-first para todos los GET; si no hay caché, consulta la red y guarda respuestas 200.
- `firebase.json` envía `Cache-Control: no-cache` para `sw.js`.
- `pwa.js` registra el Service Worker y llama a `registration.update()`, pero no muestra un aviso de nueva versión ni fuerza recarga.
- La instalación del Service Worker es todo-o-nada: si falta un recurso de `urlsToCache`, falla el `install`.
- El `fetch` también intercepta GET de terceros y puede cachear SDKs, fuentes o CDN con respuestas válidas.
- El guardado offline no tiene confirmación del servidor ni canal de error de sincronización.
- `IAService` depende de un backend externo; el controlador mitiga lentitud con timeout de 45 segundos, pero no hay reintento automático ni fallback local de interpretación.

## 5. Deuda Técnica

La deuda se ordena por prioridad de riesgo. “Alta” significa que puede bloquear el uso seguro o romper funciones al desplegar las reglas; “Media” afecta mantenibilidad, escalabilidad o experiencia; “Baja” es higiene técnica.

| ID | Prioridad | Deuda | Impacto | Acción recomendada |
|---|---|---|---|---|
| DT-01 | Alta | XSS almacenado por `innerHTML` con datos de usuario en dashboard y configuración de hogar. | Un nombre de hogar o de miembro puede ejecutar HTML/JS en otra sesión. | Reemplazar interpolaciones por `textContent`/nodos o escapar con un helper único; agregar tests de XSS. |
| DT-02 | Alta | Contrato roto entre reglas y lecturas de perfiles de otros miembros. | Al desplegar reglas, pueden fallar responsables, historial, resumen y administración de miembros. | Crear una proyección pública de perfiles (`nombre`, avatar) legible por miembros, o resolver nombres mediante Cloud Function/custom claims. |
| DT-03 | Alta | Unión por código incompatible con la regla `list` de hogares y sujeta a carrera. | El enlace de invitación no funciona con reglas estrictas; dos uniones simultáneas pueden pisar `miembros`. | Modelar invitaciones en subcolección/documento con token, expiración y límites; unir mediante transacción o backend. |
| DT-05 | Alta | Reglas sin despliegue verificado ni pruebas automatizadas de seguridad. | Producción puede seguir con reglas permisivas o romperse al aplicarlas. | Añadir tests con Firebase Emulator Suite, validar en staging y documentar el despliegue. |
| DT-06 | Media | Firestore accedido directamente desde siete controladores. | Duplicación, reglas de negocio dispersas y difícil testing. | Ampliar repositorios por agregado y prohibir imports de Firestore fuera de `js/api`. |
| DT-07 | Media | `controller_carga.js` sigue teniendo 1.117 líneas. | Alto costo de cambio, estados difíciles de seguir y riesgo de regresión. | Extraer orquestadores de guardado, carga de contexto, dictado/IA y selectores de responsables. |
| DT-08 | Media | Uso inconsistente de `innerHTML` y ausencia de CSP. | Superficie XSS y defensa en profundidad insuficiente. | Unificar renderizado seguro, añadir CSP y headers de seguridad en Hosting. |
| DT-09 | Media | Lecturas completas de gastos y filtrado en cliente. | Costo y latencia crecen con el historial; límites de Firestore a futuro. | Consultas por rango de fechas, paginación, índices y agregaciones cuando corresponda. |
| DT-10 | Media | Reglas validan pertenencia pero no esquema, tipos ni estado de verificación. | Datos inválidos, writes amplios en configuración y cuentas no verificadas a nivel servidor. | Validar campos/rangos, exigir email verificado y restringir cambios compartidos según rol. |
| DT-11 | Media | Montos en punto flotante y cuotas sin distribución de centavos. | Diferencias de redondeo y descuadres en compras financiadas. | Usar centavos enteros o una librería decimal y asignar el remanente a una cuota. |
| DT-12 | Media | Service Worker cache-first sin estrategia de actualización; precache todo-o-nada. | Usuarios pueden quedar con shell/JS viejo o sin SW si falla un recurso. | Network-first para navegación, cache versionado, fallback por recurso y aviso de actualización. |
| DT-13 | Media | Códigos de invitación con `Math.random`, sin expiración ni revocación. | Tokens predecibles, permanentes y sin control de abuso. | Usar `crypto.getRandomValues`, expiración, revocación y rate limiting. |
| DT-14 | Media | Sin `package.json`, lint, tests, build ni integración continua; CDNs sin versión estricta (`lucide@latest`). | Regresiones silenciosas y builds no reproducibles. | Incorporar tooling mínimo, fijar versiones, agregar SRI y CI. |
| DT-15 | Baja | `hogar.html` legacy, IDs de configuración por `split('_')`, doble escape HTML y versiones de caché inconsistentes. | Ruido, fragilidad y comportamiento sutil inesperado. | Eliminar página muerta, encapsular claves, separar escape de presentación y unificar versionado. |

### Orden sugerido de resolución

1. **DT-02, DT-03 y DT-05:** definir el contrato real de acceso a perfiles e invitaciones, probarlo en emulador y recién después desplegar reglas.
2. **DT-01 y DT-08:** cerrar XSS y añadir CSP antes de exponer la app a más usuarios.
3. **DT-06, DT-07 y DT-09:** consolidar la capa de datos y dividir la carga para reducir el costo de los próximos cambios.
4. **DT-10 a DT-15:** endurecer validaciones, precisión monetaria, PWA y tooling de forma incremental.

### Criterios de cierre recomendados

- Las reglas pasan tests automatizados en emulador y un despliegue en staging sin errores `permission-denied` en los flujos reales.
- Un nombre de hogar/perfil con etiquetas HTML no ejecuta código en ninguna pantalla.
- El enlace de invitación funciona con reglas estrictas, expira y no puede reutilizarse de forma indefinida.
- Todas las lecturas y escrituras de gastos usan exclusivamente las subcolecciones por usuario y hogar.
- El flujo de carga sigue funcionando offline y existe visibilidad de errores de sincronización.
- Cada cambio relevante puede verificarse con lint, tests y un pipeline reproducible.
