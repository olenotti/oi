import React, { useState, useEffect, useMemo } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Typography,
  Collapse,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Stack,
} from "@mui/material";
import { getClients, saveClients } from "../utils/storage";
import {
  getDefaultPeriodForPackage,
  getSessionsForPackage,
  getPackageSessionNumber,
} from "../utils/packageUtils";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

// --- Função utilitária para forçar evento de storage ---
function broadcastStorageChange(key) {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

// --- Utilitários para horários personalizados ---
function getCustomSlotsForDate(date, profissional) {
  const customSlots = JSON.parse(localStorage.getItem("custom_slots_by_date") || "{}");
  return customSlots[`${date}_${profissional}`] || [];
}
function setCustomSlotsForDate(date, profissional, slots) {
  const key = "custom_slots_by_date";
  const customSlots = JSON.parse(localStorage.getItem(key) || "{}");
  customSlots[`${date}_${profissional}`] = slots;
  localStorage.setItem(key, JSON.stringify(customSlots));
  broadcastStorageChange(key);
}

// --- Utilitário para converter tempo ---
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// --- Lógica de horários livres adaptativa e correta ---
function getAvailableTimes({
  date,
  sessions,
  period = "1h",
  profissional,
  minDuration = 60,
  interval = 15,
  bloqueiosDia = []
}) {
  if (!date) return [];
  const dow = new Date(date + "T00:00:00").getDay();
  if (dow === 0) return [];

  let startExpediente = 8 * 60;
  if (bloqueiosDia.length > 0) {
    startExpediente = Math.max(...bloqueiosDia.map(b => timeToMinutes(b.horaFim)));
  }
  const endExpediente = dow === 6 ? 16 * 60 + 10 : 20 * 60 + 10;

  const daySessions = sessions
    .filter(s => s.date === date && (s.status === "scheduled" || s.status === "done"))
    .map(s => ({
      ...s,
      start: s.time ? timeToMinutes(s.time) : null,
      end: s.time && s.period
        ? timeToMinutes(s.time) + getMinutesFromPeriod(s.period)
        : null,
    }))
    .filter(s => s.start !== null && s.end !== null)
    .sort((a, b) => a.start - b.start);

  const customSlotsRaw = getCustomSlotsForDate(date, profissional)
    .filter(Boolean)
    .sort();

  // Slots personalizados que têm sessão marcada
  const customSlotsWithSession = customSlotsRaw.filter(slot =>
    daySessions.some(s => s.time === slot)
  );

  // Se existe pelo menos UM horário personalizado marcado, adaptar o início dos horários livres
  let firstMarked = null;
  if (customSlotsWithSession.length > 0) {
    // Pega o menor horário personalizado marcado
    const customMarkedMinutes = customSlotsWithSession.map(timeToMinutes);
    firstMarked = Math.min(...customMarkedMinutes);
  } else if (daySessions.length > 0) {
    firstMarked = daySessions[0].start;
  }

  let freeSlots = [];

  // NOVA LÓGICA: slots anteriores ao primeiro horário marcado são gerados de trás pra frente,
  // subtraindo (minDuration + interval) a cada passo, até o início do expediente
  function fillSlotsBeforeMarked(markedTime) {
    let slot = markedTime - minDuration - interval;
    while (slot >= startExpediente) {
      const slotEnd = slot + minDuration;
      // Checa conflito com sessões já marcadas
      const conflict = daySessions.some(s =>
        (slot < s.end && slotEnd > s.start)
      );
      // Não sobrepor outros slots livres
      const overlapFree = freeSlots.some(free => {
        const freeStart = timeToMinutes(free);
        const freeEnd = freeStart + minDuration;
        return (slot < freeEnd && slotEnd > freeStart);
      });
      if (!conflict && !overlapFree) {
        freeSlots.push(minutesToTime(slot));
      }
      slot -= (minDuration + interval);
    }
  }

  // slots depois do horário marcado ou entre sessões: lógica padrão (de frente pra trás)
  function fillSlotsInInterval(windowStart, windowEnd) {
    let slot = windowStart;
    while (slot + minDuration <= windowEnd) {
      const slotEnd = slot + minDuration;
      const conflict = daySessions.some(s =>
        (slot < s.end && slotEnd > s.start)
      );
      if (!conflict) {
        freeSlots.push(minutesToTime(slot));
      }
      slot += (minDuration + interval);
    }
  }

  if (daySessions.length === 0) {
    fillSlotsInInterval(startExpediente, endExpediente);
  } else {
    if (customSlotsWithSession.length > 0 && firstMarked !== null && firstMarked > startExpediente) {
      // slots antes do primeiro horário marcado (de trás pra frente, respeitando intervalo e período)
      fillSlotsBeforeMarked(firstMarked);
      // slots entre sessões
      for (let i = 0; i < daySessions.length - 1; i++) {
        const endCurr = daySessions[i].end;
        const startNext = daySessions[i + 1].start;
        fillSlotsInInterval(endCurr + interval, startNext - interval);
      }
      // slots depois da última sessão
      fillSlotsInInterval(daySessions[daySessions.length - 1].end + interval, endExpediente);
    } else {
      // slots antes da primeira sessão (padrão)
      fillSlotsInInterval(startExpediente, daySessions[0].start - interval);
      // slots entre sessões
      for (let i = 0; i < daySessions.length - 1; i++) {
        const endCurr = daySessions[i].end;
        const startNext = daySessions[i + 1].start;
        fillSlotsInInterval(endCurr + interval, startNext - interval);
      }
      // slots depois da última sessão
      fillSlotsInInterval(daySessions[daySessions.length - 1].end + interval, endExpediente);
    }
  }

  // Adiciona horários personalizados se não conflitam
  for (const tRaw of customSlotsRaw) {
    const t = timeToMinutes(tRaw);
    if (
      t >= startExpediente &&
      t + minDuration <= endExpediente &&
      !daySessions.some(
        s =>
          t < s.end + interval && t + minDuration > s.start - interval
      )
    ) {
      if (!freeSlots.includes(tRaw)) {
        freeSlots.push(tRaw);
      }
    }
  }

  freeSlots = Array.from(new Set(freeSlots)).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  return freeSlots;
}

function getMinutesFromPeriod(period) {
  if (!period) return 60;
  if (period === "30min") return 30;
  if (period === "1h") return 60;
  if (period === "1h30") return 90;
  if (period === "2h") return 120;
  const match = period.match(/(\d+)h(?:(\d+))?/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    return h * 60 + m;
  }
  return 60;
}

const PERIODOS = [
  { label: "30 minutos", value: "30min" },
  { label: "1 hora", value: "1h" },
  { label: "1h30", value: "1h30" },
  { label: "2 horas", value: "2h" }
];

const PROFISSIONAIS = [
  { label: "Letícia", value: "leticia" },
  { label: "Dani", value: "dani" },
  { label: "Bia", value: "bia" }
];

function getSessionsKeyForProfissional(profissional) {
  return `sessions_${profissional}`;
}

function getAllSessions() {
  let all = [];
  const global = JSON.parse(localStorage.getItem("sessions") || "[]");
  all = all.concat(global);
  for (const prof of PROFISSIONAIS) {
    const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof.value}`) || "[]");
    all = all.concat(profSessions);
  }
  const seen = new Set();
  return all.filter(s => {
    if (!s.id) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function getSessionsByProfissional(profissional) {
  const key = getSessionsKeyForProfissional(profissional);
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function saveSessionsByProfissional(profissional, sessions) {
  const key = getSessionsKeyForProfissional(profissional);
  localStorage.setItem(key, JSON.stringify(sessions));
  broadcastStorageChange(key);
}

// ATUALIZA STATUS DA SESSÃO EM TODAS AS CHAVES (global e profissionais)
function updateSessionStatusEverywhere(sessId, newStatus) {
  // Atualiza na chave global
  let globalSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  globalSessions = globalSessions.map(s =>
    s.id === sessId ? { ...s, status: newStatus } : s
  );
  localStorage.setItem("sessions", JSON.stringify(globalSessions));
  // Atualiza em cada profissional
  for (const prof of PROFISSIONAIS) {
    let profSessions = JSON.parse(localStorage.getItem(`sessions_${prof.value}`) || "[]");
    profSessions = profSessions.map(s =>
      s.id === sessId ? { ...s, status: newStatus } : s
    );
    localStorage.setItem(`sessions_${prof.value}`, JSON.stringify(profSessions));
  }
  broadcastStorageChange("sessions");
  for (const prof of PROFISSIONAIS) {
    broadcastStorageChange(`sessions_${prof.value}`);
  }
}

// REMOVE SESSÃO DE TODAS AS CHAVES (global e profissionais)
function removeSessionEverywhere(sessId) {
  let globalSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  globalSessions = globalSessions.filter(s => s.id !== sessId);
  localStorage.setItem("sessions", JSON.stringify(globalSessions));
  for (const prof of PROFISSIONAIS) {
    let profSessions = JSON.parse(localStorage.getItem(`sessions_${prof.value}`) || "[]");
    profSessions = profSessions.filter(s => s.id !== sessId);
    localStorage.setItem(`sessions_${prof.value}`, JSON.stringify(profSessions));
  }
  broadcastStorageChange("sessions");
  for (const prof of PROFISSIONAIS) {
    broadcastStorageChange(`sessions_${prof.value}`);
  }
}

function getClientPhone(clients, clientId) {
  const client = clients.find(c => c.id === clientId);
  if (!client || !client.phone) return "";
  let num = client.phone.replace(/\D/g, "");
  if (num.length === 11 && !num.startsWith("55")) num = "55" + num;
  if (num.length === 13 && num.startsWith("550")) num = "55" + num.slice(2);
  return num;
}
function getWhatsappLink(clients, clientId) {
  const num = getClientPhone(clients, clientId);
  return num ? `https://wa.me/${num}` : "#";
}
function formatDateAndWeekday(dateStr) {
  if (!dateStr) return { weekday: "", dateFormatted: "" };
  const dateObj = new Date(dateStr + "T00:00:00");
  const weekdays = [
    "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
    "Quinta-feira", "Sexta-feira", "Sábado"
  ];
  const weekday = weekdays[dateObj.getDay()];
  const dateFormatted = dateObj
    ? `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`
    : "";
  return { weekday, dateFormatted };
}
function getProfissionalLabel(profissional) {
  const found = PROFISSIONAIS.find(p => p.value === profissional);
  return found ? found.label : profissional;
}
function getPackageSessionText(sessao, allSessions, clients) {
  if (!sessao.packageId) return "";
  const client = clients.find(c => c.id === sessao.clientId);
  if (!client) return "";
  return `Sessão: ${getPackageSessionNumber(client, sessao.packageId, allSessions, sessao.id)}`;
}

function getMensagem1(sessao, allSessions, profissional, clients) {
  const { weekday, dateFormatted } = formatDateAndWeekday(sessao.date);
  const terapeuta = getProfissionalLabel(profissional);
  let msg = `Segue a confirmação do seu agendamento:
Terapia: ${sessao.massageType || "-"} | ${sessao.period || "-"}
Data: ${weekday} (${dateFormatted})
Horário: ${sessao.time || "-"}`;
  if (sessao.packageId) {
    msg += `\n${getPackageSessionText(sessao, allSessions, clients)}`;
  }
  msg += `
Terapeuta: ${terapeuta}
Le Renovare | Open Mall The Square- Sala 424 | Bloco E- Ao lado do carrefour 
Rod. Raposo Tavares, KM 22

🙏🏼🍃✨`;
  return msg;
}

function getMensagem2(sessao) {
  const { weekday, dateFormatted } = formatDateAndWeekday(sessao.date);
  return `Oii, aqui é a Lari e estou ajudando a Lê com a agenda de atendimentos🍃✨

Passando para confirmar sua sessão:
Dia: ${weekday}${dateFormatted ? ` (${dateFormatted})` : ""}
Horário: ${sessao.time || "-"}
Local: Le Renovare | Open Mall The Square- Sala 424 | Bloco E- Ao lado do carrefour 

Posso confirmar? Aguardamos seu retorno.💆🏼‍♀️💖`;
}

// Função para converter "HH:mm" para minutos
function horaToMinutos(hora) {
  if (!hora) return 0;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// --- Funções para copiar horários marcados e livres da semana/dia ---
function getWeekDates(startDate) {
  const week = [];
  const d = new Date(startDate);
  for (let i = 0; i < 6; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    week.push(day);
  }
  return week;
}
function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function weekdayLabel(date) {
  const weekdays = [
    "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
  ];
  return `${weekdays[date.getDay() - 1]} (${pad2(date.getDate())}/${pad2(date.getMonth() + 1)})`;
}
function sessionLineFull(sessao, clients, allSessions) {
  let line = `${sessao.time} ${sessao.clientName || ""}`;
  if (sessao.period) line += ` ${sessao.period}`;
  if (sessao.packageId) {
    const client = clients.find(c => c.id === sessao.clientId);
    if (client) {
      const sessaoNum = getPackageSessionNumber(client, sessao.packageId, allSessions, sessao.id);
      if (sessaoNum) line += ` ${sessaoNum}`;
    }
  }
  if (sessao.status === "done") line += ":white_check_mark:";
  return line;
}

// NOVA FUNÇÃO: Lista horários marcados e livres juntos por dia
function buildWeekMarkedAndFreeCombined({ sessions, clients, weekStart, allSessions, profissional }) {
  const weekDates = getWeekDates(weekStart);
  let msg = "Horários marcados da semana:\n\n";
  for (const date of weekDates) {
    const dateStr = date.toISOString().slice(0, 10);
    const daySessions = sessions
      .filter(s => (s.status === "scheduled" || s.status === "done") && s.date === dateStr)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const livres = getAvailableTimes({
      date: dateStr,
      sessions,
      period: "1h",
      profissional,
      minDuration: 60,
      interval: 15
    });
    // Junta todos horários do dia (marcados + livres), ordenados
    let allTimes = [];
    for (const s of daySessions) {
      allTimes.push({
        time: s.time,
        type: "marcado",
        sessao: s
      });
    }
    for (const h of livres) {
      // Só adiciona se não houver sessão marcada nesse horário
      if (!daySessions.some(s => s.time === h)) {
        allTimes.push({
          time: h,
          type: "livre"
        });
      }
    }
    allTimes.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    if (allTimes.length === 0) continue;
    msg += `${weekdayLabel(date)}\n`;
    for (const item of allTimes) {
      if (item.type === "marcado") {
        msg += sessionLineFull(item.sessao, clients, allSessions) + "\n";
      } else {
        msg += `${item.time}\n`;
      }
    }
    msg += "\n";
  }
  return msg.trim();
}

export default function Agendamentos() {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [terapia, setTerapia] = useState("Massagem");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [showRealizadas, setShowRealizadas] = useState(true);
  const [snackbar, setSnackbar] = useState("");
  const [isAvulsa, setIsAvulsa] = useState(true);

  const [profissional, setProfissional] = useState(PROFISSIONAIS[0].value);
  const [sessions, setSessions] = useState([]);
  const [confirmadas, setConfirmadas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("confirmadas") || "[]");
    } catch {
      return [];
    }
  });

  const [showCustomHourForm, setShowCustomHourForm] = useState(false);
  const [customHour, setCustomHour] = useState("");
  const [customHoursForDay, setCustomHoursForDay] = useState([]);
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  useEffect(() => {
    setClients(getClients());
    setSessions(getSessionsByProfissional(profissional));
    const handler = () => {
      setClients(getClients());
      setSessions(getSessionsByProfissional(profissional));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [profissional]);

  useEffect(() => {
    localStorage.setItem("confirmadas", JSON.stringify(confirmadas));
  }, [confirmadas]);

  useEffect(() => {
    if (open && date) {
      setCustomHoursForDay(getCustomSlotsForDate(date, profissional));
    }
  }, [open, date, profissional]);

  useEffect(() => {
    if (selectedPackageId) {
      setIsAvulsa(false);
    } else {
      setIsAvulsa(true);
    }
  }, [selectedPackageId, open]);

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedClient = useMemo(
    () => clients.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  const activePackages = useMemo(() => {
    if (!selectedClient || !Array.isArray(selectedClient.packages)) return [];
    const today = new Date().toISOString().slice(0, 10);
    return selectedClient.packages.filter(pkg => {
      if (pkg.validity && pkg.validity < today) return false;
      const total = getSessionsForPackage(pkg.name);
      const used = (pkg.sessionsUsed ?? 0) +
        getAllSessions().filter(
          s =>
            s.clientId === selectedClient.id &&
            s.packageId === pkg.id &&
            s.status === "done"
        ).length;
      return used < total;
    });
  }, [selectedClient, sessions]);

  useEffect(() => {
    setSelectedPackageId("");
    setSelectedPeriod("");
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedPackageId) {
      setSelectedPeriod("");
      return;
    }
    const pkg = activePackages.find(p => p.id === selectedPackageId);
    if (pkg && pkg.name) {
      const period = getDefaultPeriodForPackage(pkg.name);
      setSelectedPeriod(period || pkg.period || "");
    } else {
      setSelectedPeriod("");
    }
  }, [selectedPackageId, activePackages]);

  useEffect(() => {
    if (activePackages.length === 1) {
      setSelectedPackageId(activePackages[0].id);
      const period = getDefaultPeriodForPackage(activePackages[0].name);
      setSelectedPeriod(period || activePackages[0].period || "");
    }
    if (activePackages.length === 0) {
      setSelectedPeriod("");
    }
  }, [activePackages]);

  // --- ALTERADO: Atualiza status em todas as chaves ---
  function marcarComoRealizada(sessao) {
    updateSessionStatusEverywhere(sessao.id, "done");
    setClients(getClients());
    setSessions(sessions.map(s =>
      s.id === sessao.id ? { ...s, status: "done" } : s
    ));
  }

  function desmarcarSessao(sessaoId) {
    removeSessionEverywhere(sessaoId);
    setSessions(sessions.filter(s => s.id !== sessaoId));
  }
  function removerSessaoRealizada(sessaoId) {
    removeSessionEverywhere(sessaoId);
    setSessions(sessions.filter(s => s.id !== sessaoId));
  }

  function marcarComoConfirmada(sessaoId) {
    setConfirmadas(prev => [...prev, sessaoId]);
    setSnackbar("Sessão confirmada!");
    setTimeout(() => setSnackbar(""), 2000);
  }

  let proximaSessaoPacote = "";
  let totalSessaoPacote = "";
  if (selectedClient && selectedPackageId) {
    const pacote = activePackages.find(p => p.id === selectedPackageId);
    if (pacote) {
      totalSessaoPacote = getSessionsForPackage(pacote.name);
      const used = (pacote.sessionsUsed ?? 0) +
        getAllSessions().filter(
          s =>
            s.clientId === selectedClient.id &&
            s.packageId === pacote.id &&
            s.status === "done"
        ).length;
      proximaSessaoPacote = used + 1;
    }
  }

  function agendarSessao() {
    if (!selectedClientId || !date || !selectedPeriod || !terapia || !selectedHour) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const cliente = clients.find(c => c.id === selectedClientId);
    const pacote = activePackages.find(p => p.id === selectedPackageId);

    let packageId = "";
    let packageName = "";
    if (pacote) {
      packageId = pacote.id;
      packageName = pacote.name;
    }

    const novaSessao = {
      id: Date.now().toString(),
      clientId: selectedClientId,
      clientName: cliente?.name || "",
      date,
      time: selectedHour,
      massageType: terapia,
      period: selectedPeriod,
      status: "scheduled",
      packageId,
      packageName,
      isAvulsa: !packageId && isAvulsa ? true : false,
    };

    const novas = [...sessions, novaSessao];
    setSessions(novas);
    saveSessionsByProfissional(profissional, novas);
    setOpen(false);
    setSelectedClientId("");
    setSelectedPackageId("");
    setSelectedPeriod("");
    setSelectedHour("");
    setTerapia("Massagem");
    setDate(new Date().toISOString().slice(0, 10));
    setIsAvulsa(true);
  }

  const periodoDisabled = activePackages.length > 0;
  const periodosDisponiveis = periodoDisabled
    ? activePackages
        .map(pkg => {
          const period = getDefaultPeriodForPackage(pkg.name) || pkg.period;
          return period;
        })
        .filter((v, i, arr) => v && arr.indexOf(v) === i)
        .map(periodValue => {
          const found = PERIODOS.find(p => p.value === periodValue);
          return found || { label: periodValue, value: periodValue };
        })
    : PERIODOS;

  // FILTRA horários bloqueados e libera o primeiro horário igual ao fim do bloqueio
  const horariosLivres = useMemo(() => {
    if (!date || !selectedPeriod) return [];
    // Pega todos os intervalos bloqueados do dia
    const bloqueios = (() => {
      try {
        const all = JSON.parse(localStorage.getItem("bloqueios_horarios") || "{}");
        return (all?.[profissional] || []).filter(b => b.data === date);
      } catch {
        return [];
      }
    })();

    // Passa os bloqueios para getAvailableTimes para ajustar o expediente
    let livres = getAvailableTimes({
      date,
      sessions,
      period: selectedPeriod,
      profissional,
      minDuration: getMinutesFromPeriod(selectedPeriod),
      interval: 15,
      bloqueiosDia: bloqueios
    });

    // Remove horários bloqueados, mas libera o primeiro horário igual ao fim de algum bloqueio
    let livresFiltrados = [];
    for (let i = 0; i < livres.length; i++) {
      const hora = livres[i];
      const bloqueado = bloqueios.some(b => {
        const inicio = horaToMinutos(b.horaInicio);
        const fim = horaToMinutos(b.horaFim);
        const minutosHora = horaToMinutos(hora);
        // Bloqueia se minutosHora >= inicio && minutosHora < fim
        return minutosHora >= inicio && minutosHora < fim;
      });
      // Se não está bloqueado, libera normalmente
      if (!bloqueado) {
        livresFiltrados.push(hora);
        continue;
      }
      // Se está bloqueado, verifica se é exatamente igual ao fim de algum bloqueio
      const ehFimDeBloqueio = bloqueios.some(b => hora === b.horaFim);
      if (ehFimDeBloqueio) {
        livresFiltrados.push(hora);
      }
    }
    return livresFiltrados;
  }, [date, sessions, selectedPeriod, profissional, customHoursForDay]);

  const agendadas = sessions.filter(s => s.status === "scheduled");
  const realizadas = sessions.filter(s => s.status === "done");
  const confirmar = sessions.filter(
    s => s.status === "scheduled" && !confirmadas.includes(s.id)
  );

  const allSessions = useMemo(() => getAllSessions(), [sessions]);

  function handleCopyMensagem1(sessao) {
    const msg = getMensagem1(sessao, allSessions, profissional, clients);
    navigator.clipboard.writeText(msg);
    setSnackbar("Mensagem 1 copiada!");
    setTimeout(() => setSnackbar(""), 2000);
  }
  function handleCopyMensagem2(sessao) {
    const msg = getMensagem2(sessao);
    navigator.clipboard.writeText(msg);
    setSnackbar("Mensagem 2 copiada!");
    setTimeout(() => setSnackbar(""), 2000);
  }
  function handleOpenWhatsapp(sessao) {
    const link = getWhatsappLink(clients, sessao.clientId);
    window.open(link, "_blank");
  }

  function handleAddCustomHour() {
    if (!customHour.match(/^\d{2}:\d{2}$/)) {
      setSnackbar("Formato deve ser HH:mm");
      return;
    }
    if (customHoursForDay.includes(customHour)) {
      setSnackbar("Horário já adicionado");
      return;
    }
    const newSlots = [...customHoursForDay, customHour].sort();
    setCustomHoursForDay(newSlots);
    setCustomHour("");
  }
  function handleRemoveCustomHour(h) {
    setCustomHoursForDay(customHoursForDay.filter(x => x !== h));
  }
  function handleSaveCustomHours() {
    setCustomSlotsForDate(date, profissional, customHoursForDay);
    setSnackbar("Horários personalizados salvos!");
    setTimeout(() => setSnackbar(""), 2000);
  }
  function handleClearCustomHours() {
    setCustomSlotsForDate(date, profissional, []);
    setCustomHoursForDay([]);
    setSnackbar("Horários personalizados removidos!");
    setTimeout(() => setSnackbar(""), 2000);
  }

  function buildWeekMarkedSessions({ sessions, clients, weekStart, allSessions }) {
    const weekDates = getWeekDates(weekStart);
    let msg = "";
    for (const date of weekDates) {
      const dateStr = date.toISOString().slice(0, 10);
      const daySessions = sessions
        .filter(s => (s.status === "scheduled" || s.status === "done") && s.date === dateStr)
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      if (daySessions.length === 0) continue;
      msg += `${weekdayLabel(date)}\n`;
      for (const s of daySessions) {
        msg += sessionLineFull(s, clients, allSessions) + "\n";
      }
      msg += "\n";
    }
    return msg.trim();
  }

  function buildWeekFreeSlots({ sessions, clients, weekStart, profissional, period }) {
    const weekDates = getWeekDates(weekStart);
    let msg = "";
    for (const date of weekDates) {
      const dateStr = date.toISOString().slice(0, 10);
      const livres = getAvailableTimes({
        date: dateStr,
        sessions,
        period,
        profissional,
        minDuration: getMinutesFromPeriod(period),
        interval: 15
      });
      if (livres.length === 0) continue;
      msg += `${weekdayLabel(date)}\n`;
      for (const h of livres) {
        msg += `${h}\n`;
      }
      msg += "\n";
    }
    return msg.trim();
  }

  function buildDayFreeSlots({ sessions, date, profissional, period }) {
    const livres = getAvailableTimes({
      date,
      sessions,
      period,
      profissional,
      minDuration: getMinutesFromPeriod(period),
      interval: 15
    });
    if (livres.length === 0) return "Nenhum horário disponível";
    let msg = `${weekdayLabel(new Date(date + "T00:00:00"))}\n`;
    for (const h of livres) {
      msg += `${h}\n`;
    }
    return msg.trim();
  }

  const dateInputRef = React.useRef();

  function handleOpenDatePicker() {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker
        ? dateInputRef.current.showPicker()
        : dateInputRef.current.focus();
    }
  }

  // --- BOTÕES DE CÓPIA DE HORÁRIOS ---
  function handleCopyWeekMarked() {
    const weekStart = getWeekStart(date);
    const msg = buildWeekMarkedSessions({ sessions, clients, weekStart, allSessions });
    navigator.clipboard.writeText(msg);
    setSnackbar("Horários marcados da semana copiados!");
    setTimeout(() => setSnackbar(""), 2000);
  }
  function handleCopyWeekFree(period) {
    const weekStart = getWeekStart(date);
    const msg = buildWeekFreeSlots({ sessions, clients, weekStart, profissional, period });
    navigator.clipboard.writeText(msg);
    setSnackbar(`Horários livres de ${period} da semana copiados!`);
    setTimeout(() => setSnackbar(""), 2000);
  }
  function handleCopyDayFree(period) {
    const msg = buildDayFreeSlots({ sessions, date: selectedDay, profissional, period });
    navigator.clipboard.writeText(msg);
    setSnackbar(`Horários livres de ${period} do dia copiados!`);
    setTimeout(() => setSnackbar(""), 2000);
  }
  // NOVO BOTÃO: Copia horários marcados da semana + horários livres 1h da semana (em uma lista só)
  function handleCopyWeekMarkedAndFree() {
    const weekStart = getWeekStart(date);
    const msg = buildWeekMarkedAndFreeCombined({ sessions, clients, weekStart, allSessions, profissional });
    navigator.clipboard.writeText(msg);
    setSnackbar("Horários marcados + livres (1h) da semana copiados!");
    setTimeout(() => setSnackbar(""), 2000);
  }

  return (
    <>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" sx={{ mr: 2 }}>
          Profissional:
        </Typography>
        <ToggleButtonGroup
          value={profissional}
          exclusive
          onChange={(_, value) => value && setProfissional(value)}
          color="primary"
          size="small"
        >
          {PROFISSIONAIS.map(p => (
            <ToggleButton key={p.value} value={p.value}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center" }}>
        <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
          Agendar sessão
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyWeekMarked}
            size="small"
          >
            Copiar horários marcados (semana)
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyWeekFree("1h")}
            size="small"
          >
            Copiar livres 1h (semana)
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyWeekFree("1h30")}
            size="small"
          >
            Copiar livres 1h30 (semana)
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyWeekMarkedAndFree}
            size="small"
          >
            Copiar marcados + livres 1h (semana)
          </Button>
          <TextField
            type="date"
            size="small"
            value={selectedDay}
            onChange={e => setSelectedDay(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 120 }}
          />
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyDayFree("1h")}
            size="small"
          >
            Copiar livres 1h (dia)
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyDayFree("1h30")}
            size="small"
          >
            Copiar livres 1h30 (dia)
          </Button>
        </Stack>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Agendar Sessão</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, minWidth: 250 }}>
            <TextField
              label="Buscar cliente"
              variant="outlined"
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Cliente</InputLabel>
              <Select
                value={selectedClientId}
                label="Cliente"
                onChange={e => setSelectedClientId(e.target.value)}
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
              >
                {filteredClients.length === 0 && (
                  <MenuItem value="" disabled>
                    Nenhum cliente encontrado
                  </MenuItem>
                )}
                {filteredClients.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <TextField
                label="Data"
                type="date"
                fullWidth
                value={date}
                onChange={e => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputRef={dateInputRef}
              />
              <IconButton
                sx={{ ml: 1 }}
                onClick={handleOpenDatePicker}
                color="primary"
                aria-label="Abrir calendário"
              >
                <CalendarTodayIcon />
              </IconButton>
            </Box>
            {activePackages.length > 0 && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Pacote</InputLabel>
                  <Select
                    value={selectedPackageId}
                    label="Pacote"
                    onChange={e => setSelectedPackageId(e.target.value)}
                    MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                  >
                    {activePackages.map(pkg => (
                      <MenuItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {selectedPackageId && proximaSessaoPacote && totalSessaoPacote && (
                  <Typography
                    variant="caption"
                    sx={{
                      mb: 2,
                      color: "primary.main",
                      fontWeight: 500,
                      letterSpacing: 0.5,
                      display: "block"
                    }}
                  >
                    Este agendamento será a sessão {proximaSessaoPacote}/{totalSessaoPacote} do pacote
                  </Typography>
                )}
              </>
            )}

            {selectedClientId && activePackages.length === 0 && (
              <Box sx={{ mb: 1, display: "flex", justifyContent: "flex-end" }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isAvulsa}
                      onChange={e => setIsAvulsa(e.target.checked)}
                      sx={{
                        p: 0.5,
                        color: "#888",
                        "&.Mui-checked": { color: "primary.main" }
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ color: "#666" }}>
                      Sessão avulsa
                    </Typography>
                  }
                  sx={{
                    m: 0,
                    ".MuiFormControlLabel-label": { fontWeight: 400 }
                  }}
                />
              </Box>
            )}

            <Button
              variant="outlined"
              color="secondary"
              sx={{ mb: 2 }}
              onClick={() => setShowCustomHourForm(v => !v)}
            >
              {showCustomHourForm ? "Fechar horário personalizado" : "Criar horário personalizado"}
            </Button>
            {showCustomHourForm && (
              <Box sx={{ mb: 2, p: 1, bgcolor: "#f9f9f9", borderRadius: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <TextField
                    label="Novo horário (ex: 14:30)"
                    type="time"
                    size="small"
                    value={customHour}
                    onChange={e => setCustomHour(e.target.value)}
                    sx={{ width: 120 }}
                    inputProps={{ step: 300 }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleAddCustomHour}
                    disabled={!customHour}
                  >
                    Adicionar
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleSaveCustomHours}
                  >
                    Salvar
                  </Button>
                  {customHoursForDay.length > 0 && (
                    <Button
                      variant="text"
                      color="error"
                      onClick={handleClearCustomHours}
                    >
                      Limpar todos
                    </Button>
                  )}
                </Box>
                <Box sx={{ mt: 1 }}>
                  {customHoursForDay.map((h, idx) => (
                    <Box key={h} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>{h}</Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveCustomHour(h)}
                      >
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  {customHoursForDay.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Nenhum horário personalizado salvo para este dia.
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Horário</InputLabel>
              <Select
                value={selectedHour}
                label="Horário"
                onChange={e => setSelectedHour(e.target.value)}
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
              >
                {selectedPeriod
                  ? horariosLivres.length === 0
                    ? (
                      <MenuItem value="" disabled>
                        Nenhum horário disponível
                      </MenuItem>
                    )
                    : horariosLivres.map(h => (
                      <MenuItem key={h} value={h}>
                        {h}
                      </MenuItem>
                    ))
                  : (
                    <MenuItem value="" disabled>
                      Selecione o período primeiro
                    </MenuItem>
                  )}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <TextField
                label="Terapia"
                variant="outlined"
                fullWidth
                value={terapia}
                onChange={e => setTerapia(e.target.value)}
                placeholder="Digite o tipo de massagem"
              />
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Período</InputLabel>
              <Select
                value={selectedPeriod}
                label="Período"
                onChange={e => setSelectedPeriod(e.target.value)}
                MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
                disabled={activePackages.length > 0}
              >
                {periodosDisponiveis.map(p => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2, fontWeight: 600, letterSpacing: 1 }}
              onClick={agendarSessao}
            >
              Agendar
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Sessões Agendadas
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Terapia</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Pacote/Sessão</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agendadas.map(sessao => (
                <TableRow key={sessao.id}>
                  <TableCell>{sessao.clientName}</TableCell>
                  <TableCell>{sessao.date}</TableCell>
                  <TableCell>{sessao.time}</TableCell>
                  <TableCell>{sessao.massageType}</TableCell>
                  <TableCell>{sessao.period}</TableCell>
                  <TableCell>
                    {sessao.packageId
                      ? getPackageSessionText(sessao, allSessions, clients)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {sessao.status === "done" ? "Realizada" : "Agendada"}
                  </TableCell>
                  <TableCell>
                    <IconButton color="success" onClick={() => marcarComoRealizada(sessao)}>
                      <CheckCircleIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => desmarcarSessao(sessao.id)}>
                      <CancelIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {agendadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    Nenhuma sessão agendada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Confirmar Sessão
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cliente</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Terapia</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Pacote/Sessão</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {confirmar.map(sessao => (
                <TableRow key={sessao.id}>
                  <TableCell>{sessao.clientName}</TableCell>
                  <TableCell>{sessao.date}</TableCell>
                  <TableCell>{sessao.time}</TableCell>
                  <TableCell>{sessao.massageType}</TableCell>
                  <TableCell>{sessao.period}</TableCell>
                  <TableCell>
                    {sessao.packageId
                      ? getPackageSessionText(sessao, allSessions, clients)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {sessao.status === "done" ? "Realizada" : "Agendada"}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Confirmar sessão">
                      <IconButton color="success" onClick={() => marcarComoConfirmada(sessao.id)}>
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Abrir WhatsApp">
                      <IconButton color="success" onClick={() => handleOpenWhatsapp(sessao)}>
                        <WhatsAppIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copiar mensagem 1">
                      <IconButton color="primary" onClick={() => handleCopyMensagem1(sessao)}>
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Copiar mensagem 2">
                      <IconButton color="secondary" onClick={() => handleCopyMensagem2(sessao)}>
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {confirmar.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    Nenhuma sessão para confirmar
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Sessões Realizadas
          </Typography>
          <IconButton onClick={() => setShowRealizadas(v => !v)}>
            {showRealizadas ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </IconButton>
        </Box>
        <Collapse in={showRealizadas}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Hora</TableCell>
                  <TableCell>Terapia</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell>Pacote/Sessão</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {realizadas.map(sessao => (
                  <TableRow key={sessao.id}>
                    <TableCell>{sessao.clientName}</TableCell>
                    <TableCell>{sessao.date}</TableCell>
                    <TableCell>{sessao.time}</TableCell>
                    <TableCell>{sessao.massageType}</TableCell>
                    <TableCell>{sessao.period}</TableCell>
                    <TableCell>
                      {sessao.packageId
                        ? getPackageSessionText(sessao, allSessions, clients)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {sessao.status === "done" ? "Realizada" : "Agendada"}
                    </TableCell>
                    <TableCell>
                      <IconButton color="error" onClick={() => removerSessaoRealizada(sessao.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {realizadas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      Nenhuma sessão realizada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Box>
      {snackbar && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "#323232",
            color: "#fff",
            px: 3,
            py: 1,
            borderRadius: 2,
            zIndex: 9999,
            fontWeight: 500,
            fontSize: 16,
            boxShadow: 3,
          }}
        >
          {snackbar}
        </Box>
      )}
    </>
  );
}