// ============================================
// CONTROL DE HORAS - lógica de la app
// Todo se guarda en el celular/PC con localStorage,
// no necesita internet ni servidor (excepto para exportar a PDF).
// ============================================

const STORAGE_KEY = "turnos_guardia";

function cargarTurnos() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function guardarTurnos(turnos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(turnos));
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

// Suma las horas que caen entre las 22:00 y las 06:00, día por día.
// Arrancamos a revisar desde un día ANTES del inicio del turno, porque
// si el turno empieza de madrugada (ej: 05:00), esas horas pertenecen
// a la franja nocturna que arrancó el día anterior a las 22:00.
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

// ---------- Resumen ----------

function calcularResumen(turnos, fechaReferencia) {
  const semanaRef = claveSemana(fechaReferencia);
  const mesRef = claveMes(fechaReferencia);

  let horasSemana = 0;
  let horasMes = 0;
  let francosMes = 0;

  turnos.forEach(t => {
    if (claveSemana(t.fecha) === semanaRef && !t.franco) {
      horasSemana += t.totalHoras;
    }
    if (claveMes(t.fecha) === mesRef) {
      if (t.franco) francosMes++;
      else horasMes += t.totalHoras;
    }
  });

  const extraSemana = Math.max(0, horasSemana - 48);

  return { horasSemana, extraSemana, horasMes, francosMes };
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
const elAvisoExtra = document.getElementById("avisoExtra");
const elPasoAlgo = document.getElementById("pasoAlgo");
const elNota = document.getElementById("nota");

// Fecha de hoy por defecto
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

  // Aviso de horas extra: simula sumar este turno a la semana
  const turnos = cargarTurnos();
  const resumen = calcularResumen(turnos, fecha);
  const semanaConEsteTurno = resumen.horasSemana + totalHoras;
  if (semanaConEsteTurno > 48) {
    elAvisoExtra.style.display = "block";
    elAvisoExtra.textContent =
      "Con este turno superás las 48 hs semanales: " +
      redondear(semanaConEsteTurno - 48) + " hs extra";
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

  // Limpiar formulario
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
}

// ============================================
// PANTALLA: HISTORIAL
// ============================================

const elListaHistorial = document.getElementById("listaHistorial");
const elDetalleTurno = document.getElementById("detalleTurno");
const elFiltroDesde = document.getElementById("filtroDesde");
const elFiltroHasta = document.getElementById("filtroHasta");
const elFiltroLugar = document.getElementById("filtroLugar");

// Devuelve los turnos guardados aplicando los filtros activos.
// La usan tanto la lista en pantalla como el exportador de PDF.
function obtenerTurnosFiltrados() {
  const turnos = cargarTurnos()
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)); // más reciente primero

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
    elListaHistorial.innerHTML = "<p style='color:#888;font-size:13px'>No hay turnos en este rango.</p>";
    return;
  }

  filtrados.forEach(t => {
    const item = document.createElement("div");
    item.className = "item-turno" + (t.pasoAlgo ? " con-aviso" : "");

    if (t.franco) {
      item.innerHTML = `
        <div class="info">
          <p class="titulo">${t.fecha} · Franco</p>
        </div>`;
    } else {
      item.innerHTML = `
        <div class="info">
          <p class="titulo">${t.fecha} · ${t.lugar}</p>
          <p class="sub">${t.entrada} a ${t.salida} · ${t.totalHoras} hs · ${t.horasNocturnas} hs nocturnas</p>
        </div>`;
    }

    item.addEventListener("click", () => mostrarDetalle(t));
    elListaHistorial.appendChild(item);
  });
}

function mostrarDetalle(t) {
  elDetalleTurno.style.display = "block";
  if (t.franco) {
    elDetalleTurno.innerHTML = `<p><strong>${t.fecha}</strong> · Franco</p>`;
    return;
  }
  let html = `
    <p><strong>${t.fecha} · ${t.lugar}</strong></p>
    <p style="font-size:13px;color:#666">${t.entrada} a ${t.salida} · ${t.totalHoras} hs totales · ${t.horasNocturnas} hs nocturnas</p>
  `;
  if (t.pasoAlgo && t.nota) {
    html += `<div class="nota">${t.nota}</div>`;
  } else {
    html += `<p style="font-size:13px;color:#888">Sin novedades anotadas en este turno.</p>`;
  }
  elDetalleTurno.innerHTML = html;
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

actualizarResumen();

// Registrar el service worker para poder instalar la app (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
