// ============================================
// CONTROL DE HORAS - lógica de la app
// Todo se guarda en el celular/PC con localStorage,
// no necesita internet ni servidor (excepto para exportar a PDF).
// ============================================

// ============================================
// LOGIN - varios usuarios en el mismo celular
// Cada usuario tiene su propio usuario+clave y sus
// propios turnos guardados, separados de los demás.
// No hay servidor: el usuario/clave se valida contra
// lo guardado en este mismo celular (localStorage).
// ============================================

const USUARIOS_KEY = "ch_usuarios";      // lista de usuarios registrados en este celular
const SESION_KEY = "ch_usuario_actual";  // quién inició sesión ahora (dura mientras la app esté abierta)

function cargarUsuarios() {
  const data = localStorage.getItem(USUARIOS_KEY);
  return data ? JSON.parse(data) : {};
}

function guardarUsuarios(usuarios) {
  localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuarios));
}

function obtenerUsuarioActual() {
  return sessionStorage.getItem(SESION_KEY);
}

function iniciarSesionComo(usuario) {
  sessionStorage.setItem(SESION_KEY, usuario);
}

function cerrarSesionUsuario() {
  sessionStorage.removeItem(SESION_KEY);
}

// Cada usuario guarda sus turnos en su propia "carpeta" de localStorage
function claveAlmacenamientoTurnos() {
  return "turnos_guardia_" + obtenerUsuarioActual();
}

function cargarTurnos() {
  const data = localStorage.getItem(claveAlmacenamientoTurnos());
  return data ? JSON.parse(data) : [];
}

function guardarTurnos(turnos) {
  localStorage.setItem(claveAlmacenamientoTurnos(), JSON.stringify(turnos));
}

// ---------- Elementos de la pantalla de login ----------

const elPantallaLogin = document.getElementById("pantallaLogin");
const elContenidoApp = document.getElementById("contenidoApp");
const elLoginTitulo = document.getElementById("loginTitulo");
const elLoginUsuario = document.getElementById("loginUsuario");
const elLoginClave = document.getElementById("loginClave");
const elLoginConfirmarContenedor = document.getElementById("loginConfirmarContenedor");
const elLoginConfirmarClave = document.getElementById("loginConfirmarClave");
const elLoginError = document.getElementById("loginError");
const elBtnLogin = document.getElementById("btnLogin");
const elLinkAlternarModo = document.getElementById("linkAlternarModo");
const elSaludoUsuario = document.getElementById("saludoUsuario");
const elBtnCerrarSesion = document.getElementById("btnCerrarSesion");

let modoRegistro = false;

function mostrarErrorLogin(msg) {
  elLoginError.style.display = "block";
  elLoginError.textContent = msg;
}

function ocultarErrorLogin() {
  elLoginError.style.display = "none";
}

function actualizarVistaLogin() {
  ocultarErrorLogin();
  elLoginClave.value = "";
  elLoginConfirmarClave.value = "";
  if (modoRegistro) {
    elLoginTitulo.textContent = "Crear cuenta";
    elLoginConfirmarContenedor.classList.remove("oculta");
    elBtnLogin.textContent = "Crear cuenta";
    elLinkAlternarModo.textContent = "¿Ya tenés cuenta? Iniciar sesión";
  } else {
    elLoginTitulo.textContent = "Iniciar sesión";
    elLoginConfirmarContenedor.classList.add("oculta");
    elBtnLogin.textContent = "Ingresar";
    elLinkAlternarModo.textContent = "¿No tenés cuenta? Creá una nueva";
  }
}

elLinkAlternarModo.addEventListener("click", () => {
  modoRegistro = !modoRegistro;
  actualizarVistaLogin();
});

elBtnLogin.addEventListener("click", () => {
  const usuario = elLoginUsuario.value.trim().toLowerCase();
  const clave = elLoginClave.value;
  const usuarios = cargarUsuarios();

  if (!usuario || !clave) {
    mostrarErrorLogin("Completá usuario y clave.");
    return;
  }

  if (modoRegistro) {
    const confirmar = elLoginConfirmarClave.value;
    if (usuarios[usuario]) {
      mostrarErrorLogin("Ese usuario ya existe en este celular. Elegí otro nombre o iniciá sesión.");
      return;
    }
    if (clave.length < 4) {
      mostrarErrorLogin("La clave tiene que tener al menos 4 caracteres.");
      return;
    }
    if (clave !== confirmar) {
      mostrarErrorLogin("Las claves no coinciden.");
      return;
    }
    usuarios[usuario] = clave;
    guardarUsuarios(usuarios);
    iniciarSesionComo(usuario);
    mostrarApp();
  } else {
    if (!usuarios[usuario] || usuarios[usuario] !== clave) {
      mostrarErrorLogin("Usuario o clave incorrectos.");
      return;
    }
    iniciarSesionComo(usuario);
    mostrarApp();
  }
});

elBtnCerrarSesion.addEventListener("click", () => {
  cerrarSesionUsuario();
  mostrarLogin();
});

function mostrarApp() {
  const usuario = obtenerUsuarioActual();
  elPantallaLogin.classList.add("oculta");
  elContenidoApp.classList.remove("oculta");
  elSaludoUsuario.textContent = "Hola, " + usuario;
  actualizarResumen();
  renderizarHistorial();
}

function mostrarLogin() {
  elPantallaLogin.classList.remove("oculta");
  elContenidoApp.classList.add("oculta");
  elLoginUsuario.value = "";
  modoRegistro = false;
  actualizarVistaLogin();
}

// ---------- Cálculo de horas ----------

function calcularHoras(fecha, horaEntrada, horaSalida) {
  let inicio = new Date(`${fecha}T${horaEntrada}`);
  let fin = new Date(`${fecha}T${horaSalida}`);
  if (fin <= inicio) {
    fin.setDate(fin.getDate() + 1);
  }
  const totalHoras = (fin - inicio) / 3600000;
  const horasNocturnas = calcularHorasNocturnas(inicio, fin);
  return { totalHoras, horasNocturnas, inicio, fin };
}

function calcularHorasNocturnas(inicio, fin) {
  let total = 0;
  let dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - 1);
  const ultimoDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());

  while (dia <= ultimoDia) {
    const nocheInicio = new Date(dia);
    nocheInicio.setHours(22, 0, 0, 0);
    const nocheFin = new Date(dia);
    nocheFin.setDate(nocheFin.getDate() + 1);
    nocheFin.setHours(6, 0, 0, 0);

    const segInicio = inicio > nocheInicio ? inicio : nocheInicio;
    const segFin = fin < nocheFin ? fin : nocheFin;

    if (segFin > segInicio) {
      total += (segFin - segInicio) / 3600000;
    }
    dia.setDate(dia.getDate() + 1);
  }
  return total;
}

function claveSemana(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const diaSemana = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diaSemana);
  return d.toISOString().slice(0, 10);
}

function claveMes(fechaStr) {
  return fechaStr.slice(0, 7);
}

function calcularResumen(turnos, fechaReferencia) {
  const semanaRef = claveSemana(fechaReferencia);
  const mesRef = claveMes(fechaReferencia);

  let horasSemana = 0;
  let horasMes = 0;
  let francosMes = 0;
  let horasNocturnasMes = 0;
  turnos.forEach(t => {
    if (claveSemana(t.fecha) === semanaRef && !t.franco) {
      horasSemana += t.totalHoras;
    }
    if (claveMes(t.fecha) === mesRef) {
      if (t.franco) francosMes++;
      else horasMes += t.totalHoras;
       horasNocturnasMes += t.horasNocturnas;
    }
    }
  });

  const extraSemana = Math.max(0, horasSemana - 48);

 return { horasSemana, extraSemana, horasMes, francosMes, horasNocturnasMes };
}

function redondear(n) {
  return Math.round(n * 10) / 10;
}

// ============================================
// PANTALLA: NUEVO TURNO
// ============================================

const elFecha = document.getElementById("fecha");
const elHoraEntrada = document.getElementById("horaEntrada");
const elHoraSalida = document.getElementById("horaSalida");
const elResultado = document.getElementById("resultado");
const elTotalTurno = document.getElementById("totalTurno");
const elHorasNocturnas = document.getElementById("horasNocturnas");
const elHorasExtraTurno = document.getElementById("horasExtraTurno");
const elAvisoExtra = document.getElementById("avisoExtra");
const elPasoAlgo = document.getElementById("pasoAlgo");
const elNota = document.getElementById("nota");

elFecha.value = new Date().toISOString().slice(0, 10);

function actualizarVistaPrevia() {
  const fecha = elFecha.value;
  const entrada = elHoraEntrada.value;
  const salida = elHoraSalida.value;
  if (!fecha || !entrada || !salida) return;

  const { totalHoras, horasNocturnas } = calcularHoras(fecha, entrada, salida);

  elResultado.style.display = "block";
  elTotalTurno.textContent = redondear(totalHoras) + " hs";
  elHorasNocturnas.textContent = redondear(horasNocturnas) + " hs";

  const turnos = cargarTurnos();
  const resumen = calcularResumen(turnos, fecha);
  const semanaConEsteTurno = resumen.horasSemana + totalHoras;
  const extra = Math.max(0, semanaConEsteTurno - 48);
  elHorasExtraTurno.textContent = redondear(extra) + " hs";

  if (extra > 0) {
    elAvisoExtra.style.display = "block";
    elAvisoExtra.textContent =
      "Con este turno superás las 48 hs semanales: " +
      redondear(extra) + " hs extra";
  } else {
    elAvisoExtra.style.display = "none";
  }
}

[elFecha, elHoraEntrada, elHoraSalida].forEach(el =>
  el.addEventListener("change", actualizarVistaPrevia)
);

elPasoAlgo.addEventListener("change", () => {
  elNota.style.display = elPasoAlgo.checked ? "block" : "none";
});

document.getElementById("btnGuardarTurno").addEventListener("click", () => {
  const lugar = document.getElementById("lugar").value.trim();
  const fecha = elFecha.value;
  const entrada = elHoraEntrada.value;
  const salida = elHoraSalida.value;

  if (!lugar || !fecha || !entrada || !salida) {
    alert("Completá lugar, fecha, hora de entrada y hora de salida.");
    return;
  }
  if (elPasoAlgo.checked && !elNota.value.trim()) {
    alert("Marcaste que pasó algo: contá qué pasó en la nota.");
    return;
  }

  const { totalHoras, horasNocturnas } = calcularHoras(fecha, entrada, salida);

  const turnos = cargarTurnos();
  turnos.push({
    id: Date.now(),
    lugar,
    fecha,
    entrada,
    salida,
    totalHoras: redondear(totalHoras),
    horasNocturnas: redondear(horasNocturnas),
    pasoAlgo: elPasoAlgo.checked,
    nota: elPasoAlgo.checked ? elNota.value.trim() : "",
    franco: false
  });
  guardarTurnos(turnos);

  document.getElementById("lugar").value = "";
  elPasoAlgo.checked = false;
  elNota.value = "";
  elNota.style.display = "none";

  actualizarResumen();
  alert("Turno guardado.");
});

document.getElementById("btnGuardarFranco").addEventListener("click", () => {
  const fecha = elFecha.value;
  if (!fecha) return;
  const turnos = cargarTurnos();
  turnos.push({
    id: Date.now(),
    lugar: "",
    fecha,
    entrada: "",
    salida: "",
    totalHoras: 0,
    horasNocturnas: 0,
    pasoAlgo: false,
    nota: "",
    franco: true
  });
  guardarTurnos(turnos);
  actualizarResumen();
  alert("Franco registrado para el " + fecha);
});

function actualizarResumen() {
  const turnos = cargarTurnos();
  const resumen = calcularResumen(turnos, elFecha.value || new Date().toISOString().slice(0, 10));
  document.getElementById("resHorasSemana").textContent = redondear(resumen.horasSemana);
  document.getElementById("resExtraSemana").textContent = redondear(resumen.extraSemana);
  document.getElementById("resHorasMes").textContent = redondear(resumen.horasMes);
  document.getElementById("resFrancosMes").textContent = resumen.francosMes;

  const pct = Math.min(100, (resumen.horasSemana / 48) * 100);
  document.getElementById("barraSemana").style.width = pct + "%";
}

// ============================================
// PANTALLA: HISTORIAL
// ============================================

const elListaHistorial = document.getElementById("listaHistorial");
const elDetalleTurno = document.getElementById("detalleTurno");
const elFiltroDesde = document.getElementById("filtroDesde");
const elFiltroHasta = document.getElementById("filtroHasta");
const elFiltroLugar = document.getElementById("filtroLugar");

function obtenerTurnosFiltrados() {
  const turnos = cargarTurnos()
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const desde = elFiltroDesde.value;
  const hasta = elFiltroHasta.value;
  const lugarFiltro = elFiltroLugar.value.trim().toLowerCase();

  return turnos.filter(t => {
    if (desde && t.fecha < desde) return false;
    if (hasta && t.fecha > hasta) return false;
    if (lugarFiltro && !t.lugar.toLowerCase().includes(lugarFiltro)) return false;
    return true;
  });
}

function renderizarHistorial() {
  const filtrados = obtenerTurnosFiltrados();

  elListaHistorial.innerHTML = "";
  elDetalleTurno.style.display = "none";

  if (filtrados.length === 0) {
    elListaHistorial.innerHTML = "<p style='color:#8B96AA;font-size:13px'>No hay turnos en este rango.</p>";
    return;
  }

  filtrados.forEach(t => {
    const item = document.createElement("div");
    item.className = "item-turno" + (t.pasoAlgo ? " con-aviso" : "");

    if (t.franco) {
      item.innerHTML = `
        <div class="info">
          <p class="titulo">${t.fecha} · Franco</p>
        </div>
        <div class="item-derecha">
          <span class="chevron">›</span>
        </div>`;
    } else {
      item.innerHTML = `
        <div class="info">
          <p class="titulo">${t.fecha} · ${t.lugar}</p>
          <p class="sub">${t.entrada} a ${t.salida} · ${t.horasNocturnas} hs nocturnas</p>
        </div>
        <div class="item-derecha">
          <span class="badge-horas">${t.totalHoras} hs</span>
          <span class="chevron">›</span>
        </div>`;
    }

    item.addEventListener("click", () => mostrarDetalle(t));
    elListaHistorial.appendChild(item);
  });
}

function mostrarDetalle(t) {
  elDetalleTurno.style.display = "block";

  if (t.franco) {
    elDetalleTurno.innerHTML = `
      <p><strong>${t.fecha}</strong> · Franco</p>
      <div class="acciones-detalle">
        <button class="btn-eliminar" id="btnEliminarTurno">Eliminar</button>
      </div>`;
  } else {
    let html = `
      <p><strong>${t.fecha} · ${t.lugar}</strong></p>
      <p style="font-size:13px;color:#8B96AA">${t.entrada} a ${t.salida} · ${t.totalHoras} hs totales · ${t.horasNocturnas} hs nocturnas</p>
    `;
    if (t.pasoAlgo && t.nota) {
      html += `<div class="nota">${t.nota}</div>`;
    } else {
      html += `<p style="font-size:13px;color:#8B96AA">Sin novedades anotadas en este turno.</p>`;
    }
    html += `
      <div class="acciones-detalle">
        <button class="btn-editar" id="btnEditarTurno">Editar</button>
        <button class="btn-eliminar" id="btnEliminarTurno">Eliminar</button>
      </div>`;
    elDetalleTurno.innerHTML = html;
  }

  document.getElementById("btnEliminarTurno").addEventListener("click", () => eliminarTurno(t.id));
  const btnEditar = document.getElementById("btnEditarTurno");
  if (btnEditar) {
    btnEditar.addEventListener("click", () => mostrarFormularioEdicion(t));
  }
}

function eliminarTurno(id) {
  const confirmar = confirm("¿Seguro que querés eliminar este turno? No se puede deshacer.");
  if (!confirmar) return;

  const turnos = cargarTurnos().filter(t => t.id !== id);
  guardarTurnos(turnos);

  elDetalleTurno.style.display = "none";
  renderizarHistorial();
  actualizarResumen();
}

function mostrarFormularioEdicion(t) {
  if (t.franco) {
    elDetalleTurno.innerHTML = `
      <label class="field-label">Fecha</label>
      <input type="date" id="editFecha" value="${t.fecha}">
      <div class="acciones-detalle">
        <button class="btn-guardar-edicion" id="btnGuardarEdicion">Guardar cambios</button>
        <button class="btn-cancelar" id="btnCancelarEdicion">Cancelar</button>
      </div>`;
  } else {
    elDetalleTurno.innerHTML = `
      <label class="field-label">Lugar / objetivo</label>
      <input type="text" id="editLugar" value="${t.lugar}">

      <label class="field-label">Fecha</label>
      <input type="date" id="editFecha" value="${t.fecha}">

      <div class="fila">
        <div>
          <label class="field-label entrada">Hora entrada</label>
          <input type="time" id="editEntrada" value="${t.entrada}">
        </div>
        <div>
          <label class="field-label salida">Hora salida</label>
          <input type="time" id="editSalida" value="${t.salida}">
        </div>
      </div>

      <label class="check" style="margin-top:14px">
        <input type="checkbox" id="editPasoAlgo" ${t.pasoAlgo ? "checked" : ""}>
        <span class="check-box"></span>
        ¿Pasó algo en el turno?
      </label>
      <textarea id="editNota" placeholder="Contá qué pasó" style="display:${t.pasoAlgo ? "block" : "none"}">${t.nota || ""}</textarea>

      <div class="acciones-detalle">
        <button class="btn-guardar-edicion" id="btnGuardarEdicion">Guardar cambios</button>
        <button class="btn-cancelar" id="btnCancelarEdicion">Cancelar</button>
      </div>`;

    document.getElementById("editPasoAlgo").addEventListener("change", (e) => {
      document.getElementById("editNota").style.display = e.target.checked ? "block" : "none";
    });
  }

  document.getElementById("btnGuardarEdicion").addEventListener("click", () => guardarEdicion(t));
  document.getElementById("btnCancelarEdicion").addEventListener("click", () => mostrarDetalle(t));
}

function guardarEdicion(tOriginal) {
  const turnos = cargarTurnos();
  const idx = turnos.findIndex(x => x.id === tOriginal.id);
  if (idx === -1) return;

  if (tOriginal.franco) {
    const nuevaFecha = document.getElementById("editFecha").value;
    if (!nuevaFecha) {
      alert("Completá la fecha.");
      return;
    }
    turnos[idx].fecha = nuevaFecha;
  } else {
    const lugar = document.getElementById("editLugar").value.trim();
    const fecha = document.getElementById("editFecha").value;
    const entrada = document.getElementById("editEntrada").value;
    const salida = document.getElementById("editSalida").value;
    const pasoAlgo = document.getElementById("editPasoAlgo").checked;
    const nota = document.getElementById("editNota").value.trim();

    if (!lugar || !fecha || !entrada || !salida) {
      alert("Completá lugar, fecha, hora de entrada y hora de salida.");
      return;
    }
    if (pasoAlgo && !nota) {
      alert("Marcaste que pasó algo: contá qué pasó en la nota.");
      return;
    }

    const { totalHoras, horasNocturnas } = calcularHoras(fecha, entrada, salida);

    turnos[idx] = {
      ...turnos[idx],
      lugar,
      fecha,
      entrada,
      salida,
      totalHoras: redondear(totalHoras),
      horasNocturnas: redondear(horasNocturnas),
      pasoAlgo,
      nota: pasoAlgo ? nota : ""
    };
  }

  guardarTurnos(turnos);
  renderizarHistorial();
  actualizarResumen();
  mostrarDetalle(turnos[idx]);
  alert("Turno actualizado.");
}

[elFiltroDesde, elFiltroHasta, elFiltroLugar].forEach(el =>
  el.addEventListener("input", renderizarHistorial)
);

// ---------- Exportar historial a PDF ----------

document.getElementById("btnExportarPDF").addEventListener("click", exportarHistorialPDF);

function exportarHistorialPDF() {
  if (!window.jspdf) {
    alert("No se pudo cargar la herramienta para crear el PDF. Revisá que tengas internet e intentá de nuevo.");
    return;
  }

  const turnos = obtenerTurnosFiltrados();
  if (turnos.length === 0) {
    alert("No hay turnos para exportar con este filtro.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 15;

  doc.setFontSize(16);
  doc.text("Control de Horas - Historial", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Guardia: ${obtenerUsuarioActual()}`, 14, y);
  y += 6;

  const desde = elFiltroDesde.value || "sin filtro";
  const hasta = elFiltroHasta.value || "sin filtro";
  doc.text(`Rango: ${desde} a ${hasta}`, 14, y);
  y += 10;

  let totalHorasGeneral = 0;
  let totalFrancos = 0;
  turnos.forEach(t => {
    if (t.franco) totalFrancos++;
    else totalHorasGeneral += t.totalHoras;
  });

  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(
    `Total turnos: ${turnos.length}   |   Total horas: ${redondear(totalHorasGeneral)} hs   |   Francos: ${totalFrancos}`,
    14, y
  );
  y += 8;
  doc.setLineWidth(0.2);
  doc.line(14, y, 196, y);
  y += 8;

  turnos.forEach(t => {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }

    doc.setTextColor(0);
    doc.setFontSize(11);

    if (t.franco) {
      doc.text(`${t.fecha}  -  Franco`, 14, y);
      y += 8;
      return;
    }

    doc.text(`${t.fecha}  -  ${t.lugar}`, 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(
      `${t.entrada} a ${t.salida}   |   Total: ${t.totalHoras} hs   |   Nocturnas: ${t.horasNocturnas} hs`,
      14, y
    );
    y += 6;

    if (t.pasoAlgo && t.nota) {
      doc.setTextColor(150, 40, 40);
      const notaLineas = doc.splitTextToSize(`Nota: ${t.nota}`, 180);
      doc.text(notaLineas, 14, y);
      y += notaLineas.length * 5;
    }

    y += 4;
  });

  doc.save("historial_turnos.pdf");
}

// ============================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ============================================

const tabTurno = document.getElementById("tabTurno");
const tabHistorial = document.getElementById("tabHistorial");
const pantallaTurno = document.getElementById("pantallaTurno");
const pantallaHistorial = document.getElementById("pantallaHistorial");

tabTurno.addEventListener("click", () => {
  tabTurno.classList.add("active");
  tabHistorial.classList.remove("active");
  pantallaTurno.classList.remove("oculta");
  pantallaHistorial.classList.add("oculta");
});

tabHistorial.addEventListener("click", () => {
  tabHistorial.classList.add("active");
  tabTurno.classList.remove("active");
  pantallaHistorial.classList.remove("oculta");
  pantallaTurno.classList.add("oculta");
  renderizarHistorial();
});

// ============================================
// INICIO
// ============================================

if (obtenerUsuarioActual() && cargarUsuarios()[obtenerUsuarioActual()] !== undefined) {
  mostrarApp();
} else {
  cerrarSesionUsuario();
  mostrarLogin();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
