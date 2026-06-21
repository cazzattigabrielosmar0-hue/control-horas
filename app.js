// ============================================
// CONTROL DE HORAS - lógica de la app
// Todo se guarda en el celular/PC con localStorage,
// no necesita internet ni servidor.
// ============================================

const STORAGE_KEY = "turnos_guardia";
const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const SUBTITULOS = {
  inicio: "Registro de turno",
  resumen: "Resumen general",
  historial: "Historial de turnos",
  calendario: "Vista mensual",
  ajustes: "Configuración"
};

function cargarTurnos() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function guardarTurnos(turnos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(turnos));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

function formatFecha(fechaISO) {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

// Convierte horas decimales (ej 12.5) a "12:30"
function formatHHMM(horasDecimales) {
  const totalMin = Math.round(horasDecimales * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

// ---------- Cálculo de horas ----------

function calcularHoras(fecha, horaEntrada, horaSalida) {
  let inicio = new Date(`${fecha}T${horaEntrada}`);
  let fin = new Date(`${fecha}T${horaSalida}`);
  if (fin <= inicio) {
    fin.setDate(fin.getDate() + 1); // cruza la medianoche
  }
  const totalHoras = (fin - inicio) / 3600000;
  const horasNocturnas = calcularHorasNocturnas(inicio, fin);
  return { totalHoras, horasNocturnas, inicio, fin };
}

// Suma las horas que caen entre las 22:00 y las 06:00, día por día
function calcularHorasNocturnas(inicio, fin) {
  let total = 0;
  let dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
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

// Devuelve la clave "año-semana" (lunes a domingo) de una fecha
function claveSemana(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const diaSemana = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - diaSemana); // retrocede al lunes de esa semana
  return d.toISOString().slice(0, 10);
}

function claveMes(fechaStr) {
  return fechaStr.slice(0, 7); // "2026-06"
}

// ---------- Resumen semanal (siempre referido a la semana real de "hoy") ----------

function calcularResumenSemana(turnos, fechaReferencia) {
  const semanaRef = claveSemana(fechaReferencia);
  let horasSemana = 0;
  let nocturnasSemana = 0;

  turnos.forEach(t => {
    if (!t.franco && claveSemana(t.fecha) === semanaRef) {
      horasSemana += t.totalHoras;
      nocturnasSemana += t.horasNocturnas;
    }
  });

  return {
    horasSemana,
    nocturnasSemana,
    extraSemana: Math.max(0, horasSemana - 48)
  };
}

// ---------- Resumen mensual (según el mes elegido en el navegador) ----------

function calcularResumenMes(turnos, mesRef) {
  let horasMes = 0;
  let nocturnasMes = 0;
  let francosMes = 0;
  let extraDiariaMes = 0;

  turnos.forEach(t => {
    if (claveMes(t.fecha) !== mesRef) return;
    if (t.franco) {
      francosMes++;
    } else {
      horasMes += t.totalHoras;
      nocturnasMes += t.horasNocturnas;
      extraDiariaMes += Math.max(0, t.totalHoras - 8);
    }
  });

  // Horas extra semanales: se agrupan los turnos por semana (lunes a domingo)
  // y la semana se le asigna al mes del lunes con que arranca.
  const semanas = {};
  turnos.forEach(t => {
    if (t.franco) return;
    const sem = claveSemana(t.fecha);
    semanas[sem] = (semanas[sem] || 0) + t.totalHoras;
  });
  let extraSemanalMes = 0;
  Object.keys(semanas).forEach(sem => {
    if (claveMes(sem) === mesRef) {
      extraSemanalMes += Math.max(0, semanas[sem] - 48);
    }
  });

  return { horasMes, nocturnasMes, francosMes, extraDiariaMes, extraSemanalMes };
}

// ============================================
// ESTADO GENERAL
// ============================================

let pantallaActual = "inicio";
let soloNotas = false;
let mesResumen = new Date(); // mes que se está viendo en la pantalla Resumen
let mesCalendario = new Date(); // mes que se está viendo en Calendario
let fechaSeleccionadaCalendario = null;

function etiquetaMes(fecha) {
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

// ============================================
// NAVEGACIÓN ENTRE PANTALLAS
// ============================================

function mostrarPantalla(nombre) {
  pantallaActual = nombre;
  document.querySelectorAll(".pantalla").forEach(s => s.classList.add("oculta"));
  const mapaId = {
    inicio: "pantallaInicio",
    resumen: "pantallaResumen",
    historial: "pantallaHistorial",
    calendario: "pantallaCalendario",
    ajustes: "pantallaAjustes"
  };
  document.getElementById(mapaId[nombre]).classList.remove("oculta");
  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.screen === nombre);
  });
  document.getElementById("headerSubtitle").textContent = SUBTITULOS[nombre];
  document.querySelector(".screens").scrollTop = 0;

  if (nombre === "inicio") {
    actualizarResumenInicio();
    renderHistorialPreview();
  } else if (nombre === "resumen") {
    renderResumenCompleto();
  } else if (nombre === "historial") {
    renderizarHistorial();
  } else if (nombre === "calendario") {
    renderCalendario();
  }
}

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => mostrarPantalla(btn.dataset.screen));
});

document.getElementById("btnNuevoTurno").addEventListener("click", () => {
  mostrarPantalla("inicio");
  setTimeout(() => {
    document.getElementById("lugar").focus();
  }, 50);
});

document.getElementById("btnHeaderClock").addEventListener("click", () => {
  mostrarPantalla("historial");
});

// ============================================
// PANTALLA: INICIO (nuevo turno + resumen + preview historial)
// ============================================

const elFecha = document.getElementById("fecha");
const elHoraEntrada = document.getElementById("horaEntrada");
const elHoraSalida = document.getElementById("horaSalida");
const elResultado = document.getElementById("resultado");
const elTotalTurno = document.getElementById("totalTurno");
const elHorasNocturnas = document.getElementById("horasNocturnas");
const elHorasExtraPreview = document.getElementById("horasExtraPreview");
const elNota = document.getElementById("nota");
const elNotaCount = document.getElementById("notaCount");

elFecha.value = new Date().toISOString().slice(0, 10);

function actualizarVistaPrevia() {
  const fecha = elFecha.value;
  const entrada = elHoraEntrada.value;
  const salida = elHoraSalida.value;
  if (!fecha || !entrada || !salida) return;

  const { totalHoras, horasNocturnas } = calcularHoras(fecha, entrada, salida);

  elResultado.style.display = "flex";
  elTotalTurno.textContent = formatHHMM(totalHoras);
  elHorasNocturnas.textContent = formatHHMM(horasNocturnas);

  // Proyección de horas extra semanales si se sumara este turno
  const turnos = cargarTurnos();
  const resumenSemana = calcularResumenSemana(turnos, fecha);
  const semanaConEsteTurno = resumenSemana.horasSemana + totalHoras;
  elHorasExtraPreview.textContent = formatHHMM(Math.max(0, semanaConEsteTurno - 48));
}

[elFecha, elHoraEntrada, elHoraSalida].forEach(el =>
  el.addEventListener("change", actualizarVistaPrevia)
);

elNota.addEventListener("input", () => {
  elNotaCount.textContent = elNota.value.length;
});

document.getElementById("btnGuardarTurno").addEventListener("click", () => {
  const lugar = document.getElementById("lugar").value.trim();
  const fecha = elFecha.value;
  const entrada = elHoraEntrada.value;
  const salida = elHoraSalida.value;
  const nota = elNota.value.trim();

  if (!lugar || !fecha || !entrada || !salida) {
    alert("Completá lugar, fecha, hora de entrada y hora de salida.");
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
    pasoAlgo: nota.length > 0,
    nota,
    franco: false
  });
  guardarTurnos(turnos);

  // Limpiar formulario
  document.getElementById("lugar").value = "";
  elNota.value = "";
  elNotaCount.textContent = "0";

  actualizarResumenInicio();
  renderHistorialPreview();
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
  actualizarResumenInicio();
  renderHistorialPreview();
  alert("Franco registrado para el " + formatFecha(fecha));
});

document.getElementById("btnVerNotas").addEventListener("click", () => {
  soloNotas = true;
  mostrarPantalla("historial");
});

document.getElementById("btnVerTodos").addEventListener("click", () => {
  mostrarPantalla("historial");
});

function actualizarResumenInicio() {
  const turnos = cargarTurnos();
  const hoy = new Date().toISOString().slice(0, 10);
  const semana = calcularResumenSemana(turnos, hoy);
  const mes = calcularResumenMes(turnos, claveMes(hoy));

  document.getElementById("resHorasSemana").textContent = formatHHMM(semana.horasSemana);
  document.getElementById("resExtraSemana").textContent = formatHHMM(semana.extraSemana);
  document.getElementById("resHorasMes").textContent = formatHHMM(mes.horasMes);
  document.getElementById("resFrancosMes").textContent = mes.francosMes;

  const barra = document.getElementById("resBarraSemana");
  const porcentaje = Math.min(100, (semana.horasSemana / 48) * 100);
  barra.style.width = porcentaje + "%";
  barra.classList.toggle("naranja", semana.extraSemana > 0);
}

function renderHistorialPreview() {
  const cont = document.getElementById("historialPreview");
  const turnos = cargarTurnos().slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const ultimos = turnos.slice(0, 3);

  if (ultimos.length === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no registraste ningún turno.</p>';
    return;
  }

  cont.innerHTML = "";
  ultimos.forEach(t => {
    const item = document.createElement("div");
    item.className = "item-turno" + (t.pasoAlgo ? " con-nota" : "");
    if (t.franco) {
      item.innerHTML = `
        <div><p class="titulo">${formatFecha(t.fecha)} · Franco</p></div>
        <span class="flecha">›</span>`;
    } else {
      item.innerHTML = `
        <div>
          <p class="titulo">${formatFecha(t.fecha)} · ${escapeHtml(t.lugar)}</p>
          <p class="sub">${t.entrada} - ${t.salida}</p>
        </div>
        <div class="lado-derecho">
          <span class="horas-total">${formatHHMM(t.totalHoras)}</span>
          <span class="flecha">›</span>
        </div>`;
    }
    item.addEventListener("click", () => {
      mostrarPantalla("historial");
      renderizarHistorial();
      mostrarDetalle(t);
    });
    cont.appendChild(item);
  });
}

// ============================================
// PANTALLA: RESUMEN
// ============================================

document.getElementById("resMesPrev").addEventListener("click", () => {
  mesResumen.setMonth(mesResumen.getMonth() - 1);
  renderResumenCompleto();
});
document.getElementById("resMesNext").addEventListener("click", () => {
  mesResumen.setMonth(mesResumen.getMonth() + 1);
  renderResumenCompleto();
});

function renderResumenCompleto() {
  document.getElementById("resMesLabel").textContent = etiquetaMes(mesResumen);

  const turnos = cargarTurnos();
  const hoy = new Date().toISOString().slice(0, 10);
  const semana = calcularResumenSemana(turnos, hoy);

  document.getElementById("rHorasSemana").textContent = formatHHMM(semana.horasSemana);
  const barra = document.getElementById("rBarraSemana");
  barra.style.width = Math.min(100, (semana.horasSemana / 48) * 100) + "%";
  barra.classList.toggle("naranja", semana.extraSemana > 0);

  const mesRef = mesResumen.toISOString().slice(0, 7);
  const mes = calcularResumenMes(turnos, mesRef);

  document.getElementById("rHorasMes").textContent = formatHHMM(mes.horasMes);
  document.getElementById("rNocturnasMes").textContent = formatHHMM(mes.nocturnasMes);
  document.getElementById("rExtraSemanalMes").textContent = formatHHMM(mes.extraSemanalMes);
  document.getElementById("rExtraDiariaMes").textContent = formatHHMM(mes.extraDiariaMes);
  document.getElementById("rFrancosMes").textContent = mes.francosMes;
}

// ============================================
// PANTALLA: HISTORIAL
// ============================================

const elListaHistorial = document.getElementById("listaHistorial");
const elDetalleTurno = document.getElementById("detalleTurno");
const elFiltroDesde = document.getElementById("filtroDesde");
const elFiltroHasta = document.getElementById("filtroHasta");
const elFiltroLugar = document.getElementById("filtroLugar");
const elAvisoSoloNotas = document.getElementById("avisoSoloNotas");

function renderizarHistorial() {
  const turnos = cargarTurnos()
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const desde = elFiltroDesde.value;
  const hasta = elFiltroHasta.value;
  const lugarFiltro = elFiltroLugar.value.trim().toLowerCase();

  elAvisoSoloNotas.style.display = soloNotas ? "flex" : "none";

  const filtrados = turnos.filter(t => {
    if (desde && t.fecha < desde) return false;
    if (hasta && t.fecha > hasta) return false;
    if (lugarFiltro && !t.lugar.toLowerCase().includes(lugarFiltro)) return false;
    if (soloNotas && !t.pasoAlgo) return false;
    return true;
  });

  elListaHistorial.innerHTML = "";
  elDetalleTurno.style.display = "none";

  if (filtrados.length === 0) {
    elListaHistorial.innerHTML = '<p class="vacio">No hay turnos en este rango.</p>';
    return;
  }

  filtrados.forEach(t => {
    const item = document.createElement("div");
    item.className = "item-turno" + (t.pasoAlgo ? " con-nota" : "");

    if (t.franco) {
      item.innerHTML = `
        <div><p class="titulo">${formatFecha(t.fecha)} · Franco</p></div>
        <span class="flecha">›</span>`;
    } else {
      item.innerHTML = `
        <div>
          <p class="titulo">${formatFecha(t.fecha)} · ${escapeHtml(t.lugar)}</p>
          <p class="sub">${t.entrada} - ${t.salida} · ${formatHHMM(t.horasNocturnas)} nocturnas</p>
        </div>
        <div class="lado-derecho">
          <span class="horas-total">${formatHHMM(t.totalHoras)}</span>
          <span class="flecha">›</span>
        </div>`;
    }

    item.addEventListener("click", () => mostrarDetalle(t));
    elListaHistorial.appendChild(item);
  });
}

function mostrarDetalle(t) {
  elDetalleTurno.style.display = "block";
  elDetalleTurno.classList.remove("oculta");

  if (t.franco) {
    elDetalleTurno.innerHTML = `
      <div class="detalle-header"><strong>${formatFecha(t.fecha)} · Franco</strong></div>
      <div class="botones-detalle">
        <button class="btn-peligro-sm" id="btnBorrarDet">Borrar</button>
      </div>`;
    document.getElementById("btnBorrarDet").addEventListener("click", () => borrarTurno(t.id));
    elDetalleTurno.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  const notaHtml = t.nota
    ? `<div class="nota-box">${escapeHtml(t.nota)}</div>`
    : `<p class="texto-ayuda">Sin novedades anotadas en este turno.</p>`;

  elDetalleTurno.innerHTML = `
    <div class="detalle-header">
      <strong>${formatFecha(t.fecha)} · ${escapeHtml(t.lugar)}</strong>
      <span class="texto-ayuda">${t.entrada} - ${t.salida}</span>
    </div>
    <div class="stats-row sm">
      <div class="stat-box">
        <span class="stat-label">Total</span>
        <strong class="stat-value azul">${formatHHMM(t.totalHoras)}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Nocturnas</span>
        <strong class="stat-value violeta">${formatHHMM(t.horasNocturnas)}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Extra diaria</span>
        <strong class="stat-value naranja">${formatHHMM(Math.max(0, t.totalHoras - 8))}</strong>
      </div>
    </div>
    ${notaHtml}
    <div class="botones-detalle">
      <button class="btn-secundario-sm" id="btnEditarDet">Editar</button>
      <button class="btn-peligro-sm" id="btnBorrarDet">Borrar</button>
    </div>`;

  document.getElementById("btnEditarDet").addEventListener("click", () => entrarModoEdicion(t));
  document.getElementById("btnBorrarDet").addEventListener("click", () => borrarTurno(t.id));
  elDetalleTurno.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function entrarModoEdicion(t) {
  elDetalleTurno.innerHTML = `
    <div class="detalle-header"><strong>Editar turno</strong></div>
    <div class="field">
      <label>Lugar / Objetivo</label>
      <input type="text" id="editLugar" value="${escapeHtml(t.lugar)}">
    </div>
    <div class="field">
      <label>Fecha</label>
      <input type="date" id="editFecha" value="${t.fecha}">
    </div>
    <div class="field-row two">
      <div class="field">
        <label>Hora entrada</label>
        <input type="time" id="editEntrada" value="${t.entrada}">
      </div>
      <div class="field">
        <label>Hora salida</label>
        <input type="time" id="editSalida" value="${t.salida}">
      </div>
    </div>
    <div class="field">
      <label>Nota del turno</label>
      <textarea id="editNota" maxlength="300">${escapeHtml(t.nota || "")}</textarea>
    </div>
    <div class="botones-detalle">
      <button class="btn-principal-sm" id="btnGuardarEdicion">Guardar cambios</button>
      <button class="btn-secundario-sm" id="btnCancelarEdicion">Cancelar</button>
    </div>`;

  document.getElementById("btnGuardarEdicion").addEventListener("click", () => guardarEdicion(t.id));
  document.getElementById("btnCancelarEdicion").addEventListener("click", () => {
    renderizarHistorial();
  });
}

function guardarEdicion(id) {
  const lugar = document.getElementById("editLugar").value.trim();
  const fecha = document.getElementById("editFecha").value;
  const entrada = document.getElementById("editEntrada").value;
  const salida = document.getElementById("editSalida").value;
  const nota = document.getElementById("editNota").value.trim();

  if (!lugar || !fecha || !entrada || !salida) {
    alert("Completá todos los campos.");
    return;
  }

  const { totalHoras, horasNocturnas } = calcularHoras(fecha, entrada, salida);
  const turnos = cargarTurnos();
  const idx = turnos.findIndex(t => t.id === id);
  if (idx === -1) return;

  turnos[idx] = {
    ...turnos[idx],
    lugar,
    fecha,
    entrada,
    salida,
    totalHoras: redondear(totalHoras),
    horasNocturnas: redondear(horasNocturnas),
    nota,
    pasoAlgo: nota.length > 0
  };
  guardarTurnos(turnos);

  renderizarHistorial();
  actualizarResumenInicio();
  renderHistorialPreview();
  alert("Turno actualizado.");
}

function borrarTurno(id) {
  if (!confirm("¿Seguro que querés borrar este turno? Esta acción no se puede deshacer.")) return;
  let turnos = cargarTurnos();
  turnos = turnos.filter(t => t.id !== id);
  guardarTurnos(turnos);
  renderizarHistorial();
  actualizarResumenInicio();
  renderHistorialPreview();
}

document.getElementById("btnQuitarFiltroNotas").addEventListener("click", () => {
  soloNotas = false;
  renderizarHistorial();
});

[elFiltroDesde, elFiltroHasta, elFiltroLugar].forEach(el =>
  el.addEventListener("input", renderizarHistorial)
);

// ============================================
// PANTALLA: CALENDARIO
// ============================================

document.getElementById("calMesPrev").addEventListener("click", () => {
  mesCalendario.setMonth(mesCalendario.getMonth() - 1);
  renderCalendario();
});
document.getElementById("calMesNext").addEventListener("click", () => {
  mesCalendario.setMonth(mesCalendario.getMonth() + 1);
  renderCalendario();
});

function diasDelCalendario(year, monthIndex) {
  const primerDia = new Date(year, monthIndex, 1);
  const inicioSemana = (primerDia.getDay() + 6) % 7; // lunes = 0
  const grillaInicio = new Date(year, monthIndex, 1 - inicioSemana);

  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(grillaInicio);
    d.setDate(grillaInicio.getDate() + i);
    dias.push(d);
  }
  return dias;
}

function renderCalendario() {
  document.getElementById("calMesLabel").textContent = etiquetaMes(mesCalendario);
  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";

  const year = mesCalendario.getFullYear();
  const monthIndex = mesCalendario.getMonth();
  const turnos = cargarTurnos();
  const hoyStr = new Date().toISOString().slice(0, 10);

  diasDelCalendario(year, monthIndex).forEach(d => {
    const fechaStr = d.toISOString().slice(0, 10);
    const esOtroMes = d.getMonth() !== monthIndex;
    const turnosDelDia = turnos.filter(t => t.fecha === fechaStr);
    const hayFranco = turnosDelDia.some(t => t.franco);
    const hayTurno = turnosDelDia.some(t => !t.franco);
    const horasDelDia = turnosDelDia.reduce((s, t) => s + (t.franco ? 0 : t.totalHoras), 0);
    const hayExtra = horasDelDia > 8;

    const btn = document.createElement("button");
    btn.className = "cal-day";
    if (esOtroMes) btn.classList.add("otro-mes");
    if (fechaStr === hoyStr) btn.classList.add("hoy");
    if (fechaStr === fechaSeleccionadaCalendario) btn.classList.add("seleccionado");

    let dots = "";
    if (hayTurno) dots += '<span class="dot azul"></span>';
    if (hayFranco) dots += '<span class="dot rosa"></span>';
    if (hayExtra) dots += '<span class="dot naranja"></span>';

    btn.innerHTML = `<span>${d.getDate()}</span><span class="cal-dots">${dots}</span>`;
    btn.addEventListener("click", () => {
      fechaSeleccionadaCalendario = fechaStr;
      renderCalendario();
      mostrarDetalleDia(fechaStr, turnosDelDia);
    });
    grid.appendChild(btn);
  });
}

function mostrarDetalleDia(fechaStr, turnosDelDia) {
  const cont = document.getElementById("calDetalleDia");
  const lista = document.getElementById("calDetalleLista");
  document.getElementById("calDetalleFecha").textContent = formatFecha(fechaStr);

  if (turnosDelDia.length === 0) {
    cont.style.display = "block";
    lista.innerHTML = '<p class="vacio">No hay turnos registrados este día.</p>';
    return;
  }

  cont.style.display = "block";
  lista.innerHTML = "";
  turnosDelDia.forEach(t => {
    const fila = document.createElement("div");
    fila.className = "cal-detalle-item";
    if (t.franco) {
      fila.innerHTML = `<span>Franco</span>`;
    } else {
      fila.innerHTML = `<span>${escapeHtml(t.lugar)} · ${t.entrada} - ${t.salida}</span><span class="azul">${formatHHMM(t.totalHoras)}</span>`;
    }
    fila.addEventListener("click", () => {
      mostrarPantalla("historial");
      renderizarHistorial();
      mostrarDetalle(t);
    });
    lista.appendChild(fila);
  });
}

// ============================================
// PANTALLA: AJUSTES
// ============================================

document.getElementById("btnBorrarTodo").addEventListener("click", () => {
  if (!confirm("Esto va a borrar TODOS los turnos y francos guardados. ¿Estás seguro?")) return;
  localStorage.removeItem(STORAGE_KEY);
  actualizarResumenInicio();
  renderHistorialPreview();
  alert("Se borraron todos los datos.");
});

// ============================================
// INICIO
// ============================================

actualizarResumenInicio();
renderHistorialPreview();

// Registrar el service worker para poder instalar la app (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}