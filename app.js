// ===========================
// Configuración principal
// ===========================
const WHATSAPP_NUMBER = "51927137867"; // Perú +51
const HOSPEDAJE_NAME = "Hospedaje Plaza";

const ROOM_TYPES = {
  simple: { label: "Simple", prefix: "S", count: 8, rate: 60 },
  doble: { label: "Doble (2 camas)", prefix: "D", count: 4, rate: 90 },
  privada: { label: "Baño privado", prefix: "P", count: 1, rate: 120 }
};

// Estado base de habitaciones (demo)
const defaultBusyRooms = new Set(["S2", "S5", "D2", "P1"]); // en rojo al inicio
const STORAGE_KEYS = {
  rooms: "hospedaje_rooms_v1",
  bookings: "hospedaje_bookings_v1"
};

// ===========================
// Helpers
// ===========================
const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function parseDate(isoDate) {
  return new Date(isoDate + "T00:00:00");
}

function nightsBetween(checkin, checkout) {
  const inDate = parseDate(checkin);
  const outDate = parseDate(checkout);
  const ms = outDate - inDate;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatMoney(value) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function getRoomTypeFromCode(code) {
  if (code.startsWith("S")) return "simple";
  if (code.startsWith("D")) return "doble";
  if (code.startsWith("P")) return "privada";
  return null;
}

function generateAllRooms() {
  const rooms = [];
  for (const key of Object.keys(ROOM_TYPES)) {
    const cfg = ROOM_TYPES[key];
    for (let i = 1; i <= cfg.count; i++) {
      rooms.push(`${cfg.prefix}${i}`);
    }
  }
  return rooms;
}

function loadRoomsStatus() {
  const raw = localStorage.getItem(STORAGE_KEYS.rooms);
  if (raw) return JSON.parse(raw);

  // crear estado por defecto
  const status = {};
  generateAllRooms().forEach(code => {
    status[code] = defaultBusyRooms.has(code) ? "busy" : "free";
  });
  localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(status));
  return status;
}

function saveRoomsStatus(status) {
  localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(status));
}

function loadBookings() {
  const raw = localStorage.getItem(STORAGE_KEYS.bookings);
  return raw ? JSON.parse(raw) : [];
}

function saveBookings(bookings) {
  localStorage.setItem(STORAGE_KEYS.bookings, JSON.stringify(bookings));
}

function showResult(message, ok = true) {
  const box = $("result");
  box.classList.remove("hidden", "ok", "error");
  box.classList.add(ok ? "ok" : "error");
  box.textContent = message;
}

// ===========================
// Estado global
// ===========================
let roomStatus = loadRoomsStatus();
let bookings = loadBookings();

// ===========================
// Render UI
// ===========================
function renderRoomsGrid() {
  const wrap = $("roomsGrid");
  wrap.innerHTML = "";

  generateAllRooms().forEach(code => {
    const state = roomStatus[code] || "free";
    const div = document.createElement("div");
    div.className = `room-chip ${state}`;
    div.textContent = `${code} · ${state === "free" ? "Libre" : "Ocupada"}`;
    wrap.appendChild(div);
  });
}

function renderAdminPanel() {
  const panel = $("adminPanel");
  panel.innerHTML = "";

  generateAllRooms().forEach(code => {
    const state = roomStatus[code] || "free";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `admin-btn ${state}`;
    btn.textContent = `${code} → ${state === "free" ? "Libre" : "Ocupada"}`;
    btn.addEventListener("click", () => {
      roomStatus[code] = roomStatus[code] === "free" ? "busy" : "free";
      saveRoomsStatus(roomStatus);
      renderRoomsGrid();
      renderAdminPanel();
      populateRoomSelect();
    });
    panel.appendChild(btn);
  });
}

function populateRoomSelect() {
  const roomType = $("roomType").value;
  const roomSelect = $("roomSelect");
  roomSelect.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = "-- Selecciona habitación --";
  roomSelect.appendChild(first);

  if (!roomType || !ROOM_TYPES[roomType]) return;

  const cfg = ROOM_TYPES[roomType];
  const rooms = [];

  for (let i = 1; i <= cfg.count; i++) {
    const code = `${cfg.prefix}${i}`;
    if ((roomStatus[code] || "free") === "free") {
      rooms.push(code);
    }
  }

  if (!rooms.length) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Sin disponibilidad en este tipo";
    roomSelect.appendChild(none);
    return;
  }

  rooms.forEach(code => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = `${code} (${cfg.label})`;
    roomSelect.appendChild(opt);
  });
}

function updateSummary() {
  const checkin = $("checkin").value;
  const checkout = $("checkout").value;
  const roomType = $("roomType").value;

  let nights = 0;
  let rate = 0;
  let total = 0;
  let deposit = 0;

  if (checkin && checkout) {
    nights = nightsBetween(checkin, checkout);
    if (nights < 0) nights = 0;
  }

  if (roomType && ROOM_TYPES[roomType]) {
    rate = ROOM_TYPES[roomType].rate;
  }

  total = nights * rate;
  deposit = total * 0.3;

  $("nights").textContent = String(nights);
  $("rate").textContent = formatMoney(rate);
  $("total").textContent = formatMoney(total);
  $("deposit").textContent = formatMoney(deposit);
}

function setDateConstraints() {
  const today = todayISO();
  $("checkin").min = today;
  $("checkout").min = today;
}

function updateWhatsAppDirectLink() {
  const text = encodeURIComponent(`Hola, deseo información sobre disponibilidad en ${HOSPEDAJE_NAME}.`);
  $("whatsDirect").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

// ===========================
// Validación y flujo reserva
// ===========================
function validateForm() {
  const requiredIds = ["name", "doc", "phone", "checkin", "checkout", "guests", "roomType", "roomSelect"];
  for (const id of requiredIds) {
    if (!$(id).value) {
      return { ok: false, msg: "Completa todos los campos obligatorios." };
    }
  }

  const checkin = $("checkin").value;
  const checkout = $("checkout").value;
  const nights = nightsBetween(checkin, checkout);

  if (nights <= 0) {
    return { ok: false, msg: "Check-out debe ser posterior al check-in." };
  }

  const roomCode = $("roomSelect").value;
  if (!roomCode || roomStatus[roomCode] !== "free") {
    return { ok: false, msg: "La habitación elegida ya no está disponible." };
  }

  const guests = Number($("guests").value);
  const type = $("roomType").value;
  if (type === "simple" && guests > 1) {
    return { ok: false, msg: "La habitación simple admite 1 huésped recomendado." };
  }
  if ((type === "doble" || type === "privada") && guests > 4) {
    return { ok: false, msg: "Máximo 4 huéspedes en este prototipo." };
  }

  return { ok: true };
}

function buildBookingObject() {
  const roomTypeKey = $("roomType").value;
  const cfg = ROOM_TYPES[roomTypeKey];
  const checkin = $("checkin").value;
  const checkout = $("checkout").value;
  const nights = nightsBetween(checkin, checkout);
  const rate = cfg.rate;
  const total = nights * rate;
  const deposit = total * 0.3;

  return {
    id: `R-${Date.now()}`,
    createdAt: new Date().toISOString(),
    name: $("name").value.trim(),
    doc: $("doc").value.trim(),
    phone: $("phone").value.trim(),
    email: $("email").value.trim(),
    guests: Number($("guests").value),
    checkin,
    checkout,
    nights,
    roomType: roomTypeKey,
    roomTypeLabel: cfg.label,
    roomCode: $("roomSelect").value,
    rate,
    total,
    deposit,
    notes: $("notes").value.trim()
  };
}

function buildWhatsAppMessage(b) {
  return [
    `Hola ${HOSPEDAJE_NAME}, quiero confirmar esta reserva:`,
    ``,
    `• Código: ${b.id}`,
    `• Nombre: ${b.name}`,
    `• Documento: ${b.doc}`,
    `• Teléfono: ${b.phone}`,
    b.email ? `• Email: ${b.email}` : null,
    `• Huéspedes: ${b.guests}`,
    `• Check-in: ${b.checkin}`,
    `• Check-out: ${b.checkout}`,
    `• Noches: ${b.nights}`,
    `• Habitación: ${b.roomCode} (${b.roomTypeLabel})`,
    `• Tarifa/noche: ${formatMoney(b.rate)}`,
    `• Total: ${formatMoney(b.total)}`,
    `• Adelanto sugerido (30%): ${formatMoney(b.deposit)}`,
    ``,
    `Pago por:`,
    `- Yape: 927137867`,
    `- Plin: 927137867`,
    b.notes ? `` : null,
    b.notes ? `Nota: ${b.notes}` : null
  ].filter(Boolean).join("\n");
}

function previewBooking() {
  const validation = validateForm();
  if (!validation.ok) {
    showResult(validation.msg, false);
    return;
  }

  const b = buildBookingObject();
  showResult(
    `Previsualización OK: ${b.roomCode}, ${b.nights} noche(s), total ${formatMoney(b.total)}, adelanto ${formatMoney(b.deposit)}.`,
    true
  );
}

function confirmBookingAndSendWhatsApp(e) {
  e.preventDefault();

  const validation = validateForm();
  if (!validation.ok) {
    showResult(validation.msg, false);
    return;
  }

  const b = buildBookingObject();

  // Marcar habitación ocupada
  roomStatus[b.roomCode] = "busy";
  saveRoomsStatus(roomStatus);

  // Guardar reserva en localStorage
  bookings.push(b);
  saveBookings(bookings);

  // Re-render
  renderRoomsGrid();
  renderAdminPanel();
  populateRoomSelect();
  updateSummary();

  // Mensaje y redirección a WhatsApp
  const msg = encodeURIComponent(buildWhatsAppMessage(b));
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;

  showResult(`Reserva registrada localmente con código ${b.id}. Redirigiendo a WhatsApp...`, true);

  // abrir pestaña WhatsApp
  window.open(url, "_blank", "noopener,noreferrer");

  // opcional: reset parcial
  $("bookingForm").reset();
  setDateConstraints();
  $("roomSelect").innerHTML = `<option value="">Primero elige tipo y fechas</option>`;
  updateSummary();
}

function resetDemoData() {
  localStorage.removeItem(STORAGE_KEYS.rooms);
  localStorage.removeItem(STORAGE_KEYS.bookings);
  roomStatus = loadRoomsStatus();
  bookings = loadBookings();
  renderRoomsGrid();
  renderAdminPanel();
  populateRoomSelect();
  updateSummary();
  showResult("Demo restablecida. Se recuperó estado inicial simulado.", true);
}

function exportBookings() {
  const data = JSON.stringify(bookings, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reservas_hospedaje_demo.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ===========================
// Init
// ===========================
function init() {
  $("year").textContent = String(new Date().getFullYear());

  setDateConstraints();
  updateSummary();
  updateWhatsAppDirectLink();
  renderRoomsGrid();
  renderAdminPanel();

  // Eventos
  ["checkin", "checkout", "roomType"].forEach(id => {
    $(id).addEventListener("change", () => {
      if (id === "checkin") {
        $("checkout").min = $("checkin").value || todayISO();
      }
      populateRoomSelect();
      updateSummary();
    });
  });

  ["roomSelect", "guests"].forEach(id => {
    $(id).addEventListener("change", updateSummary);
  });

  $("previewBtn").addEventListener("click", previewBooking);
  $("bookingForm").addEventListener("submit", confirmBookingAndSendWhatsApp);

  $("resetDemo").addEventListener("click", resetDemoData);
  $("exportData").addEventListener("click", exportBookings);
}

init();
