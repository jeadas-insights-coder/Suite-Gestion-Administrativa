/* JeaDas.Insights — puente entre un módulo (iframe del mismo origen) y la Suite (ventana padre).
 *
 * Uso en el index.html de cada módulo:
 *   <script src="../../assets/suite-bridge.js"></script>
 *   <script> JDI.ready.then(() => arrancarModulo()); </script>
 *
 * API:
 *   JDI.modulo            id del módulo ('archivo', ...)
 *   JDI.usuario           { id, usuario, nombre, email, rol }   (rol de la SUITE: usuario | admin_cliente)
 *   JDI.esAdmin           true si es administrador del cliente
 *   JDI.empresa           { nombre, sigla, lema, pie_pagina, color_primario, color_secundario, logo_data, zona_horaria }
 *   JDI.api(body)         Envía `body` (la misma solicitud que enviaba la app original, SIN token) al backend del
 *                         módulo y devuelve su respuesta JSON tal cual. Si la Suite rechaza la llamada (sesión
 *                         vencida, módulo sin acceso...) rechaza la promesa con Error{code}.
 *   JDI.onBrand(fn)       fn(empresa) se llama cuando el administrador cambia la marca.
 *   JDI.catalogo()        Promesa con el catálogo común de la empresa: { unidades, cargos } (solo activos).
 *   JDI.toast(msg, tipo)  notificación de la Suite ('ok' | 'error' | 'info').
 *   JDI.irAInicio()       vuelve al panel principal de la Suite.
 *   JDI.abrirAdministracion(p) abre la administración de la Suite en la pestaña p ('usuarios', 'catalogo'…).
 *   JDI.aplicarMarca()    define las variables CSS --jdi-primary, --jdi-secondary en <html>.
 */
(function () {
  'use strict';
  var P = window.parent;
  if (!P || P === window || !P.__JDI_SHELL) {
    // Abierto fuera de la Suite: volver al inicio de sesión
    try { window.location.replace('../../index.html'); } catch (e) { /* nada */ }
    window.JDI = { ready: new Promise(function () {}) };
    return;
  }
  var S = P.__JDI_SHELL;
  var modulo = (function () { var m = /\/modulos\/([a-z0-9_]+)\//.exec(window.location.pathname); return m ? m[1] : ''; })();
  var brandCbs = [];

  var JDI = window.JDI = {
    modulo: modulo,
    get usuario() { return S.me().usuario; },
    get esAdmin() { return !!S.me().esAdmin; },
    get empresa() { return S.me().empresa || {}; },
    api: function (body) { return S.modCall(modulo, body); },
    /** Llama a OTRO módulo de la empresa (p. ej. Identificadores lee tomos de Archivo). Valen los permisos del usuario en ese módulo. */
    apiModulo: function (otro, body) { return S.modCall(String(otro), body); },
    onBrand: function (fn) { brandCbs.push(fn); },
    /** Promesa con { unidades:[{id,codigo,nombre,dependencia}], cargos:[{id,codigo,nombre}] } (solo activos). Catálogo común de la empresa. */
    catalogo: function (forzar) { return S.catalogo(forzar); },
    toast: function (m, t) { S.toast(m, t); },
    irAInicio: function () { S.irAInicio(); },
    /** Abre la administración de la Suite (pestaña: 'usuarios' = Personal y usuarios, 'catalogo', 'empresa'…). */
    abrirAdministracion: function (pestana) { S.abrirAdministracion(pestana); },
    aplicarMarca: function () {
      var e = JDI.empresa;
      // Tokens derivados (acento, texto automático, hover, enfoque) con el mismo motor que el panel
      (P.JDITheme || window.JDITheme).aplicar(document.documentElement, e.color_primario, e.color_secundario);
    },
    _brandChanged: function () { JDI.aplicarMarca(); brandCbs.forEach(function (f) { try { f(JDI.empresa); } catch (e) { /* nada */ } }); }
  };
  JDI.ready = Promise.resolve(JDI);
  JDI.aplicarMarca();
})();
