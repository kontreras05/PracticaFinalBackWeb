# Parte 2 — Preguntas Socráticas: Respuestas

---

## Pregunta 1 — ZodError en `error-handler.js:19`

> *El handler detecta ZodError por `error.name === 'ZodError'`. ¿Qué ocurre si Zod lanza un error cuyo `name` es diferente en la versión 4.x que usas (zod@4.3.6)? Comprueba qué `name` real tiene con un `console.log` en un test fallido.*

### Respuesta

En **Zod v4** (a partir de la v4.0), la clase de error de validación pasó a llamarse `ZodError` pero internamente su propiedad `name` sigue siendo `"ZodError"`. Sin embargo, Zod 4 introdujo un **cambio arquitectónico importante**: ahora los errores de validación pueden lanzarse también como `ZodSafeParseError` o simplemente como un objeto con la propiedad `issues` sin que su `name` sea necesariamente `"ZodError"`, dependiendo de si se usa `.parse()` (que lanza excepción) o `.safeParse()` (que devuelve un resultado).

Si por algún motivo futuro o por un edge case de la v4.x el `name` cambiara (por ejemplo a `"ZodValidationError"`), nuestro handler **no lo capturaría** en la condición `error.name === 'ZodError'`, y el error caería como un error 500 genérico, devolviendo un mensaje poco útil al cliente.

**Mitigación ya implementada en nuestro código:** En la línea 19 del `error-handler.js` ya tenemos una **doble condición**:

```js
if (error.name === 'ZodError' || (error.issues && Array.isArray(error.issues))) {
```

La segunda parte (`error.issues && Array.isArray(error.issues)`) es un **duck typing**: si el error tiene una propiedad `issues` que es un array, lo tratamos como un error de Zod independientemente del `name`. Esto nos protege ante posibles cambios del nombre de la clase en futuras versiones de Zod.

**Para comprobarlo con un `console.log`**, bastaría con añadir antes del `if`:

```js
console.log('Error name:', error.name, '| Has issues:', !!error.issues);
```

Al ejecutar un test que envíe datos inválidos a un endpoint validado con Zod, veríamos en consola el `name` real del error y confirmaríamos si coincide con `'ZodError'`.

---

## Pregunta 2 — `matchStage` con `deleted: { $ne: true }` en el dashboard

> *El `matchStage` filtra `deleted: { $ne: true }`. ¿Por qué no se usa el plugin `applySoftDelete` aquí y qué pasaría si olvidaras este filtro en el aggregate?*

### Respuesta

El plugin `applySoftDelete` (en `softDelete.ts`) aplica un hook `pre` sobre operaciones que coinciden con el patrón `/^find/`:

```ts
schema.pre(/^find/, function (this: any) {
  if (!Object.prototype.hasOwnProperty.call(this._conditions, 'deleted')) {
    this.where({ deleted: { $ne: true } });
  }
});
```

Este hook **sólo intercepta** métodos de consulta de Mongoose que empiezan por `find` (como `find`, `findOne`, `findById`, `findOneAndUpdate`, etc.). **No intercepta `aggregate()`**, porque `aggregate` no es una operación de tipo *query* sino una operación de tipo *aggregate pipeline* en Mongoose. Son dos sistemas distintos.

Por eso, en el `dashboard.controller.js` debemos añadir **manualmente** el filtro `deleted: { $ne: true }` dentro del `$match` stage del pipeline de agregación.

**¿Qué pasaría si olvidáramos este filtro?** Las estadísticas del dashboard **incluirían albaranes borrados lógicamente**: se sumarían sus horas, materiales y conteos, dando cifras infladas e incorrectas al usuario. Peor aún, aparecerían datos de albaranes que el usuario "eliminó" y espera que no existan, lo que sería un **bug funcional y de experiencia de usuario** grave.

---

## Pregunta 3 — Pre-hook de save y explotación en albaranes firmados

> *El pre-hook de save bloquea modificaciones si está firmado salvo que se modifique `signed`. ¿Puede un usuario malintencionado explotar este agujero para editar un albarán firmado cambiando otro campo y luego `signed` en la misma operación?*

### Respuesta

La lógica del hook es:

```ts
deliveryNoteSchema.pre<IDeliveryNote>('save', async function () {
  if (!this.isNew && !this.isModified('signed') && this.signed) {
    throw AppError.conflict('No se puede modificar un albarán firmado.');
  }
});
```

La condición bloquea **solo si**:
1. El documento **no es nuevo** (`!this.isNew`)
2. El campo `signed` **no se ha modificado** (`!this.isModified('signed')`)
3. El documento **está firmado** (`this.signed === true`)

**Sí, existe un agujero explotable.** Si un atacante envía una operación que modifica, por ejemplo, `description` y **al mismo tiempo** establece `signed: true` (o lo cambia a `false` y luego a `true`), el hook ve que `signed` **sí ha sido modificado** (`this.isModified('signed')` retorna `true`), por lo que la segunda condición (`!this.isModified('signed')`) es `false` y **el guard no se activa**. Esto permitiría que los cambios en `description` (u otros campos) se guarden junto con la modificación de `signed`.

**Escenarios de explotación concretos:**
- **Marcar `signed: true` de nuevo** (ya lo estaba): Mongoose detecta el `set` como modificación incluso si el valor no cambia realmente, por lo que incluir `signed: true` en el body sería suficiente para saltar el guard.
- **Cambiar `signed` a `false` y luego a `true`**: Altera el estado y permite editar todo.

**Solución recomendada:** Reforzar el hook para que, si el documento ya está firmado en la BD (valor original), solo permita la modificación del campo `signed` y nada más:

```ts
deliveryNoteSchema.pre<IDeliveryNote>('save', async function () {
  if (!this.isNew && this.signed) {
    const modifiedPaths = this.modifiedPaths().filter(p => p !== 'updatedAt');
    if (this.isModified('signed')) {
      if (modifiedPaths.length > 1 || !modifiedPaths.includes('signed')) {
        throw AppError.conflict('No se puede modificar otros campos de un albarán firmado.');
      }
    } else {
      throw AppError.conflict('No se puede modificar un albarán firmado.');
    }
  }
});
```

---

## Pregunta 4 — Caché Redis con EventEmitter desacoplado

> *Si añadieras un middleware de caché Redis entre el controlador del dashboard y la BD, ¿cómo garantizarías que la caché se invalida cuando se firma o elimina un albarán, dado que usas un EventEmitter desacoplado?*

### Respuesta

Nuestro `NotificationService` (en `notification.service.js`) ya extiende `EventEmitter` y emite eventos como `deliverynote:signed` y `deliverynote:new`. La estrategia de invalidación seguiría este patrón **event-driven**:

### Estrategia de invalidación

1. **Definir claves de caché consistentes** — La caché del dashboard se almacenaría con una clave basada en el `companyId`, por ejemplo: `dashboard:stats:{companyId}`.

2. **Suscribirse a eventos relevantes** — Registrar listeners en el `notificationService` para los eventos que invalidan las estadísticas:

```js
import { redisClient } from './redis.service.js';

// Cuando se firma un albarán, las estadísticas cambian
notificationService.on('deliverynote:signed', async (data) => {
  await redisClient.del(`dashboard:stats:${data.companyId}`);
});

// Cuando se crea un nuevo albarán
notificationService.on('deliverynote:new', async (data) => {
  await redisClient.del(`dashboard:stats:${data.companyId}`);
});

// Habría que añadir también un evento para soft-delete
notificationService.on('deliverynote:deleted', async (data) => {
  await redisClient.del(`dashboard:stats:${data.companyId}`);
});
```

3. **Middleware o lógica en el controlador del dashboard** — Antes de ejecutar el aggregate, comprobar si hay datos en caché:

```js
const cacheKey = `dashboard:stats:${companyId}`;
const cached = await redisClient.get(cacheKey);
if (cached) return res.json(JSON.parse(cached));

// ... ejecutar aggregates ...
await redisClient.setEx(cacheKey, 300, JSON.stringify({ byMonth, byClient, byProject }));
```

### Garantías y problemas potenciales

- **Consistencia eventual**: El patrón es **eventualmente consistente**. Hay una ventana de tiempo mínima entre el emit del evento y la invalidación de la caché donde un usuario podría ver datos antiguos.
- **TTL como red de seguridad**: Establecer un TTL (ej. 5 minutos) en la caché garantiza que, incluso si un evento se pierde, los datos se refrescan automáticamente.
- **Evento faltante**: Actualmente no hay evento `deliverynote:deleted` en el `notification.service.js`. Habría que añadirlo para cubrir ese caso, o la caché nunca se invalidaría al eliminar un albarán.

---

## Pregunta 5 — `softDelete.ts` en `find*` vs filtro manual en aggregate

> *Tu `softDelete.ts` aplica filtro automático en todos los `find*`, pero el aggregate del dashboard lo aplica manualmente. ¿Cuál es la razón técnica de esta diferencia y cómo afectaría unificarlos en un hook `pre('aggregate')` a la legibilidad frente al riesgo de filtros dobles?*

### Respuesta

### Razón técnica de la diferencia

Mongoose distingue dos tipos de middleware según la operación:

| Tipo | Operaciones | Hook disponible |
|------|------------|-----------------|
| **Query middleware** | `find`, `findOne`, `findById`, `findOneAndUpdate`, etc. | `pre(/^find/, ...)` |
| **Aggregate middleware** | `aggregate()` | `pre('aggregate', ...)` |

Nuestro plugin `applySoftDelete` usa `schema.pre(/^find/, ...)`, que es un **query middleware**. El `aggregate()` de Mongoose **no dispara hooks de query**, porque internamente no pasa por el sistema de `Query` sino por el sistema de `Aggregate`. Son pipelines distintos a nivel de driver.

Por eso, el aggregate del dashboard **debe filtrar manualmente** `deleted: { $ne: true }` en su `$match` stage.

### Unificación con `pre('aggregate')`

Se podría añadir un hook `pre('aggregate')` al plugin para inyectar automáticamente un `$match` al inicio del pipeline:

```ts
schema.pre('aggregate', function () {
  this.pipeline().unshift({ $match: { deleted: { $ne: true } } });
});
```

### Ventajas

- **Consistencia**: No habría que recordar añadir el filtro `deleted` manualmente en cada aggregate.
- **Menos errores humanos**: Elimina el riesgo de olvidar el filtro (como en la Pregunta 2).

### Desventajas y riesgos

1. **Filtros dobles**: Si un desarrollador ya tiene `deleted: { $ne: true }` en su `$match` manual (como en nuestro dashboard), el hook inyectaría un `$match` adicional al principio del pipeline. Aunque MongoDB optimiza `$match` consecutivos fusionándolos, genera **confusión en la lectura del código** — el desarrollador ve un filtro explícito pero no sabe que hay otro oculto.

2. **Legibilidad reducida**: Al leer el pipeline del dashboard, el filtro `deleted: { $ne: true }` dentro del `matchStage` comunica **explícitamente** que estamos excluyendo borrados. Si lo quitamos y lo delegamos al hook, el pipeline parece ignorar el soft delete, y un desarrollador nuevo tendría que conocer la existencia del hook para entender el comportamiento completo. **Lo implícito perjudica la legibilidad.**

3. **Casos donde SÍ quieres documentos borrados**: Si en el futuro necesitas un aggregate que incluya documentos borrados (ej. un informe de auditoría), tendrías que implementar un mecanismo para desactivar el hook, añadiendo complejidad.

### Conclusión

La diferencia es puramente técnica (Mongoose no aplica hooks de query a aggregates). Unificarlos en un `pre('aggregate')` **mejora la seguridad** pero **reduce la legibilidad** y crea el riesgo de filtros dobles. El enfoque más equilibrado sería:
- Añadir el `pre('aggregate')` al plugin para seguridad.
- **Eliminar** el filtro manual de los aggregates existentes para evitar duplicación.
- Documentar claramente el comportamiento del hook para que otros desarrolladores lo conozcan.
