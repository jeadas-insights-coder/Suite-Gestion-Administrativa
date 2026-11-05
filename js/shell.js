/* JeaDas.Insights — shell: acceso, panel de módulos, administración del cliente y del SuperAdministrador. */
(function () {
  'use strict';
  var API = (window.JDI_CONFIG && window.JDI_CONFIG.API_URL) || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ST = { token: null, me: null, mod: null, menu: false };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- módulos: presentación ---------- */
  var MOD = {
    identificadores: { n: 'Identificadores', c: '#19B9DF', d: 'Tomos, secciones y rótulos para identificar cada archivo físico.', i: '<path d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M8 9v6M12 9v6M16 9v6"/>' },
    firmas: { n: 'Cites&Firmas', c: '#B87BCE', d: 'Cites automáticos y seguimiento de visto bueno y firma.', i: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4M14 20h6"/>' },
    vacaciones: { n: 'Vacaciones', c: '#3E76E0', d: 'Saldos, solicitudes y calendario de vacaciones del personal.', i: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h8"/>' },
    files: { n: 'Files de personal', c: '#E0A33E', d: 'Legajo digital del personal: documentos, requisitos, vencimientos e historial.', i: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 13h6"/>' },
    archivo: { n: 'Archivo', c: '#8DA2F2', d: 'Correspondencia, archivo físico y digital con trazabilidad.', i: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>' }
  };
  var ORDEN = ['identificadores', 'firmas', 'vacaciones', 'archivo', 'files'];
  var PREMIUM = { vacaciones: 1, archivo: 1, files: 1 };
  var ICO_GEN = '<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM8 9h8M8 13h8M8 17h5"/>';
  /* Datos de presentación de un módulo; si el servidor ofrece uno que esta página no conoce, se muestra igual (con icono genérico). */
  function MI(id) {
    if (MOD[id]) return MOD[id];
    var m = (ST.me && ST.me.modulos || []).filter(function (x) { return x.id === id; })[0] || {};
    return { n: String(m.nombre || id).replace(/^JeaDas\.Insights - /, ''), c: '#7C8CF8', d: m.descripcion || '', i: ICO_GEN };
  }
  function esPremium(m) { return m.paquete ? m.paquete === 'premium' : !!PREMIUM[m.id]; }
  function etqPaquete(m) { return esPremium(m) ? '<span class="pq prem" title="Incluido en el paquete Premium">Premium</span>' : ''; }

  /* ---------- red ---------- */
  var pend = 0;
  function bar(d) { pend += d; var b = $('#bar'); if (b) b.classList.toggle('on', pend > 0); }
  function post(body) {
    if (!/^https?:|^\//.test(API)) return Promise.reject(Object.assign(new Error('La aplicación no está conectada: defina API_URL en config.js con la URL /exec del Web App.'), { code: 'CONFIG' }));
    bar(1);
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { throw Object.assign(new Error('No se pudo contactar al servidor. Revise su conexión.'), { code: 'RED' }); })
      .then(function (j) { bar(-1); return j; }, function (e) { bar(-1); throw e; });
  }
  function suiteErr(j) {
    var e = new Error(j.error || 'Error'); e.code = j.code || 'ERROR';
    if (e.code === 'SESION') { sesionVencida(); }
    else if (e.code === 'CAMBIO_CLAVE' && ST.me) { pantallaClave(true); }
    return e;
  }
  function api(action, data) {
    return post({ action: action, token: ST.token, data: data || {} }).then(function (j) {
      if (j && j.ok) return j.data;
      throw suiteErr(j || {});
    });
  }
  function modCall(modulo, body) {
    return post({ action: 'mod', modulo: modulo, body: body, token: ST.token }).then(function (j) {
      if (j && j.suiteError) throw suiteErr(j);
      return j;
    });
  }

  /* ---------- utilidades de interfaz ---------- */
  function toast(msg, tipo) {
    var t = document.createElement('div'); t.className = 'toast ' + (tipo || ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(function () { t.remove(); }, tipo === 'error' ? 7000 : 3800);
  }
  function dlg(o) {
    return new Promise(function (resolve) {
      var d = document.createElement('dialog'); if (o.wide) d.className = 'wide';
      d.innerHTML = '<div class="dh"><h2>' + esc(o.titulo) + '</h2><button class="btn xs" data-x aria-label="Cerrar">✕</button></div><div class="db">' + (o.html || '') + '</div><div class="df"></div>';
      var pie = $('.df', d), done = false;
      function cerrar(v) { if (done) return; done = true; d.close(); d.remove(); resolve(v); }
      var bs = o.botones || [{ t: 'Cerrar' }];
      bs.forEach(function (b) {
        var el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.t; el.type = 'button';
        el.onclick = function () {
          if (!b.run) return cerrar(b.v);
          el.disabled = true;
          Promise.resolve(b.run(d, cerrar)).then(function (r) { if (r === false) el.disabled = false; }, function (e) { el.disabled = false; errEn(d, e); });
        };
        pie.appendChild(el);
      });
      $('[data-x]', d).onclick = function () { cerrar(undefined); };
      d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(undefined); });
      document.body.appendChild(d); d.showModal();
      if (o.alAbrir) o.alAbrir(d, cerrar);
    });
  }
  function errEn(d, e) {
    var c = $('.err', d); if (!c) { c = document.createElement('div'); c.className = 'err'; c.setAttribute('role', 'alert'); $('.db', d).prepend(c); }
    c.textContent = e.message || String(e); c.scrollIntoView({ block: 'nearest' });
  }
  function valores(r) { var o = {}; r.querySelectorAll('[name]').forEach(function (el) { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; }); return o; }
  function campo(n, l, v, o) {
    o = o || {};
    return '<label class="f"' + (o.full ? ' style="grid-column:1/-1"' : '') + '><span>' + esc(l) + '</span><input type="' + (o.t || 'text') + '" name="' + n + '" value="' + esc(v == null ? '' : v) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.auto ? ' autocomplete="' + o.auto + '"' : '') + (o.req ? ' required' : '') + '>' + (o.hint ? '<small class="hint">' + esc(o.hint) + '</small>' : '') + '</label>';
  }
  function fecha(s) { return s ? String(s).slice(0, 10).split('-').reverse().join('/') : '—'; }
  function secreto(titulo, usuario, clave) {
    return dlg({ titulo: titulo, html: '<p class="mut" style="margin-bottom:14px">Entregue estos datos a la persona. <b>La contraseña se muestra una sola vez</b>; deberá cambiarla en su primer ingreso.</p><p class="sm mut">Usuario</p><div class="secret" style="margin-bottom:12px">' + esc(usuario) + '</div><p class="sm mut">Contraseña temporal</p><div class="secret">' + esc(clave) + '</div>',
      botones: [{ t: 'Copiar datos', run: function () { try { navigator.clipboard.writeText('Usuario: ' + usuario + '\nContraseña temporal: ' + clave); toast('Datos copiados.', 'ok'); } catch (e) { toast('Seleccione y copie manualmente.'); } return false; } }, { t: 'Entendido', cls: 'pri' }] });
  }
  function iniciales(n) { return String(n || '?').split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase(); }
  function logoSrc(e) { return e && /^data:image\/(png|jpeg|webp);base64,/.test(e.logo_data || '') ? e.logo_data : ''; }

/* ---------- identidad institucional JDI ---------- */

function identidadJDI() {

    return '<span class="jdi-brand-mark" aria-hidden="true">' +
           'JDI' +
           '</span>' +

           '<span class="jdi-brand-text">' +
           '<span class="jdi-brand-name">JeaDas<i>.Insights</i></span>' +
           '<small>Suite de Gestión Administrativa</small>' +
           '</span>';

}

  
/* ---------- identidad institucional JeaDas.Insights ---------- */

function identidadJDI() {

    return `
        <div class="jdi-identity">

            <img
                src="./favicon.svg?v=2.0.2"
                class="jdi-identity-icon"
                alt="JDI"
                width="36"
                height="36"
            >

            <div class="jdi-identity-text">

                <strong>
                    JeaDas<span>.Insights</span>
                </strong>

                <small>
                    Suite de Gestión Administrativa
                </small>

            </div>

        </div>
    `;

}

  /* ---------- marca de la empresa ---------- */
  function aplicarMarca() {
    var e = ST.me && ST.me.empresa;
    // Un solo punto de entrada: el color elegido se convierte en tokens (acento, texto automático, hover, enfoque)
    window.JDITheme.aplicar(document.documentElement, e && e.color_primario, e && e.color_secundario);
  }
  function refrescarMarca() {
    return api('me').then(function (me) {
      ST.me = me; aplicarMarca();
      try { var f = $('#modview iframe'); if (f && f.contentWindow && f.contentWindow.JDI) f.contentWindow.JDI._brandChanged(); } catch (e) { /* iframe cerrado */ }
      if (!ST.mod) render();
    });
  }

  /* ---------- puente para los módulos ---------- */
  window.__JDI_SHELL = {
    me: function () { return ST.me; },
    modCall: modCall,
    toast: toast,
    irAInicio: function () { abrirInicio(); },
    abrirAdministracion: function (pestana) { abrirAdmin(pestana || 'usuarios'); },
    /** Catálogo común de la empresa (unidades y cargos activos). Se guarda 60 s para no repetir llamadas. */
    catalogo: function (forzar) {
      if (!forzar && ST.cat && Date.now() - ST.cat.t < 60000) return Promise.resolve(ST.cat.d);
      return api('catalogo.listar').then(function (d) { ST.cat = { t: Date.now(), d: d }; return d; });
    }
  };

  /* ---------- sesión ---------- */
  function sesionVencida() {
    store.set('jdi.token', null); ST.token = null; ST.me = null; ST.mod = null;
    pantallaLogin('Su sesión venció. Ingrese nuevamente.');
  }

  function salir() {
    var t = ST.token;
    if (t) post({ action: 'logout', token: t }).catch(function () { /* ya vencida */ });
    store.set('jdi.token', null); ST.token = null; ST.me = null; ST.mod = null; ST.menu = false;
    
    window.JDITheme.aplicar(document.documentElement);
    document.title = 'JeaDas.Insights'; 
    
    // MODIFICACIÓN: Llamamos a la animación de despedida antes de pasar al login
    if (typeof mostrarDespedida === 'function') {
        // Ejecuta la animación de salida hacia index.html
        mostrarDespedida('index.html'); 
    } else {
        // Respaldo por si el script externo de GitHub no carga
        pantallaLogin(''); 
    }
  }

  /* Botón «ojo»: muestra la contraseña unos segundos y la vuelve a ocultar sola. */
  var OJO = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function verClaves(raiz) {
    raiz.querySelectorAll('input[type=password]').forEach(function (inp) {
      var w = document.createElement('span'); w.className = 'pw'; inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'eye'; b.innerHTML = OJO;
      b.setAttribute('aria-label', 'Mostrar la contraseña unos segundos'); b.title = 'Mostrar unos segundos'; w.appendChild(b);
      var t = null;
      function ocultar() { clearTimeout(t); inp.type = 'password'; b.setAttribute('aria-pressed', 'false'); b.classList.remove('on'); }
      b.onclick = function () { if (inp.type === 'text') return ocultar(); inp.type = 'text'; b.setAttribute('aria-pressed', 'true'); b.classList.add('on'); t = setTimeout(ocultar, 4000); };
      inp.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== b) ocultar(); }, 150); });
    });
  }

  function pantallaLogin(aviso) {
    $('#root').innerHTML = '<section id="login"><form class="logincard" id="flog" autocomplete="on"><h1 class="brand">JeaDas<i>.Insights</i></h1><p class="sub">Ingrese para acceder a sus módulos.</p>' +
      (aviso ? '<div class="err" role="alert">' + esc(aviso) + '</div>' : '') +
      '<label class="f"><span>Usuario</span><input type="text" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
      '<label class="f"><span>Contraseña</span><input type="password" name="clave" autocomplete="current-password" required></label>' +
      '<div id="lerr"></div><button class="btn pri" style="width:100%;margin-top:6px" type="submit">Ingresar</button></form></section>';
    verClaves($('#flog'));
    $('[name=usuario]').focus();
    $('#flog').onsubmit = function (ev) {
      ev.preventDefault();
      var v = valores(ev.target), b = $('button', ev.target); b.disabled = true; $('#lerr').innerHTML = '';
      post({ action: 'login', data: { usuario: v.usuario.trim(), clave: v.clave } }).then(function (j) {
        if (!j || !j.ok) throw Object.assign(new Error((j && j.error) || 'No se pudo ingresar.'), { code: j && j.code });
        ST.token = j.data.token; store.set('jdi.token', ST.token); ST.me = j.data.me; aplicarMarca();
        entrar();
      }).catch(function (e) { b.disabled = false; $('#lerr').innerHTML = '<div class="err" role="alert">' + esc(e.message) + '</div>'; });
    };
  }

  function pantallaClave(forzada) {
    $('#root').innerHTML = '<section id="login"><form class="logincard" id="fclave" autocomplete="off"><h1 class="brand">Nueva contraseña</h1><p class="sub">' + (forzada ? 'Su contraseña es temporal. Elija una propia para continuar.' : 'Elija una contraseña nueva.') + '</p>' +
      '<label class="f"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" required></label>' +
      '<label class="f"><span>Contraseña nueva</span><input type="password" name="nueva" autocomplete="new-password" required><small class="hint">Mínimo 10 caracteres, con letras y números.</small></label>' +
      '<label class="f"><span>Repita la contraseña nueva</span><input type="password" name="rep" autocomplete="new-password" required></label>' +
      '<div id="cerr"></div><div class="row"><button class="btn pri" type="submit">Guardar y continuar</button><button class="btn" type="button" id="csal">' + (forzada ? 'Salir' : 'Cancelar') + '</button></div></form></section>';
    verClaves($('#fclave'));
    $('[name=actual]').focus();
    $('#csal').onclick = function () { forzada ? salir() : render(); };
    $('#fclave').onsubmit = function (ev) {
      ev.preventDefault(); var v = valores(ev.target), er = $('#cerr'); er.innerHTML = '';
      if (v.nueva !== v.rep) { er.innerHTML = '<div class="err" role="alert">Las contraseñas nuevas no coinciden.</div>'; return; }
      api('cambiarClave', { actual: v.actual, nueva: v.nueva }).then(function () { return api('me'); }).then(function (me) { ST.me = me; aplicarMarca(); toast('Contraseña actualizada.', 'ok'); entrar(); })
        .catch(function (e) { er.innerHTML = '<div class="err" role="alert">' + esc(e.message) + '</div>'; });
    };
  }

  function entrar() {
    if (ST.me.usuario.debe_cambiar) return pantallaClave(true);
    var q = new URLSearchParams(location.search), m = q.get('m');
    if (m && ST.me.modulos.some(function (x) { return x.id === m && x.disponible; })) return abrirModulo(m);
    abrirInicio();
  }

  /* ---------- navegación ---------- */
  function abrirInicio() { ST.mod = null; ST.menu = false; ST.vista = 'inicio'; document.title = 'JeaDas.Insights'; render(); }
  function abrirAdmin(v) { ST.mod = null; ST.menu = false; ST.vista = v; render(); }
  function abrirModulo(id) {
    ST.mod = id; ST.menu = false; document.title = 'JeaDas.Insights - ' + MI(id).n; render();
  }
  function armarMarco() {
    var cont = $('#modview'); if (!cont) return;
    cont.innerHTML = '<div class="loading">Cargando ' + esc(MI(ST.mod).n) + '…</div>';
    var f = document.createElement('iframe'); f.title = 'JeaDas.Insights - ' + MI(ST.mod).n; f.src = 'modulos/' + ST.mod + '/index.html?v=' + encodeURIComponent(window.JDI_V || '');
    f.setAttribute('allow', 'clipboard-write'); f.onload = function () { var l = $('.loading', cont); if (l) l.remove(); };
    cont.appendChild(f);
  }

  /* ---------- cabecera ---------- */

/* ---------- cabecera institucional ---------- */

function cabecera() {

    var me = ST.me,
        e = me.empresa,
        u = me.usuario,
        enMod = !!ST.mod;

    var logo = logoSrc(e);

    return '<header class="top">' +

      '<button class="brand jdi-header-brand" id="hbrand" ' +
      'aria-label="Ir al inicio">' +

          identidadJDI() +

      '</button>' +

      (e ? '<div class="co">' +
          (logo ? '<img src="' + esc(logo) + '" alt="">' : '') +
          '<b>' + esc(e.nombre) + '</b>' +
      '</div>' : '') +

      (enMod ?
          '<span class="pill modpill">' +
          esc(MI(ST.mod).n) +
          '</span>' : '') +

      '<span class="sp"></span>' +

      (enMod ?
          '<button class="btn back" id="hback" ' +
          'aria-label="Volver a módulos">' +
          '←<span class="bt"> Módulos</span>' +
          '</button>' : '') +

      '<button class="userbtn" id="hu" ' +
      'aria-haspopup="true" aria-expanded="' + ST.menu + '">' +

          '<span class="avatar">' +
          esc(iniciales(u.nombre)) +
          '</span>' +

          '<span class="nm">' +
          esc(u.nombre) +
          '</span>' +

      '</button>' +

      '</header>' +

      (ST.menu ?

        '<div class="menu" role="menu">' +

          '<div class="who">' +
            '<b>' + esc(u.nombre) + '</b>' +
            '<div class="mut sm">' +
              esc(u.usuario) + ' · ' +
              (me.esSuper ? 'SuperAdministrador' :
               me.esAdmin ? 'Administrador del cliente' :
               'Usuario') +
            '</div>' +
          '</div>' +

          '<button data-m="inicio">' +
            (me.esSuper ? 'Empresas' : 'Mis módulos') +
          '</button>' +

          (me.esAdmin ?
            '<button data-m="admin">Administración de la empresa</button>' : '') +

          '<button data-m="perfil">Mi cuenta</button>' +
          '<button data-m="clave">Cambiar contraseña</button>' +
          '<button data-m="salir">Salir</button>' +

          '<div class="ver mut sm">' +
            'Versión ' + esc(window.JDI_V || '?') +
            (me.version && me.version !== window.JDI_V ?
              ' · servidor ' + esc(me.version) : '') +
          '</div>' +

        '</div>' : '');

}
  function enlazarCabecera() {
    $('#hbrand').onclick = abrirInicio;
    var b = $('#hback'); if (b) b.onclick = abrirInicio;
    $('#hu').onclick = function (ev) { ev.stopPropagation(); ST.menu = !ST.menu; var m = $('.menu'); if (m) { m.remove(); $('#hu').setAttribute('aria-expanded', 'false'); } else { rerenderMenu(); } };
    var mn = $('.menu'); if (mn) mn.onclick = function (ev) { var x = ev.target.closest('[data-m]'); if (!x) return; ST.menu = false; var a = x.dataset.m;
      if (a === 'inicio') abrirInicio(); else if (a === 'admin') abrirAdmin('suscripcion'); else if (a === 'salir') salir(); else if (a === 'clave') pantallaClave(false); else if (a === 'perfil') dlgPerfil(); };
  }
  function rerenderMenu() { var cur = $('header.top'); if (!cur) return; var tmp = document.createElement('div'); tmp.innerHTML = cabecera(); var m = $('.menu', tmp); if (m) { document.body.appendChild(m); m.onclick = function (ev) { var x = ev.target.closest('[data-m]'); if (!x) return; ST.menu = false; m.remove(); var a = x.dataset.m; if (a === 'inicio') abrirInicio(); else if (a === 'admin') abrirAdmin('suscripcion'); else if (a === 'salir') salir(); else if (a === 'clave') pantallaClave(false); else if (a === 'perfil') dlgPerfil(); }; $('#hu').setAttribute('aria-expanded', 'true'); } }
  document.addEventListener('click', function (ev) { var m = $('.menu'); if (m && !ev.target.closest('.menu') && !ev.target.closest('#hu')) { m.remove(); ST.menu = false; var h = $('#hu'); if (h) h.setAttribute('aria-expanded', 'false'); } });

  function dlgPerfil() {
    var u = ST.me.usuario;
    dlg({ titulo: 'Mi cuenta', html: campo('nombre_completo', 'Nombre completo', u.nombre, { req: true, max: 120 }) + campo('email', 'Correo electrónico', u.email || '', { t: 'email', max: 160 }) + '<p class="mut sm">Usuario: <b>' + esc(u.usuario) + '</b> (no se puede cambiar)</p>',
      botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (d, c) { var v = valores(d); return api('perfil.guardar', v).then(function () { return refrescarMarca(); }).then(function () { toast('Datos actualizados.', 'ok'); c(true); }); } }] });
  }

  /* ---------- render principal ---------- */
  /* Aviso al administrador cuando la página y el servidor no son de la misma entrega (archivos viejos subidos o en caché). */
  function avisoVersion() {
    var me = ST.me; if (!me || !(me.esAdmin || me.esSuper)) return '';
    if (me.version && window.JDI_V && me.version !== window.JDI_V)
      return '<div class="alertbar bad"><b>Versiones distintas:</b> la página es la ' + esc(window.JDI_V) + ' y el servidor (Apps Script) la ' + esc(me.version) + '. Suba todos los archivos de la misma entrega, publique una <i>nueva versión</i> del despliegue y recargue con Ctrl+F5.</div>';
    if (!me.version) return '<div class="alertbar bad"><b>Servidor desactualizado:</b> el Apps Script no informa su versión. Suba los archivos .gs de la entrega ' + esc(window.JDI_V || '') + ' y publique una nueva versión del despliegue.</div>';
    return '';
  }
  function render() {
    if (!ST.me) return;
    var root = $('#root');
    if (ST.mod) {
      root.innerHTML = '<div id="app">' + cabecera() + '<div id="modview"></div></div>';
      enlazarCabecera(); armarMarco(); return;
    }
    var cuerpo = ST.me.esSuper ? vistaSuper() : ADMT.some(function (x) { return x[0] === ST.vista; }) && ST.me.esAdmin ? '<div id="admbox"></div>' : vistaInicio();
    root.innerHTML = '<div id="app">' + cabecera() + '<main id="main">' + cuerpo + '</main><footer class="foot">' + esc((ST.me.empresa && ST.me.empresa.pie_pagina) || 'JeaDas.Insights') + '</footer></div>';
    enlazarCabecera();
    if (ST.me.esSuper) enlazarSuper();
    else if ($('#admbox')) montarAdmin(); else enlazarInicio();
  }

  /* ---------- inicio del usuario ---------- */
  function vistaInicio() {
    var me = ST.me, nombre = (me.usuario.nombre || '').split(/\s+/)[0];
    var mods = me.modulos.slice().sort(function (a, b) { return (a.orden || 99) - (b.orden || 99); }).filter(function (m) { return m && m.contratado && m.habilitado; });
    var s = me.suscripcion, av = avisoVersion();
    if (s && s.estado !== 'activa') av += '<div class="alertbar bad">La suscripción de la empresa está ' + esc(s.estado) + '. ' + (me.esAdmin ? 'Contacte al proveedor para reactivarla.' : 'Contacte a su administrador.') + '</div>';
    else if (s && s.dias_restantes != null && s.dias_restantes <= 15) av += '<div class="alertbar">La suscripción vence ' + (s.dias_restantes <= 0 ? 'hoy' : 'en ' + s.dias_restantes + ' día' + (s.dias_restantes === 1 ? '' : 's')) + ' (' + fecha(s.fin) + ').</div>';
    var cards = mods.map(function (m) {
      var p = MI(m.id), lock = !m.disponible;
      return '<button class="mcard' + (lock ? ' lock' : '') + '" style="--c:' + p.c + '" data-mod="' + m.id + '"' + (lock ? ' aria-disabled="true"' : '') + '><span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p.i + '</svg></span>' +
        '<h2><small>JeaDas.Insights' + etqPaquete(m) + '</small>' + esc(p.n) + '</h2><p>' + esc(lock ? (m.motivo || 'No disponible') : p.d) + '</p></button>';
    }).join('');
    return '<section class="hello"><h1>Bienvenido de nuevo, ' + esc(nombre) + '</h1><p>' + (mods.length ? 'Elija un módulo para continuar.' : '') + '</p></section>' + av +
      (cards ? '<div class="cards">' + cards + '</div>' : '<div class="empty"><b>Todavía no tiene módulos habilitados.</b><p style="margin-top:6px">' + (me.esAdmin ? 'Habilítelos en Administración de la empresa → Usuarios.' : 'Pida a su administrador que le habilite el acceso.') + '</p></div>');
  }
  function enlazarInicio() {
    var c = $('.cards'); if (c) c.onclick = function (ev) { var b = ev.target.closest('[data-mod]'); if (!b || b.classList.contains('lock')) return; abrirModulo(b.dataset.mod); };
  }

  /* ---------- administración del cliente ---------- */
  var ADMT = [['suscripcion', 'Suscripción'], ['empresa', 'Empresa'], ['catalogo', 'Unidades y cargos'], ['cites', 'Cites'], ['usuarios', 'Usuarios'], ['auditoria', 'Auditoría']];
  function montarAdmin() {
    var t = ADMT.some(function (x) { return x[0] === ST.vista; }) ? ST.vista : 'suscripcion';
    $('#admbox').innerHTML = '<section class="hello"><h1>Administración de ' + esc(ST.me.empresa.nombre) + '</h1></section><div class="tabs" role="tablist">' +
      ADMT.map(function (x) { return '<button role="tab" data-t="' + x[0] + '" aria-selected="' + (x[0] === t) + '">' + x[1] + '</button>'; }).join('') + '</div><div id="adm"><p class="mut">Cargando…</p></div>';
    $('.tabs').onclick = function (ev) { var b = ev.target.closest('[data-t]'); if (b) { ST.vista = b.dataset.t; render(); } };
    var f = { suscripcion: admSuscripcion, empresa: admEmpresa, catalogo: admCatalogo, cites: admCites, usuarios: admUsuarios, auditoria: admAuditoria }[t];
    f($('#adm')).catch(function (e) { $('#adm').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function pillEstado(e) { return '<span class="pill ' + (e === 'activa' || e === 'activo' ? 'ok' : e === 'vencida' ? 'warn' : 'bad') + '">' + esc(e) + '</span>'; }

  /* ---------- catálogo común: unidades y cargos ---------- */
  function resumenSync(r) {
    var ms = (r && r.modulos) || [], ok = ms.filter(function (m) { return !m.error; }), malos = ms.filter(function (m) { return m.error; });
    var notas = [].concat.apply([], ms.map(function (m) { return m.notas || []; }));
    var t = ms.length ? 'Enviado a ' + ok.length + ' módulo' + (ok.length === 1 ? '' : 's') + '.' : 'Guardado (aún no hay módulos instalados).';
    if (malos.length) t += ' Con error: ' + malos.map(function (m) { return MI(m.id).n + ' (' + m.error + ')'; }).join('; ') + '.';
    if (notas.length) t += ' ' + notas.join(' ');
    return { texto: t, tipo: malos.length || notas.length ? 'error' : 'ok' };
  }
  function admCatalogo(el) {
    return api('catalogo.listar').then(function (d) {
      ST.cat = { t: Date.now(), d: { unidades: d.unidades.filter(function (x) { return x.activo; }), cargos: d.cargos.filter(function (x) { return x.activo; }) } };
      function est(a) { return '<span class="pill ' + (a ? 'ok' : 'bad') + '">' + (a ? 'Activo' : 'Inactivo') + '</span>'; }
      function fila(x, u) {
        return '<tr><td class="mono">' + esc(x.codigo) + '</td><td><b>' + esc(x.nombre) + '</b></td>' + (u ? '<td>' + esc(x.dependencia || '—') + '</td>' : '') + '<td>' + est(x.activo) + '</td>' +
          '<td style="white-space:nowrap"><button class="btn xs" data-ed="' + x.id + '">Editar</button> <button class="btn xs" data-on="' + x.id + '" data-v="' + (x.activo ? 0 : 1) + '">' + (x.activo ? 'Desactivar' : 'Activar') + '</button></td></tr>';
      }
      el.innerHTML = '<div class="panel"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">Unidades y cargos (compartidos por todos los módulos)</h3>' +
        '<div class="row"><button class="btn" id="cimp">Importar de los módulos</button><button class="btn" id="csyn">Sincronizar ahora</button></div></div>' +
        '<p class="mut sm" style="margin-bottom:0">Cárguelos aquí una sola vez. Cada módulo recibe las unidades (y los módulos que se habiliten después también). Los cargos se ofrecen al registrar al personal. Desactivar no borra datos de los módulos.</p></div>' +
        '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Unidades <span class="mut sm">(' + d.unidades.length + ')</span></h3><button class="btn pri" id="cuni">Nueva unidad</button></div>' +
        (d.unidades.length ? '<div class="tw"><table><thead><tr><th>Código</th><th>Nombre</th><th>Depende de</th><th>Estado</th><th></th></tr></thead><tbody>' + d.unidades.map(function (x) { return fila(x, true); }).join('') + '</tbody></table></div>' : '<p class="mut">Aún no hay unidades. Cree la primera o use «Importar de los módulos».</p>') + '</div>' +
        '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Cargos <span class="mut sm">(' + d.cargos.length + ')</span></h3><button class="btn pri" id="ccar">Nuevo cargo</button></div>' +
        (d.cargos.length ? '<div class="tw"><table><thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th></th></tr></thead><tbody>' + d.cargos.map(function (x) { return fila(x, false); }).join('') + '</tbody></table></div>' : '<p class="mut">Aún no hay cargos.</p>') + '</div>';
      var todas = d.unidades;
      $('#cuni').onclick = function () { dlgCatalogo('unidad', null, todas); };
      $('#ccar').onclick = function () { dlgCatalogo('cargo', null, todas); };
      $('#csyn').onclick = function (ev) { ev.target.disabled = true; api('catalogo.sincronizar').then(function (r) { var q = resumenSync(r); toast(q.texto, q.tipo); }).catch(function (e) { toast(e.message, 'error'); }).then(function () { ev.target.disabled = false; }); };
      $('#cimp').onclick = function (ev) { ev.target.disabled = true; api('catalogo.importar').then(function (r) { var q = resumenSync(r.sincronizacion); toast('Importadas ' + r.unidades + ' unidades y ' + r.cargos + ' cargos. ' + q.texto, q.tipo); render(); }).catch(function (e) { toast(e.message, 'error'); ev.target.disabled = false; }); };
      el.onclick = function (ev) {
        var b = ev.target.closest('[data-ed],[data-on]'); if (!b) return;
        var id = b.dataset.ed || b.dataset.on, x = d.unidades.concat(d.cargos).filter(function (y) { return y.id === id; })[0]; if (!x) return;
        if (b.dataset.ed) return dlgCatalogo(x.tipo, x, todas);
        b.disabled = true;
        api('catalogo.estado', { id: id, activo: b.dataset.v === '1' }).then(function (r) { var q = resumenSync(r.sincronizacion); toast(q.texto, q.tipo); render(); }).catch(function (e) { b.disabled = false; toast(e.message, 'error'); });
      };
      var nv = document.createElement('div'), tv = document.createElement('div'); el.appendChild(nv); el.appendChild(tv);
      return admNiveles(nv).then(function () { return admTipos(tv); });
    });
  }
  function dlgCatalogo(tipo, x, unidades) {
    var u = tipo === 'unidad';
    var opciones = '<option value="">— Ninguna —</option>' + unidades.filter(function (y) { return !x || y.id !== x.id; }).map(function (y) { return '<option value="' + esc(y.codigo) + '"' + (x && x.dependencia === y.codigo ? ' selected' : '') + '>' + esc(y.codigo + ' · ' + y.nombre) + '</option>'; }).join('');
    dlg({ titulo: (x ? 'Editar ' : 'Nueva ') + (u ? 'unidad' : 'cargo'),
      html: '<div class="grid2">' + (u ? campo('codigo', 'Código', x ? x.codigo : '', { req: true, max: 12, hint: '1 a 12 letras o números, sin espacios. Ejemplo: CONT.' }) : '') +
        campo('nombre', 'Nombre', x ? x.nombre : '', { req: true, max: 160, full: !u }) + '</div>' +
        (u ? '<label class="f"><span>Unidad superior (opcional)</span><select name="dependencia">' + opciones + '</select><small class="hint">En Cites&Firmas se usa como dependencia.</small></label>' : ''),
      botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (d, c) {
        var v = valores(d), data = { tipo: tipo, nombre: v.nombre.trim() };
        if (x) data.id = x.id; if (u) { data.codigo = v.codigo.trim(); data.dependencia = v.dependencia; }
        return api('catalogo.guardar', data).then(function (r) { c(true); var q = resumenSync(r.sincronizacion); toast(q.texto, q.tipo); render(); }); } }] });
  }

  function admSuscripcion(el) {
    return api('empresa.obtener').then(function (d) {
      var s = d.suscripcion;
      el.innerHTML = '<div class="kpis"><div class="kpi"><span>Estado</span><b>' + pillEstado(s.estado) + '</b></div><div class="kpi"><span>Plan</span><b>' + esc(s.plan || '—') + '</b></div>' +
        '<div class="kpi"><span>Vence</span><b>' + fecha(s.fin) + '</b><span>' + (s.dias_restantes == null ? 'Sin vencimiento' : s.dias_restantes + ' días restantes') + '</span></div>' +
        '<div class="kpi"><span>Usuarios activos</span><b>' + d.usuarios_activos + ' / ' + s.max_usuarios + '</b></div></div>' +
        '<div class="panel"><h3>Módulos contratados</h3><div class="tw"><table><thead><tr><th>Módulo</th><th>Estado</th><th>Vence</th></tr></thead><tbody>' +
        d.modulos.map(function (m) { return '<tr><td><b>' + esc(m.nombre) + '</b><div class="mut sm">' + esc(m.descripcion || '') + '</div></td><td>' + (m.contratado ? pillEstado(m.estado || 'activo') : '<span class="pill">No contratado</span>') + '</td><td>' + (m.vence_en ? fecha(m.vence_en) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mut sm" style="margin-top:12px">Para contratar otro módulo, comuníquese con el proveedor. El módulo nuevo tomará la configuración y los usuarios que ya tiene su empresa.</p></div>';
    });
  }

  function admEmpresa(el) {
    return api('empresa.obtener').then(function (d) {
      var e = d.empresa, logo = logoSrc(e);
      el.innerHTML = '<form class="panel" id="femp" autocomplete="off"><h3>Datos de la empresa (compartidos por todos los módulos)</h3>' +
        '<div class="logoedit"><div class="logoprev">' + (logo ? '<img src="' + esc(logo) + '" alt="Logo">' : '<span class="mut sm">Sin logo</span>') + '</div><div><input type="file" id="lgf" accept="image/png,image/jpeg,image/webp" hidden><div class="row"><button class="btn" type="button" id="lgu">Cargar logo</button>' + (logo ? '<button class="btn bad" type="button" id="lgq">Quitar logo</button>' : '') + '</div><small class="hint">PNG, JPG o WebP. Se reduce automáticamente.</small></div></div>' +
        '<div class="grid2">' + campo('nombre', 'Nombre de la empresa', e.nombre, { req: true, max: 160 }) + campo('sigla', 'Sigla', e.sigla, { max: 30, hint: 'Se usa en cites y códigos.' }) +
        campo('lema', 'Lema', e.lema, { max: 160 }) + campo('pie_pagina', 'Pie de página', e.pie_pagina, { max: 200 }) +
        '<label class="f"><span>Color principal</span><input type="color" name="color_primario" value="' + esc(e.color_primario || '#214EC2') + '"></label><label class="f"><span>Color secundario</span><input type="color" name="color_secundario" value="' + esc(e.color_secundario || '#8A3DA6') + '"></label>' +
        '<div class="full themebox"><div class="sw" id="sw">' + Object.keys(window.JDITheme.PALETA).map(function (k) { return '<button type="button" class="swb" data-c="' + window.JDITheme.PALETA[k] + '" title="' + k + ' ' + window.JDITheme.PALETA[k] + '" style="background:' + window.JDITheme.PALETA[k] + '"></button>'; }).join('') + '</div>' +
        '<div class="prev" id="prev"><button type="button" class="btn pri" tabindex="-1">Botón de ejemplo</button><span class="mut sm" id="prevt"></span></div></div>' +
        campo('direccion', 'Dirección', e.direccion, { max: 200 }) + campo('telefono', 'Teléfono', e.telefono, { max: 40 }) + campo('email', 'Correo de contacto', e.email, { t: 'email', max: 160 }) + campo('sitio_web', 'Sitio web', e.sitio_web, { max: 200 }) + selCampo('organizacion', 'Organización de la empresa', '<option value="estructurada"' + (e.organizacion !== 'simple' ? ' selected' : '') + '>Con estructura (áreas, cargos y niveles)</option><option value="simple"' + (e.organizacion === 'simple' ? ' selected' : '') + '>Simple (unipersonal o sin estructura)</option>', 'Con estructura, cada persona debe tener cargo, área, nivel y jefe. En modo simple basta con su condición y documento; el administrador autoriza.') +
        campo('drive_carpeta_id', 'Carpeta de Google Drive para archivos', e.drive_carpeta_id, { full: true, hint: 'Pegue el enlace o el ID de la carpeta. Compártala con ' + (d.cuentaPropietaria || 'la cuenta propietaria de la suite') + ' como Editor.' }) + '</div>' +
        '<div class="row"><button class="btn pri" type="submit">Guardar cambios</button></div></form>';
      (function () {
        var f = $('#femp'), P = f.elements.color_primario, S2 = f.elements.color_secundario, T = window.JDITheme;
        function vista() {
          var t = T.derivar(P.value, S2.value), pv = $('#prev .btn');
          pv.style.setProperty('--color-primary-accent', t['--color-primary-accent']); pv.style.setProperty('--color-on-accent', t['--color-on-accent']);
          pv.style.setProperty('--color-primary-hover', t['--color-primary-hover']); pv.style.setProperty('--color-primary-focus', t['--color-primary-focus']);
          $('#prevt').textContent = 'Texto del botón: ' + (t['--color-on-accent'] === T.TEXTO_OSCURO ? 'negro (#111215), porque el color es claro' : 'blanco, porque el color es oscuro') + ' · hover ' + t['--color-primary-hover'];
        }
        P.addEventListener('input', vista); S2.addEventListener('input', vista);
        $('#sw').onclick = function (ev) { var b = ev.target.closest('[data-c]'); if (!b) return; P.value = b.dataset.c.toLowerCase(); vista(); };
        vista();
      })();
      $('#femp').onsubmit = function (ev) { ev.preventDefault(); var b = $('button[type=submit]', ev.target); b.disabled = true;
        api('empresa.guardar', valores(ev.target)).then(refrescarMarca).then(function () { toast('Empresa actualizada. Los módulos ya usan estos datos.', 'ok'); render(); }).catch(function (er) { b.disabled = false; toast(er.message, 'error'); }); };
      $('#lgu').onclick = function () { $('#lgf').click(); };
      $('#lgf').onchange = function (ev) { var f = ev.target.files[0]; if (!f) return; reducirLogo(f).then(function (uri) { return api('empresa.logo', { data_url: uri }); }).then(refrescarMarca).then(function () { toast('Logo actualizado.', 'ok'); render(); }).catch(function (er) { toast(er.message, 'error'); }); };
      var q = $('#lgq'); if (q) q.onclick = function () { api('empresa.logo', { quitar: true }).then(refrescarMarca).then(function () { toast('Logo eliminado.', 'ok'); render(); }).catch(function (er) { toast(er.message, 'error'); }); };
    });
  }
  function reducirLogo(file) {
    return new Promise(function (res, rej) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return rej(new Error('Elija una imagen PNG, JPG o WebP.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen.')); };
      img.onload = function () {
        URL.revokeObjectURL(url); var max = 360;
        for (var i = 0; i < 8; i++) {
          var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var uri = file.type === 'image/png' && i < 4 ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', Math.max(.5, .9 - i * .07));
          if (uri.length <= 190000) return res(uri); max = Math.round(max * .75);
        }
        rej(new Error('No fue posible reducir el logo lo suficiente. Use una imagen más simple.'));
      };
      img.src = url;
    });
  }

  /* ---------- personas (persona = usuario) ---------- */
  function optsSel(lista, sel, vacio, etiqueta) {
    return '<option value="">' + esc(vacio) + '</option>' + lista.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + esc(etiqueta(x)) + '</option>'; }).join('');
  }
  function optsCond(u) {
    var act = u ? (u.es_socio ? 'socio' : u.es_pasante ? 'pasante' : u.es_externo ? 'externo' : u.es_empleado ? 'empleado' : '') : '';
    return '<option value="">— Elija —</option>' + [['empleado', 'Empleado'], ['pasante', 'Pasante'], ['socio', 'Socio'], ['externo', 'Externo (consultor o contratado)']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === act ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  function selCampo(n, l, html, hint) { return '<label class="f"><span>' + esc(l) + '</span><select name="' + n + '">' + html + '</select>' + (hint ? '<small class="hint">' + esc(hint) + '</small>' : '') + '</label>'; }
  function nom(lista, id, campo) { var x = lista.filter(function (y) { return y.id === id; })[0]; return x ? x[campo || 'nombre'] : ''; }
  function pillLaboral(u) {
    var e = u.estado_laboral || (u.activo ? 'activo' : 'suspendido');
    return '<span class="pill ' + (e === 'activo' ? 'ok' : 'bad') + '">' + (e === 'baja' ? 'De baja' : e === 'suspendido' ? 'Suspendido' : 'Activo') + '</span>';
  }

  function admUsuarios(el) {
    return api('usuarios.listar').then(function (d) {
      var mods = d.modulos.filter(function (m) { return m.estado === 'activo'; });
      var SIMPLE = d.estructura.simple, yo = ST.me.usuario.id, cat = d.catalogo, niv = d.niveles, us = d.usuarios;
      function pendiente(u) { return !SIMPLE && u.rol_id !== 'super' && (!u.cargo_id || !u.unidad_id || !u.nivel_id || (!u.autorizador_id && u.rol_id !== 'admin_cliente')); }
      el.innerHTML = '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Personal y usuarios <span class="mut sm">(' + us.filter(function (u) { return u.activo; }).length + ' activos de ' + d.max_usuarios + ')</span></h3><button class="btn pri" id="unew">Nueva persona</button></div>' +
        (d.estructura.ok || SIMPLE ? '' : '<div class="aviso" role="note" style="margin-bottom:12px"><b>Antes de registrar personas, defina la estructura de la empresa.</b> En <a href="#" id="irEstr">Administración → Unidades y cargos</a> cree: <b>' + (d.estructura.niveles ? '✔' : '✘') + ' niveles de dependencia</b> (' + d.estructura.niveles + '), <b>' + (d.estructura.unidades ? '✔' : '✘') + ' unidades</b> — direcciones, jefaturas o áreas (' + d.estructura.unidades + ') y <b>' + (d.estructura.cargos ? '✔' : '✘') + ' cargos</b> (' + d.estructura.cargos + '). Después, cada persona nueva exigirá condición, puesto, área, nivel y autorizador directo; solo entonces se le podrá habilitar un módulo.</div>') +
        '<p class="mut sm" style="margin-bottom:14px">Una persona y un usuario son lo mismo. Marque los módulos que cada persona puede usar; los cambios se aplican al instante. Dar de baja no borra nada de lo que la persona hizo.</p><div class="tw"><table><thead><tr><th>Persona</th><th>Puesto · Área</th><th>Autorizador</th><th>Rol</th>' + mods.map(function (m) { return '<th>' + esc((MOD[m.id] || {}).n || m.nombre) + '</th>'; }).join('') + '<th>Estado</th><th></th></tr></thead><tbody>' +
        us.map(function (u) {
          var baja = u.estado_laboral === 'baja', tipo = [u.es_empleado ? 'Empleado' : '', u.es_pasante ? 'Pasante' : '', u.es_socio ? 'Socio' : '', u.es_externo ? 'Externo' : ''].filter(Boolean).join(', ');
          return '<tr><td><b>' + esc(u.nombre_completo) + '</b><div class="mut sm">' + (u.con_acceso === false ? 'Sin acceso al sistema' : esc(u.usuario) + (u.debe_cambiar ? ' · clave temporal' : '')) + (tipo ? ' · ' + esc(tipo) : '') + '</div></td>' +
            '<td>' + (u.cargo_id ? esc(nom(cat.cargos, u.cargo_id)) : '<span class="mut">—</span>') + '<div class="mut sm">' + esc(nom(cat.unidades, u.unidad_id) || '') + (u.nivel_id ? ' · ' + esc(nom(niv, u.nivel_id)) : '') + '</div>' + (pendiente(u) ? '<span class="pill bad">Estructura pendiente</span>' : '') + '</td>' +
            '<td>' + (u.autorizador_id ? esc(nom(us, u.autorizador_id, 'nombre_completo')) : '<span class="mut">—</span>') + '</td>' +
            '<td>' + (u.rol_id === 'admin_cliente' ? '<span class="pill ok">Administrador</span>' : '<span class="pill">Usuario</span>') + '</td>' +
            mods.map(function (m) { return '<td><input type="checkbox" class="chkm" data-u="' + u.id + '" data-m="' + m.id + '"' + (u.modulos[m.id] ? ' checked' : '') + (!u.activo ? ' disabled' : '') + ' aria-label="' + esc(u.nombre_completo + ' · ' + m.nombre) + '" style="width:18px;height:18px;accent-color:var(--jdi-primary)"></td>'; }).join('') +
            '<td>' + pillLaboral(u) + (baja ? '<div class="mut sm">' + esc(fecha(u.fecha_baja)) + (u.motivo_baja ? ' · ' + esc(u.motivo_baja) : '') + '</div>' : '') + '</td><td><div class="row" style="flex-wrap:nowrap">' +
            (baja ? '<button class="btn xs" data-re="' + u.id + '">Reingreso</button>' : '<button class="btn xs" data-ed="' + u.id + '">Editar</button>' + (u.con_acceso === false ? '' : '<button class="btn xs" data-rs="' + u.id + '">Restablecer clave</button>') + (u.id === yo ? '' : '<button class="btn xs" data-ba="' + u.id + '">Dar de baja</button>')) + '</div></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      var bn = $('#unew'); if (!d.estructura.ok && !SIMPLE) { bn.disabled = true; bn.title = 'Defina primero la estructura de la empresa'; }
      bn.onclick = function () { dlgPersona(null, d, mods); };
      var ie = $('#irEstr'); if (ie) ie.onclick = function (ev) { ev.preventDefault(); abrirAdmin('catalogo'); };
      el.onchange = function (ev) { var c = ev.target.closest('.chkm'); if (!c) return; var o = {}; o[c.dataset.m] = c.checked;
        api('usuarios.modulos', { id: c.dataset.u, modulos: o }).then(function () { toast(c.checked ? 'Acceso habilitado.' : 'Acceso retirado.', 'ok'); }).catch(function (e) { c.checked = !c.checked; toast(e.message, 'error'); }); };
      el.onclick = function (ev) {
        var ed = ev.target.closest('[data-ed]'), rs = ev.target.closest('[data-rs]'), ba = ev.target.closest('[data-ba]'), re = ev.target.closest('[data-re]');
        function persona(id) { return us.filter(function (x) { return x.id === id; })[0]; }
        if (ed) dlgPersona(persona(ed.dataset.ed), d, mods, yo);
        if (ba) dlgBaja(persona(ba.dataset.ba), d);
        if (re) dlgReingreso(persona(re.dataset.re));
        if (rs) { var u = persona(rs.dataset.rs);
          dlg({ titulo: 'Restablecer contraseña', html: '<p>Se generará una contraseña temporal para <b>' + esc(u.nombre_completo) + '</b> y se cerrarán sus sesiones abiertas.</p>', botones: [{ t: 'Cancelar' }, { t: 'Restablecer', cls: 'pri', run: function (dd, c) { return api('usuarios.resetClave', { id: u.id }).then(function (r) { c(true); return secreto('Contraseña temporal', r.usuario, r.clave_temporal); }); } }] }); }
      };
    });
  }

  /* Alta y edición de una persona (el mismo formulario para las dos cosas). */
  function dlgPersona(u, d, mods, yo) {
    var nueva = !u, cat = d.catalogo, niv = d.niveles.filter(function (n) { return n.activo || (u && u.nivel_id === n.id); });
    var unids = cat.unidades.filter(function (x) { return x.activo || (u && u.unidad_id === x.id); }), cargos = cat.cargos.filter(function (x) { return x.activo || (u && u.cargo_id === x.id); });
    var posibles = d.usuarios.filter(function (x) { return (!u || x.id !== u.id) && x.activo && x.estado_laboral === 'activo'; });
    var SIMPLE = d.estructura.simple, req = SIMPLE ? '' : ' *';
    var nom0 = u ? (u.nombres || '') : '', ape0 = u ? (u.apellidos || '') : '';
    if (u && !nom0 && !ape0) { var pt = String(u.nombre_completo || '').trim().split(/\s+/), mt = Math.max(1, Math.ceil(pt.length / 2)); nom0 = pt.slice(0, mt).join(' '); ape0 = pt.slice(mt).join(' '); }
    var html = '<div class="grid2">' + campo('nombres', 'Nombres', nom0, { req: true, max: 80 }) + campo('apellidos', 'Apellidos', ape0, { req: true, max: 80 }) + campo('documento', 'Documento de identidad (C.I.)', u ? u.documento : '', { req: true, max: 30 }) +
      campo('fecha_nacimiento', 'Fecha de nacimiento', u && u.fecha_nacimiento ? String(u.fecha_nacimiento).slice(0, 10) : '', { t: 'date' }) +
      campo('email', 'Correo (opcional)', u ? u.email : '', { t: 'email', max: 160 }) + campo('telefono', 'Teléfono', u ? u.telefono : '', { max: 30 }) +
      campo('fecha_ingreso', 'Fecha de ingreso', u && u.fecha_ingreso ? String(u.fecha_ingreso).slice(0, 10) : '', { t: 'date' }) + '</div>' +
      '<div class="grid2" style="margin-top:6px">' + selCampo('condicion', 'Condición *', optsCond(u)) + '</div>' +
      '<p class="sm" style="font-weight:600;margin:10px 0 6px">Estructura' + (d.estructura.ok ? ' (obligatoria)' : '') + '</p><div class="grid2">' +
      selCampo('cargo_id', 'Puesto' + req, optsSel(cargos, u && u.cargo_id, '— Elija —', function (x) { return x.nombre; })) +
      selCampo('unidad_id', 'Área de trabajo' + req, optsSel(unids, u && u.unidad_id, '— Elija —', function (x) { return x.codigo + ' · ' + x.nombre; })) +
      selCampo('nivel_id', 'Nivel de dependencia' + req, optsSel(niv, u && u.nivel_id, '— Elija —', function (x) { return x.orden + ' · ' + x.nombre; })) +
      selCampo('autorizador_id', 'Autorizador directo' + (!SIMPLE && !(u && u.rol_id === 'admin_cliente') ? ' *' : ''), optsSel(posibles, u && u.autorizador_id, '— Ninguno (cima) —', function (x) { return x.nombre_completo; }), 'Su jefe inmediato; recibe sus solicitudes.') + '</div>';
    if (nueva) {
      html += '<label class="chk" style="margin:12px 0 4px"><input type="checkbox" name="con_acceso" checked> Tendrá usuario y contraseña para ingresar</label>' +
        '<div id="bloqAcceso">' + campo('usuario', 'Usuario para ingresar', '', { max: 60, hint: '4 a 60 caracteres: letras, números, punto o guion.', full: true }) + '</div>' +
        '<p class="sm" style="font-weight:600;margin:10px 0 8px">Módulos habilitados</p>' + (mods.map(function (m) { return '<label class="chk" style="margin-bottom:8px"><input type="checkbox" name="mod_' + m.id + '"> ' + esc((MOD[m.id] || {}).n || m.nombre) + '</label>'; }).join('') || '<p class="mut sm">La empresa no tiene módulos activos.</p>');
    } else {
      html += '<label class="f"><span>Rol</span><select name="rol"><option value="usuario"' + (u.rol_id === 'usuario' ? ' selected' : '') + '>Usuario</option><option value="admin_cliente"' + (u.rol_id === 'admin_cliente' ? ' selected' : '') + '>Administrador del cliente</option></select></label>' +
        '<label class="chk"><input type="checkbox" name="activo"' + (u.activo ? ' checked' : '') + (u.id === yo ? ' disabled' : '') + '> Persona activa (desmarcar la suspende; para el retiro use «Dar de baja»)</label>';
    }
    dlg({ titulo: nueva ? 'Nueva persona' : 'Editar persona', wide: true, html: html,
      alAbrir: function (dd) { var c = dd.querySelector('[name=con_acceso]'); if (c) c.onchange = function () { dd.querySelector('#bloqAcceso').style.display = c.checked ? '' : 'none'; }; },
      botones: [{ t: 'Cancelar' }, { t: nueva ? 'Crear persona' : 'Guardar', cls: 'pri', run: function (dd, c) {
        var v = valores(dd), p = { nombres: v.nombres.trim(), apellidos: v.apellidos.trim(), documento: v.documento.trim(), telefono: v.telefono.trim(), email: v.email.trim(), condicion: v.condicion,
          cargo_id: v.cargo_id, unidad_id: v.unidad_id, nivel_id: v.nivel_id, autorizador_id: v.autorizador_id };
        if (v.fecha_ingreso) p.fecha_ingreso = v.fecha_ingreso;
        if (v.fecha_nacimiento) p.fecha_nacimiento = v.fecha_nacimiento;
        if (nueva) {
          p.con_acceso = v.con_acceso; p.usuario = (v.usuario || '').trim();
          p.modulos = mods.filter(function (m) { return v['mod_' + m.id]; }).map(function (m) { return m.id; });
          return api('usuarios.crear', p).then(function (r) { c(true); render(); if (r.clave_temporal) return secreto('Persona creada', r.usuario, r.clave_temporal); toast('Persona registrada (sin acceso al sistema).', 'ok'); });
        }
        p.id = u.id; if (u.id !== yo) p.activo = v.activo;
        return api('usuarios.actualizar', p).then(function () { return v.rol !== u.rol_id ? api('usuarios.rol', { id: u.id, rol: v.rol }) : true; }).then(function () { toast('Datos actualizados.', 'ok'); c(true); render(); }); } }] });
  }

  function dlgBaja(u, d) {
    var subs = d.usuarios.filter(function (x) { return x.autorizador_id === u.id && x.activo; }).length;
    dlg({ titulo: 'Dar de baja', html: '<p style="margin-bottom:10px"><b>' + esc(u.nombre_completo) + '</b> dejará de ingresar al sistema y se cerrarán sus sesiones. <b>No se borra nada</b> de lo que hizo y podrá reingresar más adelante.</p>' +
      (subs ? '<div class="aviso" role="note" style="margin-bottom:10px">Tiene ' + subs + ' persona(s) a su cargo. Sus solicitudes pasarán automáticamente al siguiente jefe en la jerarquía (hasta el administrador).</div>' : '') +
      '<div class="grid2">' + campo('fecha', 'Fecha de baja', new Date().toISOString().slice(0, 10), { t: 'date', req: true }) + campo('motivo', 'Motivo', '', { req: true, max: 200, ph: 'Ej.: renuncia, fin de contrato' }) + '</div>',
      botones: [{ t: 'Cancelar' }, { t: 'Dar de baja', cls: 'pri', run: function (dd, c) { var v = valores(dd);
        return api('personas.baja', { id: u.id, fecha: v.fecha, motivo: v.motivo.trim() }).then(function () { c(true); toast('Baja registrada.', 'ok'); render(); }); } }] });
  }
  function dlgReingreso(u) {
    dlg({ titulo: 'Reingreso', html: '<p style="margin-bottom:10px">Se reactivará a <b>' + esc(u.nombre_completo) + '</b> con su misma estructura y su historial. Si tiene acceso al sistema, recibirá una contraseña temporal nueva.</p><div class="grid2">' + campo('fecha', 'Fecha de reingreso', new Date().toISOString().slice(0, 10), { t: 'date', req: true }) + '</div>',
      botones: [{ t: 'Cancelar' }, { t: 'Reingresar', cls: 'pri', run: function (dd, c) { var v = valores(dd);
        return api('personas.reingreso', { id: u.id, fecha: v.fecha }).then(function (r) { c(true); render(); if (r.clave_temporal) return secreto('Reingreso registrado', r.usuario, r.clave_temporal); toast('Reingreso registrado.', 'ok'); }); } }] });
  }

  /* Tipos documentales globales: los usan los cuatro módulos (se muestran dentro de «Unidades y cargos») */
  function admTipos(el) {
    var ORIGEN = { administracion: 'Administración', firmas: 'Cites&Firmas', archivo: 'Archivo', identificadores: 'Identificadores', vacaciones: 'Vacaciones', files: 'Files de personal' };
    return api('tipos.listar').then(function (d) {
      var ts = d.tipos;
      el.innerHTML = '<div class="panel"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">Tipos documentales (globales) <span class="mut sm">(' + ts.length + ')</span></h3>' +
        '<div class="row"><button class="btn" id="timp">Importar de los módulos</button><button class="btn" id="tsyn">Sincronizar ahora</button><button class="btn pri" id="tnew">Nuevo tipo</button></div></div>' +
        '<p class="mut sm" style="margin-bottom:12px">Un tipo creado o cambiado en cualquier módulo aparece aquí y llega al instante a los demás. Las reglas propias de cada tipo (numeración, flujos) se configuran en cada módulo. Un tipo «padre» agrupa a otros, por ejemplo Formularios → de viaje, de caja chica.</p>' +
        (ts.length ? '<div class="tw"><table><thead><tr><th>Código</th><th>Nombre</th><th>Depende de</th><th>Creado en</th><th>Estado</th><th></th></tr></thead><tbody>' + ts.map(function (x) {
          return '<tr><td class="mono">' + esc(x.codigo) + '</td><td><b>' + esc(x.nombre) + '</b>' + (x.descripcion ? '<div class="mut sm">' + esc(x.descripcion) + '</div>' : '') + '</td><td>' + esc(x.padre || '—') + '</td><td>' + esc(ORIGEN[x.creado_en] || x.creado_en || '—') + '</td>' +
            '<td><span class="pill ' + (x.activo ? 'ok' : 'bad') + '">' + (x.activo ? 'Activo' : 'Inactivo') + '</span></td><td style="white-space:nowrap"><button class="btn xs" data-ted="' + x.id + '">Editar</button> <button class="btn xs" data-ton="' + x.id + '">' + (x.activo ? 'Desactivar' : 'Activar') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Aún no hay tipos documentales. Se cargan solos al habilitar los módulos, o cree el primero.</p>') + '</div>';
      function dlgTipo(x) {
        var padres = ts.filter(function (y) { return !y.padre && (!x || y.id !== x.id); });
        dlg({ titulo: x ? 'Editar tipo documental' : 'Nuevo tipo documental', html: '<div class="grid2">' + campo('codigo', 'Código', x ? x.codigo : '', { req: true, max: 12, hint: 'Hasta 12 letras, números o guiones. No se puede cambiar después.' }) + campo('nombre', 'Nombre', x ? x.nombre : '', { req: true, max: 120 }) + '</div>' +
          campo('descripcion', 'Descripción (opcional)', x ? x.descripcion : '', { max: 250 }) +
          '<label class="f"><span>Depende de (opcional)</span><select name="padre"><option value="">— Ninguno —</option>' + padres.map(function (y) { return '<option value="' + esc(y.codigo) + '"' + (x && x.padre === y.codigo ? ' selected' : '') + '>' + esc(y.codigo + ' · ' + y.nombre) + '</option>'; }).join('') + '</select></label>',
          alAbrir: function (dd) { if (x) { var c = dd.querySelector('[name=codigo]'); c.readOnly = true; } },
          botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (dd, c) { var v = valores(dd), p = { codigo: v.codigo.trim(), nombre: v.nombre.trim(), descripcion: v.descripcion.trim(), padre: v.padre }; if (x) p.id = x.id;
            return api('tipos.guardar', p).then(function (r) { c(true); var q = resumenSync(r.sincronizacion); toast(q.texto, q.tipo); render(); }); } }] });
      }
      $('#tnew', el).onclick = function () { dlgTipo(null); };
      $('#tsyn', el).onclick = function (ev) { ev.target.disabled = true; api('tipos.sincronizar').then(function (r) { var q = resumenSync(r); toast(q.texto, q.tipo); }).catch(function (e) { toast(e.message, 'error'); }).then(function () { ev.target.disabled = false; }); };
      $('#timp', el).onclick = function (ev) { ev.target.disabled = true; api('tipos.importar').then(function (r) { var q = resumenSync(r.sincronizacion); toast('Importados ' + r.tipos + ' tipos. ' + q.texto, q.tipo); render(); }).catch(function (e) { ev.target.disabled = false; toast(e.message, 'error'); }); };
      el.onclick = function (ev) {
        var e1 = ev.target.closest('[data-ted]'), e2 = ev.target.closest('[data-ton]'); var id = e1 ? e1.dataset.ted : e2 ? e2.dataset.ton : null; if (!id) return;
        var x = ts.filter(function (y) { return y.id === id; })[0]; if (!x) return;
        if (e1) return dlgTipo(x);
        e2.disabled = true;
        api('tipos.estado', { id: x.id, activo: !x.activo }).then(function (r) { var q = resumenSync(r.sincronizacion); toast(q.texto, q.tipo); render(); }).catch(function (er) { e2.disabled = false; toast(er.message, 'error'); });
      };
    });
  }

  /* Estructura global de cites + numeración inicial por unidad (la heredan Cites&Firmas, Archivo e Identificadores) */
  function admCites(el) {
    return Promise.all([api('cites.config.obtener'), api('cites.contadores.listar'), api('catalogo.listar'), api('tipos.listar')]).then(function (r) {
      var cfg = r[0], cn = r[1], cat = r[2], tipos = r[3].tipos.filter(function (t) { return t.activo; });
      var FICHAS = { INST: 'Institución', DEP: 'Dependencia', UNI: 'Unidad', JEF: 'Jefatura', TIPO: 'Tipo', NUM: 'Número', GESTION: 'Gestión', AA: 'Año (2 cifras)' };
      var uni = cat.unidades.filter(function (x) { return x.activo; });
      function ruta(u) { var out = [u.codigo], c = u, g = 0; while (c && c.dependencia && g++ < 6) { var p = uni.filter(function (x) { return x.codigo.toLowerCase() === String(c.dependencia).toLowerCase(); })[0]; out.unshift(p ? p.codigo : c.dependencia); c = p; } return out.slice(0, 3).join('/'); }
      var y = new Date().getFullYear();
      el.innerHTML = '<div class="panel"><h3>Estructura del cite (única para toda la institución)</h3>' +
        '<p class="mut sm" style="margin-bottom:10px">La heredan Cites&amp;Firmas, Archivo e Identificadores, así un mismo cite se escribe igual en todos los módulos. Cada dependencia, unidad o jefatura numera desde 1 por tipo y el número se reinicia cada gestión.</p>' +
        '<div class="grid2"><label class="f"><span>Estructura</span><input name="formato" id="cfmt" value="' + esc(cfg.formato) + '" maxlength="80" class="mono"></label>' +
        '<label class="f"><span>Ceros a la izquierda del número (0–8)</span><input name="relleno" id="crel" type="number" min="0" max="8" value="' + cfg.relleno + '"></label></div>' +
        '<div class="row" style="flex-wrap:wrap;gap:6px;margin:8px 0">' + cfg.fichas.map(function (f) { return '<button type="button" class="btn xs" data-f="' + f + '" title="' + esc(FICHAS[f]) + '">{' + f + '}</button>'; }).join('') + '</div>' +
        '<p>Ejemplo: <b class="mono" id="cpre">' + esc(cfg.previsualizacion) + '</b></p><p class="mut sm">Sigla de la institución: <b>' + esc(cfg.inst || '— (defínala en Empresa)') + '</b>. Una ficha vacía (por ejemplo sin jefatura) se omite con su separador.</p>' +
        '<div class="row" style="margin-top:10px"><button class="btn pri" id="csave">Guardar estructura</button></div></div>' +
        '<div class="panel" style="margin-top:14px"><h3>Numeración inicial por unidad</h3>' +
        (cn.pendientes ? '<div class="err" style="margin-bottom:10px">Hay ' + cn.pendientes + ' numeración(es) sin confirmar. Cites&amp;Firmas no emitirá en ellas hasta confirmar desde qué número continúa.</div>' : '') +
        '<p class="mut sm" style="margin-bottom:10px">Archivo y Cites&amp;Firmas comparten el mismo correlativo. Si su archivo físico llegó más lejos de lo digitalizado (por ejemplo, 255 y en Archivo solo 145), indique aquí el último número realmente usado: Cites&amp;Firmas continuará desde el siguiente. No se puede bajar un número ya usado.</p>' +
        (cn.contadores.length ? '<div class="tw"><table><thead><tr><th>Unidad</th><th>Tipo</th><th>Gestión</th><th>Último número</th><th>Estado</th></tr></thead><tbody>' + cn.contadores.map(function (x) {
          return '<tr><td class="mono">' + esc(x.nodo) + '</td><td class="mono">' + esc(x.tipo) + '</td><td>' + esc(x.gestion) + '</td><td>' + x.ultimo + '</td><td><span class="pill ' + (x.confirmado ? 'ok' : 'warn') + '">' + (x.confirmado ? 'Confirmado' : 'Por confirmar') + '</span> ' +
            '<button class="btn xs" data-cf="' + esc(x.nodo) + '|' + esc(x.tipo) + '|' + esc(x.gestion) + '|' + x.ultimo + '">' + (x.confirmado ? 'Cambiar' : 'Confirmar') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Aún no hay cites numerados.</p>') +
        '<h4 style="margin:14px 0 6px">Fijar numeración de una unidad</h4><div class="grid2">' +
        '<label class="f"><span>Unidad</span><select id="nu">' + uni.map(function (u) { return '<option value="' + esc(ruta(u)) + '">' + esc(u.nombre) + ' (' + esc(ruta(u)) + ')</option>'; }).join('') + '</select></label>' +
        '<label class="f"><span>Tipo documental</span><select id="nt">' + tipos.map(function (t) { return '<option value="' + esc(t.codigo) + '">' + esc(t.codigo) + ' · ' + esc(t.nombre) + '</option>'; }).join('') + '</select></label>' +
        '<label class="f"><span>Gestión</span><input id="ng" type="number" value="' + y + '"></label><label class="f"><span>Último número usado</span><input id="nn" type="number" min="0" value="0"></label></div>' +
        '<div class="row" style="margin-top:10px"><button class="btn pri" id="nsave">Guardar numeración</button></div></div>';
      var inp = $('#cfmt', el);
      function previa() { api('cites.previsualizar', { formato: inp.value, relleno: Number($('#crel', el).value) }).then(function (p) { $('#cpre', el).textContent = p.previsualizacion; }).catch(function (e) { $('#cpre', el).textContent = e.message; }); }
      inp.oninput = previa; $('#crel', el).oninput = previa;
      el.onclick = function (ev) {
        var f = ev.target.closest('[data-f]'); if (f) { inp.value += '{' + f.dataset.f + '}'; return previa(); }
        var c = ev.target.closest('[data-cf]');
        if (c) { var q = c.dataset.cf.split('|'); $('#nu', el).value = q[0]; $('#nt', el).value = q[1]; $('#ng', el).value = q[2]; $('#nn', el).value = q[3]; $('#nn', el).focus(); }
      };
      $('#csave', el).onclick = function () { api('cites.config.guardar', { formato: inp.value, relleno: Number($('#crel', el).value) }).then(function () { toast('Estructura guardada.', 'ok'); render(); }).catch(function (e) { toast(e.message, 'error'); }); };
      $('#nsave', el).onclick = function () {
        api('cites.contadores.guardar', { nodo: $('#nu', el).value, tipo: $('#nt', el).value, gestion: $('#ng', el).value, ultimo: Number($('#nn', el).value) }).then(function () { toast('Numeración guardada.', 'ok'); render(); }).catch(function (e) { toast(e.message, 'error'); });
      };
    });
  }

  /* Niveles de dependencia (se muestran dentro de «Unidades y cargos») */
  function admNiveles(el) {
    return api('niveles.listar').then(function (d) {
      el.innerHTML = '<div class="panel"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0">Niveles de dependencia <span class="mut sm">(' + d.niveles.length + ')</span></h3><button class="btn pri" id="nnew">Nuevo nivel</button></div>' +
        '<p class="mut sm" style="margin-bottom:12px">Ordene los niveles de la jerarquía: 1 es el más alto (por ejemplo 1 Dirección, 2 Jefatura, 3 Técnico). El autorizador directo de una persona debe estar en un nivel superior al suyo.</p>' +
        (d.niveles.length ? '<div class="tw"><table><thead><tr><th>Orden</th><th>Nombre</th><th>Estado</th><th></th></tr></thead><tbody>' + d.niveles.map(function (x) {
          return '<tr><td class="mono">' + x.orden + '</td><td><b>' + esc(x.nombre) + '</b></td><td><span class="pill ' + (x.activo ? 'ok' : 'bad') + '">' + (x.activo ? 'Activo' : 'Inactivo') + '</span></td><td style="white-space:nowrap"><button class="btn xs" data-ned="' + x.id + '">Editar</button> <button class="btn xs" data-non="' + x.id + '">' + (x.activo ? 'Desactivar' : 'Activar') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Aún no hay niveles. Cree al menos uno para empezar a definir la jerarquía.</p>') + '</div>';
      function dlgNivel(x) {
        dlg({ titulo: x ? 'Editar nivel' : 'Nuevo nivel', html: '<div class="grid2">' + campo('orden', 'Orden (1 = más alto)', x ? x.orden : (d.niveles.length ? Math.max.apply(null, d.niveles.map(function (n) { return n.orden; })) + 1 : 1), { t: 'number', req: true }) + campo('nombre', 'Nombre', x ? x.nombre : '', { req: true, max: 80 }) + '</div>',
          botones: [{ t: 'Cancelar' }, { t: 'Guardar', cls: 'pri', run: function (dd, c) { var v = valores(dd); var p = { orden: Number(v.orden), nombre: v.nombre.trim() }; if (x) p.id = x.id;
            return api('niveles.guardar', p).then(function () { c(true); toast('Nivel guardado.', 'ok'); render(); }); } }] });
      }
      $('#nnew', el).onclick = function () { dlgNivel(null); };
      el.onclick = function (ev) {
        var e1 = ev.target.closest('[data-ned]'), e2 = ev.target.closest('[data-non]'); var id = e1 ? e1.dataset.ned : e2 ? e2.dataset.non : null; if (!id) return;
        var x = d.niveles.filter(function (y) { return y.id === id; })[0]; if (!x) return;
        if (e1) return dlgNivel(x);
        api('niveles.guardar', { id: x.id, orden: x.orden, nombre: x.nombre, activo: !x.activo }).then(function () { render(); }).catch(function (er) { toast(er.message, 'error'); });
      };
    });
  }

  function admAuditoria(el) {
    return api('auditoria.listar', { limite: 100 }).then(function (r) {
      el.innerHTML = '<div class="panel"><h3>Últimos movimientos</h3>' + (r.length ? '<div class="tw"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>' + r.map(function (a) {
        return '<tr><td class="mono" style="white-space:nowrap">' + esc(String(a.creado_en || '').replace('T', ' ').slice(0, 16)) + '</td><td>' + esc(a.usuario) + '</td><td>' + esc(a.accion) + '</td><td class="mut sm">' + esc(JSON.stringify(a.detalle || {}).slice(0, 140)) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mut">Sin movimientos registrados.</p>') + '</div>';
    });
  }

  /* ---------- SuperAdministrador ---------- */
  function vistaSuper() { return '<section class="hello"><h1>Bienvenido de nuevo, ' + esc((ST.me.usuario.nombre || '').split(/\s+/)[0]) + '</h1><p>Panel del SuperAdministrador: empresas, módulos y suscripciones.</p></section><div id="sup" style="margin-top:24px"><p class="mut">Cargando…</p></div>'; }
  function enlazarSuper() {
    Promise.all([api('sistema.estadisticas'), api('empresas.listar')]).then(function (r) {
      var s = r[0], es = r[1], el = $('#sup');
      el.innerHTML = '<div class="kpis"><div class="kpi"><span>Empresas</span><b>' + s.empresas + '</b></div><div class="kpi"><span>Activas</span><b>' + s.activas + '</b></div><div class="kpi"><span>Suspendidas</span><b>' + s.suspendidas + '</b></div><div class="kpi"><span>Vencen en 30 días</span><b>' + s.vencen_30_dias + '</b></div><div class="kpi"><span>Usuarios activos</span><b>' + s.usuarios_activos + '</b></div></div>' +
        '<div class="panel"><div class="row between" style="margin-bottom:14px"><h3 style="margin:0">Empresas</h3><button class="btn pri" id="enew">Nueva empresa</button></div>' +
        (es.length ? '<div class="tw"><table><thead><tr><th>Empresa</th><th>Estado</th><th>Módulos</th><th>Usuarios</th><th>Vence</th><th></th></tr></thead><tbody>' + es.map(function (e) {
          return '<tr><td><b>' + esc(e.nombre) + '</b><div class="mut sm">' + esc(e.slug) + '</div></td><td>' + pillEstado(e.suscripcion.estado) + '</td><td><div class="mods">' + e.modulos.map(function (m) { return '<span class="pill ' + (m.estado === 'activo' ? 'ok' : 'bad') + '">' + esc(MI(m.id).n) + (PREMIUM[m.id] ? ' ★' : '') + '</span>'; }).join('') + '</div></td><td class="mono">' + e.usuarios_activos + ' / ' + e.max_usuarios + '</td><td>' + fecha(e.suscripcion_fin) + '</td><td><button class="btn xs" data-e="' + e.id + '">Gestionar</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">Aún no hay empresas. Cree la primera para empezar.</div>') + '</div>';
      $('#enew').onclick = dlgEmpresaNueva;
      el.onclick = function (ev) { var b = ev.target.closest('[data-e]'); if (b) dlgEmpresa(b.dataset.e); };
    }).catch(function (e) { $('#sup').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
  }
  function dlgEmpresaNueva() {
    dlg({ titulo: 'Nueva empresa', wide: true, html: '<h3 style="margin-bottom:10px;font-size:.95rem">Empresa</h3><div class="grid2">' + campo('nombre', 'Nombre', '', { req: true, max: 160 }) + campo('slug', 'Identificador', '', { req: true, max: 40, hint: 'Minúsculas, números y guiones. No se puede cambiar.' }) + campo('sigla', 'Sigla', '', { max: 30 }) + campo('suscripcion_fin', 'Vence la suscripción', '', { t: 'date' }) + campo('max_usuarios', 'Máximo de usuarios', '25', { t: 'number' }) + selCampo('plan', 'Plan', '<option value="estandar">Estándar</option><option value="premium">Premium (todos los módulos)</option>') + selCampo('organizacion', 'Organización', '<option value="estructurada">Con estructura (áreas, cargos, niveles)</option><option value="simple">Simple (unipersonal / sin estructura)</option>', 'El administrador del cliente puede cambiarlo luego.') + '</div>' +
      '<h3 style="margin:8px 0 10px;font-size:.95rem">Administrador del cliente</h3><div class="grid2">' + campo('adm_nombre', 'Nombre completo', '', { req: true, max: 120 }) + campo('adm_usuario', 'Usuario', '', { req: true, max: 60 }) + campo('adm_email', 'Correo (opcional)', '', { t: 'email', max: 160, full: true }) + '</div>' +
      '<h3 style="margin:8px 0 10px;font-size:.95rem">Módulos contratados</h3><div class="row" style="gap:6px 24px">' + ORDEN.map(function (id) { return '<label class="chk"><input type="checkbox" name="mod_' + id + '"> ' + esc(MOD[id].n) + (PREMIUM[id] ? ' ' + etqPaquete({ id: id }) : '') + '</label>'; }).join('') + '</div><p class="mut sm" style="margin-top:8px">El plan Estándar incluye Identificadores y Cites&amp;Firmas. El plan Premium suma Vacaciones, Archivo y Files de personal. Todos funcionan igual; el plan solo los agrupa y marca.</p>',
      alAbrir: function (dd) { var pl = dd.querySelector('[name=plan]'); function aplicar() { ORDEN.forEach(function (id) { var k = dd.querySelector('[name=mod_' + id + ']'); if (k) k.checked = pl.value === 'premium' || !PREMIUM[id]; }); } pl.onchange = aplicar; aplicar(); },
      botones: [{ t: 'Cancelar' }, { t: 'Crear empresa', cls: 'pri', run: function (d, c) { var v = valores(d), ms = ORDEN.filter(function (id) { return v['mod_' + id]; });
        return api('empresas.crear', { nombre: v.nombre.trim(), slug: v.slug.trim(), sigla: v.sigla.trim(), suscripcion_fin: v.suscripcion_fin, max_usuarios: v.max_usuarios, plan: v.plan, organizacion: v.organizacion, modulos: ms, admin: { nombre_completo: v.adm_nombre.trim(), usuario: v.adm_usuario.trim(), email: v.adm_email.trim() } })
          .then(function (r) { c(true); if (r.avisos && r.avisos.length) toast(r.avisos.join(' '), 'error'); render(); return secreto('Administrador creado', r.admin.usuario, r.admin.clave_temporal); }); } }] });
  }
  function dlgEmpresa(id) {
    api('empresas.obtener', { id: id }).then(function (e) {
      var html = '<div class="row between" style="margin-bottom:12px"><div>' + pillEstado(e.suscripcion.estado) + ' <span class="mut sm">' + esc(e.slug) + '</span></div></div>' +
        '<form id="fe"><div class="grid2">' + campo('nombre', 'Nombre', e.nombre, { max: 160 }) + campo('sigla', 'Sigla', e.sigla, { max: 30 }) + campo('plan', 'Plan', e.plan, { max: 40 }) + campo('max_usuarios', 'Máximo de usuarios', e.max_usuarios, { t: 'number' }) + campo('suscripcion_inicio', 'Inicio de suscripción', (e.suscripcion_inicio || '').slice(0, 10), { t: 'date' }) + campo('suscripcion_fin', 'Vence', (e.suscripcion_fin || '').slice(0, 10), { t: 'date' }) +
        '<label class="f"><span>Estado</span><select name="estado">' + ['activa', 'suspendida', 'vencida'].map(function (x) { return '<option' + (x === e.estado ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div></form>' +
        '<h3 style="margin:10px 0">Módulos</h3><div class="tw"><table><tbody>' + e.modulos.map(function (m) {
          var btn = !m.contratado ? '<button class="btn xs pri" data-hab="' + m.id + '">Habilitar</button>' : m.estado === 'activo' ? '<button class="btn xs bad" data-sus="' + m.id + '">Suspender</button>' : '<button class="btn xs" data-hab="' + m.id + '">Reactivar</button>';
          return '<tr><td><b>' + esc(m.nombre) + '</b></td><td>' + (m.contratado ? pillEstado(m.estado) : '<span class="pill">No contratado</span>') + '</td><td style="text-align:right">' + btn + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mut sm" style="margin:8px 0 14px">Un módulo nuevo toma la marca, configuración y usuarios que la empresa ya tiene.</p>' +
        '<h3 style="margin:10px 0">Administradores</h3>' + e.usuarios.filter(function (u) { return u.rol_id === 'admin_cliente'; }).map(function (u) { return '<div class="row between" style="margin-bottom:8px"><span><b>' + esc(u.nombre_completo) + '</b> <span class="mut sm">' + esc(u.usuario) + (u.activo ? '' : ' · inactivo') + '</span></span><button class="btn xs" data-ra="' + u.id + '">Restablecer clave</button></div>'; }).join('') +
        '<p class="mut sm" style="margin-top:12px">' + e.usuarios.length + ' usuario(s) en total.</p>';
      dlg({ titulo: e.nombre, wide: true, html: html, botones: [{ t: 'Cerrar' }, { t: 'Guardar datos', cls: 'pri', run: function (d, c) { var v = valores($('#fe', d)); v.id = id; return api('empresas.actualizar', v).then(function () { toast('Empresa actualizada.', 'ok'); c(true); render(); }); } }],
        alAbrir: function (d, c) {
          d.addEventListener('click', function (ev) {
            var h = ev.target.closest('[data-hab]'), s = ev.target.closest('[data-sus]'), ra = ev.target.closest('[data-ra]');
            if (h) api('empresas.modulo', { id: id, modulo: h.dataset.hab, accion: 'habilitar', heredar_usuarios: true }).then(function () { toast('Módulo habilitado con la configuración y usuarios de la empresa.', 'ok'); c(true); render(); dlgEmpresa(id); }).catch(function (er) { errEn(d, er); });
            if (s) api('empresas.modulo', { id: id, modulo: s.dataset.sus, accion: 'suspender' }).then(function () { toast('Módulo suspendido.', 'ok'); c(true); render(); dlgEmpresa(id); }).catch(function (er) { errEn(d, er); });
            if (ra) api('empresas.resetAdmin', { empresa_id: id, usuario_id: ra.dataset.ra }).then(function (r) { return secreto('Contraseña temporal', r.usuario, r.clave_temporal); }).catch(function (er) { errEn(d, er); });
          });
        } });
    }).catch(function (er) { toast(er.message, 'error'); });
  }

  /* ---------- arranque ---------- */
  function iniciar() {
    var t = store.get('jdi.token');
    if (!t) return pantallaLogin('');
    ST.token = t;
    api('me').then(function (me) { ST.me = me; aplicarMarca(); entrar(); }).catch(function (e) { if (e.code !== 'SESION') { store.set('jdi.token', null); ST.token = null; pantallaLogin(e.code === 'CONFIG' || e.code === 'RED' ? e.message : ''); } });
  }
  iniciar();
})();
