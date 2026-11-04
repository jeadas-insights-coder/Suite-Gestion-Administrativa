/* JeaDas.Insights - Files de personal (interfaz) */
const st = { b: null, personas: [], unidades: [], file: null, vista: 'panel', filtro: { texto: '', estado: '', unidad: '' }, roles: [] };
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const can = p => st.b.permisos.includes(p);
function msg(t, err) { $('notice').innerHTML = `<div class="msg ${err ? 'error' : 'success'}" role="status">${esc(t)}</div>`; }
async function api(action, data = {}) { const j = await JDI.api({ action, data }); if (!j || !j.ok) throw Error((j && j.error) || 'Error del servidor'); return j.data; }
const run = f => async (...a) => { try { await f(...a); } catch (e) { msg(e.message, true); } };
const fecha = f => f ? String(f).slice(0, 10).split('-').reverse().join('/') : '—';
const SIT = { 'Vigente': 'on', 'Por vencer': 'warn', 'Vencido': 'off', 'Falta': 'off', 'Opcional': '', 'Anulado': '', 'Reemplazado': '' };
const pill = s => `<span class="pill ${SIT[s] || ''}">${esc(s)}</span>`;
const barra = p => `<div class="bar" title="${p}%"><i style="width:${p}%"></i></div>`;
const ALCANCE = a => a === 'todos' ? 'Todo el personal' : a === 'empleado' ? 'Empleados' : a === 'pasante' ? 'Pasantes' : a === 'socio' ? 'Socios' : a === 'externo' ? 'Externos' : a.startsWith('cargo:') ? 'Cargo: ' + a.slice(6) : a.startsWith('unidad:') ? 'Unidad: ' + a.slice(7) : a;

const NAV = [['panel', 'Panel', 'files.panel'], ['personal', 'Personal', 'files.panel'], ['mifile', 'Mi file', 'files.propio'], ['requisitos', 'Requisitos', 'files.requisitos'],
  ['usuarios', 'Usuarios', 'files.usuarios'], ['roles', 'Roles', 'files.roles'], ['auditoria', 'Auditoría', 'files.auditoria']];

function renderNav() {
  $('tabs').innerHTML = NAV.filter(n => can(n[2])).map(n => `<button class="tab ${st.vista === n[0] ? 'active' : ''}" data-v="${n[0]}">${n[1]}</button>`).join('');
  $('tabs').querySelectorAll('button').forEach(b => b.onclick = run(() => ir(b.dataset.v)));
}
async function ir(v, arg) {
  st.vista = v; renderNav(); $('notice').innerHTML = '';
  document.querySelectorAll('.view').forEach(x => x.classList.add('hidden'));
  const sec = $('view-' + (v === 'mifile' ? 'file' : v)); sec.classList.remove('hidden');
  if (v === 'panel') await vPanel();
  else if (v === 'personal') await vPersonal();
  else if (v === 'mifile') await abrirFile(st.b.usuario.userId, true);
  else if (v === 'file') await abrirFile(arg);
  else if (v === 'requisitos') vRequisitos();
  else if (v === 'usuarios') await vUsuarios();
  else if (v === 'roles') await vRoles();
  else if (v === 'auditoria') await vAuditoria();
}

/* ---------- panel ---------- */
async function vPanel() {
  const [b, v] = await Promise.all([api('bootstrap'), api('vencimientos', { dias: st.b.diasAviso })]); st.b = b; const r = b.resumen || {};
  $('view-panel').innerHTML = `<h2>Panel de vencimientos</h2><p class="muted">Situación del personal activo al ${fecha(b.hoy)}.</p>
  <div class="grid3"><div class="stat">Personas<b>${r.personas ?? 0}</b></div><div class="stat">Files completos<b>${r.completos ?? 0}</b></div><div class="stat">Files incompletos<b>${r.incompletos ?? 0}</b></div>
  <div class="stat">Documentos vencidos<b>${r.vencidos ?? 0}</b></div><div class="stat">Por vencer (${b.diasAviso} días)<b>${r.porVencer ?? 0}</b></div><div class="stat">Requisitos faltantes<b>${r.faltantes ?? 0}</b></div></div>
  <h3>Vencidos y por vencer</h3>${v.vencimientos.length ? `<div class="tablewrap"><table><thead><tr><th>Persona</th><th>Documento</th><th>Vence</th><th>Situación</th></tr></thead><tbody>${v.vencimientos.map(x => `<tr><td><button class="lnk" data-p="${esc(x.personaId)}">${esc(x.persona)}</button></td><td>${esc(x.nombre)}</td><td>${fecha(x.vence)}</td><td>${pill(x.situacion)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin vencimientos próximos.</p>'}
  <h3>Requisitos obligatorios faltantes</h3>${v.faltantes.length ? `<div class="tablewrap"><table><thead><tr><th>Persona</th><th>Requisito</th></tr></thead><tbody>${v.faltantes.map(x => `<tr><td><button class="lnk" data-p="${esc(x.personaId)}">${esc(x.persona)}</button></td><td>${esc(x.requisito)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No hay requisitos obligatorios pendientes.</p>'}`;
  enlazar($('view-panel'));
}
function enlazar(el) { el.querySelectorAll('[data-p]').forEach(b => b.onclick = run(() => can('files.ver') ? ir('file', b.dataset.p) : null)); }

/* ---------- personal ---------- */
async function vPersonal() {
  const f = st.filtro, r = await api('listarPersonas', f); st.personas = r.personas; st.unidades = r.unidades;
  $('view-personal').innerHTML = `<div class="row"><h2>Personal</h2></div>
  <div class="grid3"><div class="field"><label for="fTxt">Buscar</label><input id="fTxt" placeholder="Nombre, documento o cargo" value="${esc(f.texto)}"></div>
  <div class="field"><label for="fEst">Estado laboral</label><select id="fEst"><option value="">Todos</option>${['activo', 'suspendido', 'baja'].map(e => `<option ${f.estado === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
  <div class="field"><label for="fUni">Unidad</label><select id="fUni"><option value="">Todas</option>${st.unidades.map(u => `<option ${f.unidad === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div></div>
  <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Cargo</th><th>Unidad</th><th>Estado</th><th>Completitud</th><th>Alertas</th></tr></thead><tbody>
  ${r.personas.map(p => `<tr><td><button class="lnk" data-p="${esc(p.userId)}">${esc(p.nombre)}</button><div class="muted">${esc(p.documento)}</div></td><td>${esc(p.cargo || '—')}</td><td>${esc(p.unidad || '—')}</td><td>${esc(p.estadoLaboral)}</td>
  <td>${barra(p.comp.pct)}<span class="muted">${p.comp.cumplidos}/${p.comp.obligatorios}</span></td><td>${p.comp.vencidos ? pill('Vencido') + ' ' : ''}${p.comp.porVencer ? pill('Por vencer') + ' ' : ''}${p.comp.faltan ? `<span class="pill off">${p.comp.faltan} faltan</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Sin resultados.</td></tr>'}</tbody></table></div>
  <p class="muted">Las personas se registran en la Suite (Personal y usuarios) y deben tener habilitado este módulo para contar con file.</p>`;
  enlazar($('view-personal'));
  const aplicar = run(async () => { st.filtro = { texto: $('fTxt').value, estado: $('fEst').value, unidad: $('fUni').value }; await vPersonal(); $('fTxt').focus(); $('fTxt').setSelectionRange(1e4, 1e4); });
  $('fTxt').onchange = aplicar; $('fEst').onchange = aplicar; $('fUni').onchange = aplicar;
}

/* ---------- file de una persona ---------- */
async function abrirFile(id, propio) {
  const r = await api('obtenerFile', { personaId: id }); st.file = r; if (propio) st.vista = 'mifile'; else st.vista = 'file'; renderNav();
  document.querySelectorAll('.view').forEach(x => x.classList.add('hidden')); $('view-file').classList.remove('hidden');
  const p = r.persona, editar = r.puedeEditar && !(propio && !can('files.editar'));
  $('view-file').innerHTML = `<div class="row"><h2>${esc(p.nombre)}</h2>${can('files.panel') && !propio ? '<button class="btn secondary" id="bVolver">Volver al listado</button>' : ''}</div>
  <p class="muted">${esc(p.cargo || 'Sin cargo')} · ${esc(p.unidad || 'Sin unidad')} · CI ${esc(p.documento || '—')} · Ingreso ${fecha(p.fechaIngreso)} · Estado: ${esc(p.estadoLaboral)}</p>
  <div class="grid3"><div class="stat">Completitud<b>${p.comp.pct}%</b></div><div class="stat">Vencidos<b>${p.comp.vencidos}</b></div><div class="stat">Faltan<b>${p.comp.faltan}</b></div></div>
  ${propio ? '<div class="msg">Este es su file. Usted puede consultarlo y descargar sus documentos; los cambios los registra Recursos Humanos.</div>' : ''}
  <h3>Requisitos</h3><div class="tablewrap"><table><thead><tr><th>Requisito</th><th>Obligatorio</th><th>Situación</th><th>Vence</th><th></th></tr></thead><tbody>
  ${r.checklist.map(x => `<tr><td>${esc(x.nombre)}</td><td>${x.obligatorio ? 'Sí' : 'No'}</td><td>${pill(x.estado)}</td><td>${fecha(x.vence)}</td><td>${editar ? `<button class="btn secondary" data-sub="${esc(x.reqId)}">${x.docId ? 'Reemplazar' : 'Subir'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No hay requisitos que apliquen.</td></tr>'}</tbody></table></div>
  <div class="row"><h3>Documentos</h3>${editar ? '<button class="btn" id="bSubir">Subir documento</button>' : ''}</div>
  <div class="tablewrap"><table><thead><tr><th>Documento</th><th>Fecha</th><th>Vence</th><th>Situación</th><th></th></tr></thead><tbody>
  ${r.documentos.map(d => `<tr><td>${esc(d.nombre)}<div class="muted">${esc(d.reqNombre || 'Sin requisito')} · ${esc(d.archivo)}${d.motivoAnulacion ? ' · Motivo: ' + esc(d.motivoAnulacion) : ''}</div></td><td>${fecha(d.fecha)}</td><td>${fecha(d.vence)}</td><td>${pill(d.situacion)}</td>
  <td>${r.puedeDescargar && d.estado !== 'Anulado' ? `<button class="btn secondary" data-dl="${esc(d.docId)}">Descargar</button> ` : ''}${editar && d.estado === 'Vigente' ? `<button class="btn secondary" data-an="${esc(d.docId)}">Anular</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Aún no hay documentos.</td></tr>'}</tbody></table></div>
  <div class="row"><h3>Historial laboral</h3>${editar ? '<button class="btn secondary" id="bHist">Agregar registro</button>' : ''}</div>
  <div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Registró</th></tr></thead><tbody>
  ${r.historial.map(h => `<tr><td>${fecha(h.fecha)}</td><td>${esc(h.tipo)}</td><td>${esc(h.detalle)}${h.referencia ? `<div class="muted">Ref.: ${esc(h.referencia)}</div>` : ''}</td><td>${esc(h.creadoPor)}${String(h.auto) === 'true' ? ' <span class="pill">automático</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin registros.</td></tr>'}</tbody></table></div>
  <div class="row"><h3>File físico</h3>${can('files.fisico') ? '<button class="btn secondary" id="bFis">Registrar ubicación</button>' : ''}</div>
  <p id="fisico">${p.tomoFisico ? `Tomo <b>${esc(p.tomoFisico)}</b>${p.foliosFisico ? ' · ' + esc(p.foliosFisico) + ' folios' : ''}${p.ubicacionFisica ? ' · ' + esc(p.ubicacionFisica) : ''}` : '<span class="muted">Sin file físico registrado.</span>'}</p>
  ${st.b.vacacionesActivo ? '<div class="row"><h3>Vacaciones</h3><button class="btn secondary" id="bVac">Ver solicitudes</button></div><div id="vacBox" class="muted"></div>' : ''}`;
  const v = $('view-file');
  if ($('bVolver')) $('bVolver').onclick = run(() => ir('personal'));
  v.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => modalSubir(b.dataset.sub));
  if ($('bSubir')) $('bSubir').onclick = () => modalSubir('');
  v.querySelectorAll('[data-dl]').forEach(b => b.onclick = run(() => descargar(b.dataset.dl)));
  v.querySelectorAll('[data-an]').forEach(b => b.onclick = () => modalAnular(b.dataset.an));
  if ($('bHist')) $('bHist').onclick = modalHist;
  if ($('bFis')) $('bFis').onclick = run(modalFisico);
  if ($('bVac')) $('bVac').onclick = run(() => vacaciones(p.userId));
}

/* ---------- ventanas ---------- */
function modal(html, alGuardar) {
  $('modal').innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div>${html}<div class="row" style="margin-top:12px"><button class="btn secondary" id="mNo">Cancelar</button><button class="btn" id="mOk">Guardar</button></div><div id="mErr"></div></div></div>`;
  const cerrar = () => { $('modal').innerHTML = ''; };
  $('mNo').onclick = cerrar;
  $('mOk').onclick = async () => { $('mErr').innerHTML = ''; try { await alGuardar(); cerrar(); } catch (e) { $('mErr').innerHTML = `<div class="msg error">${esc(e.message)}</div>`; } };
}
function leerArchivo(inp) {
  return new Promise((ok, no) => { const f = inp.files[0]; if (!f) return no(Error('Seleccione el archivo.')); if (f.size > 10 * 1048576) return no(Error('El archivo supera 10 MB.'));
    const r = new FileReader(); r.onload = () => ok({ base64: String(r.result).split(',')[1] || '', nombre: f.name }); r.onerror = () => no(Error('No se pudo leer el archivo.')); r.readAsDataURL(f); });
}
function modalSubir(reqId) {
  const f = st.file, reqs = f.checklist;
  modal(`<h3>Subir documento</h3><div class="grid"><div class="field"><label for="uReq">Requisito</label><select id="uReq"><option value="">Otro documento (sin requisito)</option>${reqs.map(r => `<option value="${esc(r.reqId)}" ${r.reqId === reqId ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select></div>
  <div class="field"><label for="uNom">Nombre del documento</label><input id="uNom" maxlength="160"></div>
  <div class="field"><label for="uFec">Fecha del documento</label><input id="uFec" type="date" value="${esc(st.b.hoy)}"></div>
  <div class="field"><label for="uVen">Vence (opcional)</label><input id="uVen" type="date"></div></div>
  <div class="field"><label for="uArc">Archivo (PDF, PNG o JPEG, máx. 10 MB)</label><input id="uArc" type="file" accept="application/pdf,image/png,image/jpeg"></div>
  <div class="field"><label for="uObs">Observaciones</label><textarea id="uObs" maxlength="1000"></textarea></div>
  <p class="muted">Si el requisito tiene vigencia, el vencimiento se calcula solo cuando lo deja vacío.</p>`, async () => {
    const a = await leerArchivo($('uArc'));
    await api('subirDocumento', { personaId: f.persona.userId, reqId: $('uReq').value, nombre: $('uNom').value, fecha: $('uFec').value, vence: $('uVen').value, obs: $('uObs').value, base64: a.base64, archivo: a.nombre });
    msg('Documento guardado.'); await abrirFile(f.persona.userId, st.vista === 'mifile');
  });
}
function modalAnular(docId) {
  modal(`<h3>Anular documento</h3><p class="muted">El archivo no se borra de Drive; el documento queda marcado como anulado.</p><div class="field"><label for="aMot">Motivo</label><textarea id="aMot" maxlength="300"></textarea></div>`, async () => {
    await api('anularDocumento', { docId, motivo: $('aMot').value }); msg('Documento anulado.'); await abrirFile(st.file.persona.userId);
  });
}
function modalHist() {
  modal(`<h3>Registro en el historial laboral</h3><div class="grid"><div class="field"><label for="hTipo">Tipo</label><select id="hTipo">${st.b.tiposHistorial.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
  <div class="field"><label for="hFec">Fecha</label><input id="hFec" type="date" value="${esc(st.b.hoy)}"></div></div>
  <div class="field"><label for="hDet">Detalle</label><textarea id="hDet" maxlength="1000"></textarea></div><div class="field"><label for="hRef">Referencia (memorándum, resolución…)</label><input id="hRef" maxlength="160"></div>`, async () => {
    await api('agregarHistorial', { personaId: st.file.persona.userId, tipo: $('hTipo').value, fecha: $('hFec').value, detalle: $('hDet').value, referencia: $('hRef').value });
    msg('Registro agregado.'); await abrirFile(st.file.persona.userId);
  });
}
async function modalFisico() {
  const p = st.file.persona; let tomos = [];
  if (st.b.archivoActivo) { try { const r = await JDI.apiModulo('archivo', { action: 'tomosListar', payload: { tamano: 200 } }); if (r && r.ok) tomos = (r.filas || r.data?.filas || []).map(t => t.Codigo_Tomo).filter(Boolean); } catch (e) { /* sin acceso a Archivo: se escribe a mano */ } }
  const campoTomo = tomos.length ? `<select id="fTomo"><option value="">Sin tomo</option>${tomos.map(t => `<option ${t === p.tomoFisico ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : `<input id="fTomo" value="${esc(p.tomoFisico)}" maxlength="60">`;
  modal(`<h3>File físico de ${esc(p.nombre)}</h3><div class="grid"><div class="field"><label for="fTomo">Tomo de Archivo</label>${campoTomo}</div><div class="field"><label for="fFol">Folios</label><input id="fFol" type="number" min="0" value="${esc(p.foliosFisico)}"></div></div>
  <div class="field"><label for="fUbi">Ubicación (depósito, estante)</label><input id="fUbi" maxlength="200" value="${esc(p.ubicacionFisica)}"></div>
  <p class="muted">${st.b.identificadoresActivo ? 'Para imprimir carátula, pestaña o lomo del tomo use el módulo Identificadores (Rótulos).' : 'Con Archivo e Identificadores habilitados puede elegir el tomo y rotularlo.'}</p>`, async () => {
    await api('guardarFisico', { personaId: p.userId, tomoFisico: $('fTomo').value, foliosFisico: $('fFol').value, ubicacionFisica: $('fUbi').value });
    msg('File físico actualizado.'); await abrirFile(p.userId, st.vista === 'mifile');
  });
}
async function descargar(docId) {
  const r = await api('descargarDocumento', { docId }); const bin = atob(r.base64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u], { type: r.mime })), a = document.createElement('a'); a.href = url; a.download = r.nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function vacaciones(id) {
  const box = $('vacBox'); box.textContent = 'Consultando Vacaciones…';
  try {
    const r = await JDI.apiModulo('vacaciones', { action: 'inicial' }); const d = r && (r.data || r);
    const sol = ((d && d.solicitudes) || []).filter(s => String(s.persona_id) === String(id));
    box.innerHTML = sol.length ? `<div class="tablewrap"><table><thead><tr><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th></tr></thead><tbody>${sol.map(s => `<tr><td>${fecha(s.desde || s.inicio)}</td><td>${fecha(s.hasta || s.fin)}</td><td>${esc(s.dias ?? '')}</td><td>${esc(s.estado || '')}</td></tr>`).join('')}</tbody></table></div>` : 'Sin solicitudes registradas (o sin permiso para verlas en Vacaciones).';
  } catch (e) { box.textContent = 'No se pudo consultar Vacaciones: ' + e.message; }
}

/* ---------- requisitos ---------- */
function vRequisitos() {
  const rs = st.b.requisitos;
  $('view-requisitos').innerHTML = `<div class="row"><h2>Requisitos del file</h2><button class="btn" id="bNR">Nuevo requisito</button></div>
  <p class="muted">Cada requisito aplica a todo el personal, a un tipo de persona, a un cargo o a una unidad. «Vigencia» en meses: 0 = no vence.</p>
  <div class="tablewrap"><table><thead><tr><th>Requisito</th><th>Aplica a</th><th>Obligatorio</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>
  ${rs.map(r => `<tr><td>${esc(r.nombre)}${r.tipoDoc ? `<div class="muted">Tipo: ${esc(r.tipoDoc)}</div>` : ''}</td><td>${esc(ALCANCE(r.aplicaA))}</td><td>${r.obligatorio ? 'Sí' : 'No'}</td><td>${r.vigenciaMeses ? r.vigenciaMeses + ' meses' : '—'}</td><td>${r.active ? pill('Vigente').replace('Vigente', 'Activo') : '<span class="pill off">Inactivo</span>'}</td><td><button class="btn secondary" data-e="${esc(r.reqId)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
  $('bNR').onclick = () => modalReq(null);
  $('view-requisitos').querySelectorAll('[data-e]').forEach(b => b.onclick = () => modalReq(rs.find(r => r.reqId === b.dataset.e)));
}
function modalReq(r) {
  const al = r ? r.aplicaA : 'todos', base = ['todos', 'empleado', 'pasante', 'socio', 'externo'].includes(al) ? al : al.split(':')[0], det = al.includes(':') ? al.split(':').slice(1).join(':') : '';
  modal(`<h3>${r ? 'Editar' : 'Nuevo'} requisito</h3><div class="field"><label for="qN">Nombre</label><input id="qN" maxlength="160" value="${esc(r ? r.nombre : '')}"></div>
  <div class="grid"><div class="field"><label for="qA">Aplica a</label><select id="qA">${[['todos', 'Todo el personal'], ['empleado', 'Empleados'], ['pasante', 'Pasantes'], ['socio', 'Socios'], ['externo', 'Externos'], ['cargo', 'Un cargo'], ['unidad', 'Una unidad']].map(o => `<option value="${o[0]}" ${o[0] === base ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
  <div class="field"><label for="qD">Cargo o unidad (si corresponde)</label><input id="qD" maxlength="120" value="${esc(det)}"></div>
  <div class="field"><label for="qV">Vigencia (meses)</label><input id="qV" type="number" min="0" max="240" value="${r ? r.vigenciaMeses : 0}"></div>
  <div class="field"><label for="qO">¿Obligatorio?</label><select id="qO"><option value="true" ${!r || r.obligatorio ? 'selected' : ''}>Sí</option><option value="false" ${r && !r.obligatorio ? 'selected' : ''}>No</option></select></div>
  <div class="field"><label for="qT">Tipo documental global (opcional)</label><select id="qT"><option value="">—</option>${st.b.tipos.map(t => `<option ${r && r.tipoDoc === t.nombre ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></div>
  <div class="field"><label for="qE">Estado</label><select id="qE"><option value="true" ${!r || r.active ? 'selected' : ''}>Activo</option><option value="false" ${r && !r.active ? 'selected' : ''}>Inactivo</option></select></div></div>`, async () => {
    const b = $('qA').value, aplicaA = (b === 'cargo' || b === 'unidad') ? b + ':' + $('qD').value.trim() : b;
    await api('guardarRequisito', { reqId: r ? r.reqId : '', nombre: $('qN').value, aplicaA, vigenciaMeses: Number($('qV').value || 0), obligatorio: $('qO').value === 'true', tipoDoc: $('qT').value, active: $('qE').value === 'true' });
    st.b = await api('bootstrap'); msg('Requisito guardado.'); vRequisitos();
  });
}

/* ---------- usuarios, roles, auditoría ---------- */
async function vUsuarios() {
  const [us, rs] = await Promise.all([api('listarUsuarios'), api('listarRoles')]); st.roles = rs;
  $('view-usuarios').innerHTML = `<h2>Usuarios del módulo</h2><p class="muted">Las personas se crean en la Suite. Aquí se asigna el rol dentro de Files de personal.</p>
  <div class="tablewrap"><table><thead><tr><th>Persona</th><th>Cargo</th><th>Rol</th><th></th></tr></thead><tbody>${us.map(u => `<tr><td>${esc(u.nombre)}<div class="muted">${esc(u.username)}</div></td><td>${esc(u.cargo || '—')}</td>
  <td><select data-u="${esc(u.userId)}" ${u.isPrimaryAdmin ? 'disabled' : ''}>${rs.filter(r => r.active).map(r => `<option value="${esc(r.roleId)}" ${r.roleId === u.roleId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td><td>${u.isPrimaryAdmin ? '<span class="pill">Administrador del cliente</span>' : ''}</td></tr>`).join('')}</tbody></table></div>`;
  $('view-usuarios').querySelectorAll('[data-u]').forEach(s => s.onchange = run(async () => { await api('guardarUsuario', { userId: s.dataset.u, roleId: s.value }); msg('Rol actualizado.'); }));
}
async function vRoles() {
  const rs = await api('listarRoles'); st.roles = rs;
  $('view-roles').innerHTML = `<div class="row"><h2>Roles y permisos</h2><button class="btn" id="bNRol">Nuevo rol</button></div><div class="tablewrap"><table><thead><tr><th>Rol</th><th>Permisos</th><th></th></tr></thead><tbody>
  ${rs.map(r => `<tr><td>${esc(r.name)}${r.isSystem ? ' <span class="pill">sistema</span>' : ''}</td><td class="muted">${r.permissions.map(p => esc(st.b.permCatalog[p] || p)).join(' · ')}</td><td>${r.roleId === 'ROLE_ADMIN' ? '' : `<button class="btn secondary" data-r="${esc(r.roleId)}">Editar</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  $('bNRol').onclick = () => modalRol(null);
  $('view-roles').querySelectorAll('[data-r]').forEach(b => b.onclick = () => modalRol(rs.find(r => r.roleId === b.dataset.r)));
}
function modalRol(r) {
  modal(`<h3>${r ? 'Editar' : 'Nuevo'} rol</h3><div class="field"><label for="rN">Nombre</label><input id="rN" maxlength="80" value="${esc(r ? r.name : '')}"></div>
  ${Object.keys(st.b.permCatalog).map(p => `<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" style="width:auto;min-height:0" data-pm="${esc(p)}" ${r && r.permissions.includes(p) ? 'checked' : ''}>${esc(st.b.permCatalog[p])}</label>`).join('')}`, async () => {
    const permissions = [...document.querySelectorAll('[data-pm]')].filter(c => c.checked).map(c => c.dataset.pm);
    await api('guardarRol', { roleId: r ? r.roleId : '', name: $('rN').value, permissions }); msg('Rol guardado.'); await vRoles();
  });
}
async function vAuditoria() {
  const a = await api('auditoria');
  $('view-auditoria').innerHTML = `<h2>Auditoría</h2><div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${a.map(x => `<tr><td>${esc(String(x.timestamp).replace('T', ' '))}</td><td>${esc(x.username)}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin registros.</td></tr>'}</tbody></table></div>`;
}

/* ---------- arranque ---------- */
JDI.ready.then(async () => {
  document.title = 'JeaDas.Insights - Files de personal';
  try {
    st.b = await api('bootstrap');
    $('institutionLabel').textContent = st.b.institucion || ''; $('welcome').textContent = 'Usuario: ' + st.b.usuario.nombre;
    $('sessionInfo').textContent = st.b.usuario.nombre + (st.b.usuario.isAdmin ? ' · Administrador' : '');
    const primera = NAV.find(n => can(n[2])); if (!primera) { msg('No tiene permisos en este módulo.', true); return; }
    await ir(primera[0]);
  } catch (e) { msg(e.message, true); }
});
