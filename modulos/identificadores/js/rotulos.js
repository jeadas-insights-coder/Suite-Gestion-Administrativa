/* JeaDas.Insights · Identificadores · rótulos imprimibles.
 * Plantillas: caratula, subcaratula, pestana, lomo17, lomo12, indice.
 * QR por plantilla: caratula → repositorio · subcaratula → sin QR · pestana → sin QR · lomo → geolocalización · indice → ambos.
 * Papel: carta, a4, oficio (en milímetros). Modelo de tomo (idéntico venga de Archivo o de Identificadores propios):
 *   { codigo, tipoCodigo, tipoNombre, unidad, gestion, titulo, rango, ubicacion, qrRepo, qrUbi, pestana,
 *     secciones:[{ codigo, nombre, desde, hasta, fechas, folios, pestana }] }
 * Sin dependencias del DOM: devuelve HTML (cadena) y la regla @page. */
(function (global) {
  'use strict';
  var PAPEL = { carta: { n: 'Carta', w: 215.9, h: 279.4 }, a4: { n: 'A4', w: 210, h: 297 }, oficio: { n: 'Oficio', w: 215.9, h: 330.2 } };
  var PLANTILLAS = {
    caratula: { n: 'Carátula', qr: ['repo'], horizontal: false, desc: 'Portada del tomo, con QR del repositorio.' },
    subcaratula: { n: 'Subcarátula', qr: [], horizontal: false, desc: 'Una hoja por sección, sin QR.' },
    pestana: { n: 'Pestaña', qr: [], horizontal: false, desc: 'Pestañas (una por sección), sin QR.' },
    lomo17: { n: 'Lomo 17 × 4,5 cm', qr: ['ubi'], horizontal: false, desc: 'Rótulo de lomo, con QR de geolocalización.' },
    lomo12: { n: 'Lomo 12 × 4,5 cm', qr: ['ubi'], horizontal: false, desc: 'Rótulo de lomo corto, con QR de geolocalización.' },
    indice: { n: 'Índice general', qr: ['repo', 'ubi'], horizontal: true, desc: 'Índice horizontal con ambos QR.' }
  };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qr(texto, mm, titulo) {
    if (!texto) return '<div class="r-noqr" style="width:' + mm + 'mm;height:' + mm + 'mm">Sin QR</div>';
    var svg = global.JDIQR.svg(texto, { px: 256, margen: 1 }).replace('width="256" height="256"', 'width="100%" height="100%"');
    return '<figure class="r-qr" style="width:' + mm + 'mm"><div style="width:' + mm + 'mm;height:' + mm + 'mm">' + svg + '</div><figcaption>' + esc(titulo) + '</figcaption></figure>';
  }
  function cab(o) {
    var i = o.inst || {};
    return '<div class="r-cab">' + (i.logo ? '<img alt="" src="' + esc(i.logo) + '" class="r-logo">' : '') + '<div><b>' + esc(i.nombre || '') + '</b>' + (o.tomo.unidad ? '<br><span>' + esc(o.tomo.unidad) + '</span>' : '') + '</div></div>';
  }
  function caratula(o) {
    var t = o.tomo;
    return '<section class="r-hoja r-cara" data-tpl="caratula">' + cab(o) +
      '<div class="r-centro"><div class="r-tipo">' + esc(t.tipoNombre || t.tipoCodigo) + '</div><div class="r-tomo">' + esc(t.codigo) + '</div><div class="r-gest">Gestión ' + esc(t.gestion) + '</div>' +
      (t.titulo ? '<div class="r-tit">' + esc(t.titulo) + '</div>' : '') + (t.rango ? '<div class="r-rango">' + esc(t.rango) + '</div>' : '') + '</div>' +
      '<div class="r-pie"><div>' + (t.ubicacion ? '<b>Ubicación:</b> ' + esc(t.ubicacion) : '') + (t.pestana ? '<br><b>Código:</b> ' + esc(t.pestana) : '') + '</div>' + qr(t.qrRepo, 38, 'Repositorio digital') + '</div></section>';
  }
  function subcaratulas(o) {
    var t = o.tomo, ss = o.secciones && o.secciones.length ? o.secciones : t.secciones || [];
    if (!ss.length) return '<section class="r-hoja" data-tpl="subcaratula"><p class="r-vacio">Este tomo aún no tiene secciones. Cree una sección para imprimir su subcarátula.</p></section>';
    return ss.map(function (s) {
      return '<section class="r-hoja r-sub" data-tpl="subcaratula">' + cab(o) + '<div class="r-centro"><div class="r-tipo">' + esc(t.tipoNombre || t.tipoCodigo) + ' · ' + esc(t.codigo) + '</div><div class="r-tomo">' + esc(s.codigo) + '</div>' +
        '<div class="r-tit">' + esc(s.nombre) + '</div>' + (s.fechas ? '<div class="r-rango">' + esc(s.fechas) + '</div>' : '') + (s.folios ? '<div class="r-rango">Folios: ' + esc(s.folios) + '</div>' : '') + '</div>' +
        '<div class="r-pie"><div><b>Gestión:</b> ' + esc(t.gestion) + '<br><b>Pestaña:</b> ' + esc(s.pestana || t.pestana) + '</div></div></section>';
    }).join('');
  }
  function pestanas(o) {
    var t = o.tomo, ss = o.secciones && o.secciones.length ? o.secciones : t.secciones || [];
    if (!ss.length) return '<section class="r-hoja" data-tpl="pestana"><p class="r-vacio">Este tomo aún no tiene secciones: no hay pestañas que imprimir.</p></section>';
    return '<section class="r-hoja r-pest" data-tpl="pestana">' + ss.map(function (s) {
      return '<div class="r-tab"><b>' + esc(s.pestana || (t.pestana + '/' + s.codigo)) + '</b><span>' + esc(s.nombre) + '</span></div>';
    }).join('') + '</section>';
  }
  function lomo(o, ancho) {
    var t = o.tomo, i = o.inst || {};
    return '<section class="r-hoja r-solo" data-tpl="lomo' + ancho + '"><div class="r-lomo" style="width:' + (ancho * 10) + 'mm;height:45mm"><div class="r-lomo-txt"><b>' + esc(i.sigla || i.nombre || '') + '</b> · ' + esc(t.unidad) + '<div class="r-lomo-tipo">' + esc(t.tipoNombre || t.tipoCodigo) + '</div>' +
      '<div class="r-lomo-tomo">' + esc(t.codigo) + ' · ' + esc(t.gestion) + '</div>' + (t.rango ? '<div>' + esc(t.rango) + '</div>' : '') + (t.ubicacion ? '<div>' + esc(t.ubicacion) + '</div>' : '') + '</div>' + qr(t.qrUbi, ancho === 17 ? 34 : 30, 'Ubicación') + '</div></section>';
  }
  function indice(o) {
    var t = o.tomo, ss = t.secciones || [];
    return '<section class="r-hoja r-ind" data-tpl="indice">' + '<div class="r-ind-cab">' + cab(o) + '<div class="r-ind-tit"><div class="r-tipo">Índice general · ' + esc(t.tipoNombre || t.tipoCodigo) + '</div><div class="r-tomo">' + esc(t.codigo) + ' · ' + esc(t.gestion) + '</div>' +
      (t.rango ? '<div>' + esc(t.rango) + '</div>' : '') + '</div><div class="r-ind-qr">' + qr(t.qrRepo, 30, 'Repositorio') + qr(t.qrUbi, 30, 'Ubicación') + '</div></div>' +
      '<table class="r-tabla"><thead><tr><th>Sección</th><th>Contenido</th><th>Fechas</th><th>Folios</th><th>Pestaña</th></tr></thead><tbody>' +
      (ss.map(function (s) { return '<tr><td>' + esc(s.codigo) + '</td><td>' + esc(s.nombre) + '</td><td>' + esc(s.fechas) + '</td><td>' + esc(s.folios) + '</td><td>' + esc(s.pestana) + '</td></tr>'; }).join('') || '<tr><td colspan="5">Sin secciones.</td></tr>') + '</tbody></table></section>';
  }
  /** o: { plantilla, papel, tomo, inst:{nombre,sigla,logo}, secciones? (subconjunto) } → { html, css, qrs, horizontal } */
  function render(o) {
    var tp = PLANTILLAS[o.plantilla], pp = PAPEL[o.papel];
    if (!tp) throw new Error('Plantilla desconocida.');
    if (!pp) throw new Error('Tamaño de papel desconocido.');
    var html = o.plantilla === 'caratula' ? caratula(o) : o.plantilla === 'subcaratula' ? subcaratulas(o) : o.plantilla === 'pestana' ? pestanas(o) : o.plantilla === 'lomo17' ? lomo(o, 17) : o.plantilla === 'lomo12' ? lomo(o, 12) : indice(o);
    var w = tp.horizontal ? pp.h : pp.w, h = tp.horizontal ? pp.w : pp.h;
    var css = '@page{size:' + w + 'mm ' + h + 'mm;margin:12mm}';
    var qrs = (html.match(/class="r-qr"/g) || []).length;
    return { html: html, css: css, qrs: qrs, horizontal: tp.horizontal, anchoMm: w, altoMm: h };
  }
  /** Estilos de pantalla e impresión de la vista previa (se inyectan una vez). */
  var ESTILO = '.r-pagina{background:#fff;color:#111;margin:0 auto 18px;box-shadow:0 2px 14px rgba(0,0,0,.35);padding:12mm;box-sizing:border-box;overflow:hidden}' +
    '.r-hoja{display:flex;flex-direction:column;min-height:100%;page-break-after:always;font-family:Georgia,"Times New Roman",serif}.r-hoja:last-child{page-break-after:auto}' +
    '.r-cab{display:flex;gap:12px;align-items:center;border-bottom:2px solid #111;padding-bottom:8px}.r-logo{max-height:18mm;max-width:40mm}' +
    '.r-centro{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:10px;padding:10mm 0}' +
    '.r-tipo{font-size:24pt;font-weight:700;text-transform:uppercase}.r-tomo{font-size:44pt;font-weight:800}.r-gest{font-size:20pt}.r-tit{font-size:18pt}.r-rango{font-size:13pt;color:#333}' +
    '.r-pie{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #555;padding-top:8px;font-size:11pt}' +
    '.r-qr{margin:0;text-align:center;font:8pt sans-serif}.r-qr figcaption{margin-top:1mm}.r-noqr{border:1px dashed #999;display:flex;align-items:center;justify-content:center;font:8pt sans-serif;color:#777}' +
    '.r-pest{flex-direction:row;flex-wrap:wrap;gap:4mm;align-content:flex-start}.r-tab{width:90mm;height:22mm;border:1px dashed #555;border-radius:2mm;padding:2mm 3mm;display:flex;flex-direction:column;justify-content:center;font:700 13pt sans-serif;box-sizing:border-box}.r-tab span{font:9pt sans-serif;font-weight:400}' +
    '.r-solo{align-items:flex-start}.r-lomo{border:1px dashed #111;display:flex;align-items:center;justify-content:space-between;gap:4mm;padding:2.5mm 4mm;box-sizing:border-box;font:9pt sans-serif}.r-lomo-tipo{font-size:13pt;font-weight:800;text-transform:uppercase}.r-lomo-tomo{font-size:15pt;font-weight:800}' +
    '.r-ind-cab{display:flex;justify-content:space-between;align-items:center;gap:10mm;margin-bottom:6mm}.r-ind-cab .r-cab{border:0;flex:1}.r-ind-tit{text-align:center;flex:1}.r-ind-tit .r-tipo{font-size:16pt}.r-ind-tit .r-tomo{font-size:26pt}.r-ind-qr{display:flex;gap:6mm}' +
    '.r-tabla{width:100%;border-collapse:collapse;font:10pt sans-serif}.r-tabla th,.r-tabla td{border:1px solid #444;padding:2mm 2.5mm;text-align:left;vertical-align:top;color:#111}.r-tabla th{background:#e8e8e8}' +
    '.r-vacio{font:12pt sans-serif;color:#555;text-align:center;margin:20mm 0}';
  global.ROT = { PAPEL: PAPEL, PLANTILLAS: PLANTILLAS, render: render, ESTILO: ESTILO, esc: esc };
})(typeof window !== 'undefined' ? window : this);
