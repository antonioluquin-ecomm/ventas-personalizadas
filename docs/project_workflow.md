# Project Workflow — Ventas Personalizadas

| Campo | Detalle |
|-------|---------|
| Versión | v1.0 |
| Actualizado | 2026-07-14 |
| Estado | Activo |
| Documentos relacionados | `../project-standards/ai_rules.md` · `../project-standards/style_guide.md` · `CLAUDE.md` |

---

## Índice

1. [Propósito de este documento](#1-propósito-de-este-documento)
2. [Documentos maestros — dónde vive cada regla](#2-documentos-maestros--dónde-vive-cada-regla)
3. [Tipos de cambios y riesgo](#3-tipos-de-cambios-y-riesgo)
4. [Flujo de trabajo estándar](#4-flujo-de-trabajo-estándar)
5. [Flujo de release](#5-flujo-de-release)
6. [Criterios de cierre y deploy](#6-criterios-de-cierre-y-deploy)
7. [Freeze zones del proyecto](#7-freeze-zones-del-proyecto)
8. [Auditoría vs implementación](#8-auditoría-vs-implementación)
9. [Smoke visual y QA](#9-smoke-visual-y-qa)
10. [Manejo de errores y casos nuevos](#10-manejo-de-errores-y-casos-nuevos)
11. [Documentación técnica vs operativa](#11-documentación-técnica-vs-operativa)
12. [Preparación de un proyecto nuevo](#12-preparación-de-un-proyecto-nuevo)
13. [Aprendizajes — Ventas Personalizadas](#13-aprendizajes--ventas-personalizadas)

---

## 1. Propósito de este documento

Este documento define el **workflow operativo** del proyecto: cómo se trabaja, qué pasos se siguen, qué está congelado, qué debe validarse y cómo se cierran etapas.

**No repite** reglas que ya están en los documentos maestros. Referencia directa a ellos cuando aplica.

---

## 2. Documentos maestros — dónde vive cada regla

| Necesito saber... | Ir a... |
|-------------------|---------|
| Cómo trabaja cada IA (Claude, Codex, ChatGPT) | `../project-standards/ai_rules.md` |
| Qué modelo usar, cuándo pedir confirmación, seguridad | `../project-standards/ai_rules.md` |
| Checklist antes de finalizar una tarea | `../project-standards/ai_rules.md` §15 |
| Handoff entre IAs o sesiones | `../project-standards/ai_rules.md` §14 |
| Colores, tipografía, componentes CSS | `../project-standards/style_guide.md` |
| Convenciones de nombre, estructura de carpetas | `../project-standards/style_guide.md` §14 |
| Git: formato de commits, branches | `../project-standards/style_guide.md` §13 |
| Instrucciones específicas para Claude Code en este proyecto | `CLAUDE.md` |

---

## 3. Tipos de cambios y riesgo

Cuando sea posible, tratar cada tipo por separado — commits distintos, sesiones distintas.

| Tipo | Descripción | Riesgo | Requiere |
|------|-------------|--------|----------|
| **Documentación** | README, guías, changelogs | Bajo | Commit claro |
| **Visual/UI** | CSS, layout, tipografía, colores | Bajo–Medio | Smoke visual |
| **Funcional** | JS, lógica, render dinámico | Medio | Smoke + consola |
| **Estructural** | Reorganización de carpetas/archivos | Alto | Auditoría previa + smoke de rutas |
| **Refactor** | Cambio interno sin impacto visible | Alto | Auditoría + etapas + validación full |
| **Release** | Versión, deploy, changelog | Alto | Checklist completo |
| **Freeze zone** | Ver §7 | Crítico | Ver §7 |

---

## 4. Flujo de trabajo estándar

### 4.1 Secuencia de etapas

```
1. Descubrimiento    → entender problema, usuarios, restricciones
2. Diseño funcional  → qué hace, para quién, con qué alcance (ChatGPT)
3. Diseño técnico    → cómo se construye, qué archivos cambian
4. Implementación    → cambios pequeños, controlados, verificables (Claude Code)
5. Validación        → smoke, QA, consola
6. Documentación     → README, CHANGELOG, decisiones
7. Release           → versión, changelog, deploy
8. Handoff           → resumen para retomar (ver ai_rules.md §14)
9. Mantenimiento     → casos nuevos, mejora continua
```

No todas las tareas recorren todas las etapas. Un fix pequeño puede ir directo de implementación a validación. Un refactor grande necesita cada una.

### 4.2 Regla general de auditoría previa

Cuando el alcance no está completamente claro, siempre:

1. Auditoría sin modificar archivos
2. Identificación de riesgos y dependencias
3. Definición de alcance acotado
4. Implementación
5. Validación

Mezclar auditoría e implementación en el mismo paso genera cambios fuera de alcance y regresiones no anticipadas.

### 4.3 Prompt de auditoría recomendado

```
Auditar [módulo o archivo] sin modificar ningún archivo.
Entregar:
- diagnóstico actual
- riesgos detectados
- dependencias críticas
- quick wins
- cambios recomendados priorizados
- próximo paso sugerido de menor riesgo
```

### 4.4 Prompt de implementación recomendado

```
Implementar [cambio concreto].
Modificar solo: [lista de archivos]
No modificar: [restricciones]
Validar: [criterios esperados]
Devolver: archivos modificados, resumen, validaciones, riesgos.
```

---

## 5. Flujo de release

1. Auditoría final del estado del código
2. Definición del alcance exacto del release
3. Implementación pendiente (si quedó algo)
4. Validaciones: smoke, consola, flujo principal
5. Bump de versión
6. Entrada en `CHANGELOG.md`
7. Commit de release
8. Push a `main`
9. Verificación post-deploy (GitHub Pages, 2–3 min de propagación)
10. Documentación si quedó algo pendiente

**No publicar si:**
- Hay errores críticos sin resolver
- No se validó el flujo principal
- No se sabe exactamente qué cambio se está publicando
- No hay forma de identificar o revertir el cambio

---

## 6. Criterios de cierre y deploy

### Una tarea puede cerrarse cuando:

- El alcance fue cumplido completamente
- Las validaciones definidas pasaron
- La documentación relevante fue actualizada
- No hay errores críticos conocidos
- Los riesgos están documentados
- El resultado está listo para revisión o deploy

### Antes de hacer push a main:

```
[ ] Build / servidor sin errores
[ ] Consola del browser sin errores relacionados con el cambio
[ ] Flujo principal funciona end-to-end
[ ] Versión actualizada (si aplica)
[ ] Entrada en CHANGELOG
[ ] Rollback identificable (commit anterior conocido)
[ ] Riesgos conocidos comunicados
```

---

## 7. Freeze zones del proyecto

Las freeze zones son archivos o módulos que **no deben modificarse** sin auditoría previa y aprobación explícita.

### 7.1 Zonas congeladas

| Zona | Razón |
|------|-------|
| `apps-script/Auth.gs` (cuando se cree) | Maneja tokens y sesiones del backend |
| `apps-script/` en general | Lógica de negocio y/o credenciales |
| Contrato del endpoint de pedidos consumido de `vtex-control-center` | Cambiarlo sin coordinar rompe la integración cross-repo |
| Formulario de aprobación de pago (una vez en producción) | Escribe datos financieros reales; un bug puede desincronizar VTEX vs. Sheet |
| Datos reales del Sheet de producción | Afectan gestiones y ventas en curso |

### 7.2 Protocolo antes de tocar una freeze zone

1. Auditoría del módulo afectado (sin modificar)
2. Identificación de todas las dependencias
3. Definición de alcance acotado con archivos explícitos
4. Implementación en etapas, no de una sola vez
5. Validación estricta antes de commitear
6. Documentar el cambio en `CLAUDE.md` o `docs/decisions/`

**Si la IA propone tocar una freeze zone fuera del alcance declarado: detener y renegociar.**

### 7.3 Cómo declarar freeze zones en un prompt

```
Modificar solo:
- [archivo permitido 1]
- [archivo permitido 2]

No modificar:
- [freeze zone 1]
- [freeze zone 2]
```

---

## 8. Auditoría vs implementación

La separación entre auditoría e implementación es un principio central, no una sugerencia.

### Por qué siempre separar

Mezclarlas genera:
- Cambios fuera de alcance no detectados
- Regresiones no anticipadas
- Mayor consumo de tokens
- Deuda técnica accidental
- Dificultad para revertir

### Cuándo es obligatorio separar

- Refactors de cualquier escala
- Cambios en JS, rutas, formularios o config
- Cambios que afecten más de 2 módulos
- Cualquier cambio donde el alcance no esté completamente claro

### Cuándo puede omitirse la auditoría formal

- Correcciones de texto, labels o copy
- Ajustes visuales menores bien definidos
- Documentación que no toca lógica
- Cambios que el equipo comprende completamente

Incluso en estos casos: smoke test mínimo post-cambio.

---

## 9. Smoke visual y QA

### 9.1 Checklist de smoke visual (post-cambio UI)

```
[ ] Página carga sin error
[ ] Consola sin errores críticos
[ ] Layout sin elementos rotos o superpuestos
[ ] Navegación funciona (sidebar, links, botones de volver)
[ ] Mobile sin overflow ni elementos cortados
[ ] Formularios visibles con label y submit operativo
[ ] Datos cargan correctamente si aplica
[ ] Branding consistente con el resto del proyecto
```

### 9.2 QA para cambios funcionales (JS, API, datos)

```
[ ] Flujo principal funciona de inicio a fin
[ ] Casos de error son visibles y comprensibles
[ ] Datos enviados/recibidos correctamente
[ ] Sin loops, freezes ni comportamientos inesperados
[ ] Validaciones activas y mensajes claros
[ ] Submit o acción principal ejecuta correctamente
[ ] Comportamiento consistente con distintos estados (vacío, cargando, error, éxito)
```

Para el formulario de aprobación de pago, agregar siempre:
```
[ ] La sumatoria de montos por medio de pago coincide con el total del pedido
[ ] Los campos condicionales (Factura A, Payway débito/crédito) se muestran/ocultan correctamente
[ ] El estado del pedido en VTEX queda sincronizado con lo guardado en el Sheet
```

### 9.3 Específico de GitHub Pages

- Verificar rutas relativas vs absolutas post-deploy
- Verificar que assets (CSS, JS) cargan correctamente
- Dar 2–3 minutos de propagación antes de validar
- Revisar caché del browser si los cambios no aparecen

### 9.4 Validación humana vs asistida por IA

| Usar IA cuando... | Usar validación manual cuando... |
|-------------------|----------------------------------|
| Hay validaciones estáticas o de diff | El smoke es principalmente visual |
| Se revisan payloads o contratos | La prueba requiere criterio UX |
| Se puede hacer smoke mockeado | Implica GAS, Sheets o datos reales |
| El usuario no tiene el entorno abierto | El usuario puede validar más rápido en browser |

Si el usuario dice que validará manualmente: la IA no debe insistir con smoke visual ni gastar tokens adicionales.

---

## 10. Manejo de errores y casos nuevos

Cuando aparece un error o caso no previsto:

1. Guardar evidencia (screenshot, mensaje de consola, pasos para reproducir)
2. Clasificar severidad:
   - **Crítico**: bloquea el flujo principal
   - **Alto**: afecta flujo importante, tiene workaround
   - **Medio**: afecta casos secundarios
   - **Bajo**: mejora menor, no bloqueante
3. Identificar impacto (módulos afectados, datos comprometidos)
4. Corregir con alcance controlado (solo el bug, sin "mejoras de paso")
5. Validar que no haya regresiones en el módulo afectado
6. Documentar la corrección en el commit (patch bump si aplica)

---

## 11. Documentación técnica vs operativa

```
Documentación técnica  →  cómo está construido (para devs, arquitectura, APIs)
Documentación operativa → cómo se usa y para qué (para usuarios, agentes, soporte)
```

### Técnica incluye:
- Arquitectura del proyecto
- Estructura de carpetas y archivos
- Decisiones de diseño técnico (`docs/decisions/`)
- Setup del entorno y credenciales
- Versiones y changelog

### Operativa incluye:
- Para qué sirve cada módulo
- Cuándo usarlo
- Cómo usarlo paso a paso
- Qué resultado esperar
- Qué hacer ante errores
- Lenguaje simple, sin tecnicismos

No mezclar ambas en el mismo documento. El README puede tener una sección de cada tipo, pero los docs detallados van separados.

---

## 12. Preparación de un proyecto nuevo

Ver `../project-standards/new_project_guide.md` para el checklist completo. Este proyecto ya pasó por el Paso 1–2 (carpeta, git init, archivos base).

### 12.5 Convenciones específicas del proyecto

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Prefijo localStorage (tema, sidebar, sesión) | `vp_` | `vp_theme`, `vp_session` |
| Sigla de marca (login, sidebar) | `VP` | `.brand-icon` → `VP` |
| Nombre de acción del backend | `camelCase`, verbo + entidad | `listGestiones`, `registrarContacto`, `aprobarPago` |
| Hoja del Sheet | `PascalCase` en singular/plural según contenido | `Gestiones`, `Ventas`, `PagosVenta` |

---

## 13. Aprendizajes — Ventas Personalizadas

### 13.1 Separación de la integración VTEX

Este proyecto no integra VTEX directamente — consume una cache de solo lectura mantenida por `vtex-control-center`. Ver `docs/decisions/001-cache-pedidos-vtex-control-center.md` para el razonamiento completo. Cualquier necesidad nueva de datos de pedido debe evaluarse contra esa cache antes de considerar una integración propia.
