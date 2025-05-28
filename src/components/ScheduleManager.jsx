import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, FormControlLabel, Table, TableHead, TableBody, TableRow, TableCell, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, IconButton, Collapse, Snackbar, Alert, Stack, Checkbox
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { getClients, saveClients, getSessions, saveSessions } from "../utils/storage";
import { getSessionsForPackage, getDefaultPeriodForPackage, isIndividualPackageExpired } from "../utils/packageUtils";
import { format, startOfWeek, addDays, parseISO, isValid, compareAsc } from "date-fns";

const SESSION_BUFFER = 15;

// --- Funções utilitárias ---

function getTotalSessionsUsed(client, pkg, sessions) {
  const initialUsed = pkg.sessionsUsed ?? 0;
  const doneInSystem = sessions.filter(
    s => s.clientId === client.id && s.packageId === pkg.id && s.status === "done"
  ).length;
  return initialUsed + doneInSystem;
}

function getStoredTimeSlots() {
  const stored = localStorage.getItem("agenda_time_slots");
  if (stored) return JSON.parse(stored);
  const week = [];
  for (let i = 0; i < 6; i++) {
    const start = 8;
    const end = i === 5 ? 16 : 20; // Sábado até 16:10
    const slots = [];
    let minutes = start * 60;
    const endMinutes = end * 60 + SESSION_BUFFER;
    while (minutes <= endMinutes) {
      const hour = Math.floor(minutes / 60);
      const min = minutes % 60;
      slots.push(`${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
      minutes += 70;
    }
    week.push(slots);
  }
  return week;
}

// --------- CUSTOM SLOTS --------
function getCustomSlotsForDate(date) {
  const customSlots = JSON.parse(localStorage.getItem("custom_slots_by_date") || "{}");
  return customSlots[date] || null;
}
function setCustomSlotsForDate(date, slots) {
  const customSlots = JSON.parse(localStorage.getItem("custom_slots_by_date") || "{}");
  if (slots && slots.length > 0) {
    customSlots[date] = slots;
  } else {
    delete customSlots[date];
  }
  localStorage.setItem("custom_slots_by_date", JSON.stringify(customSlots));
}
// --------- END CUSTOM SLOTS --------

function getSessionDurationWithBuffer(period) {
  if (period === "30min") return 30;
  if (period === "1h")    return 60;
  if (period === "1h30")  return 90;
  if (period === "2h")    return 120;
  const match = period.match(/(\d+)h(?:(\d+))?/);
  if (match) {
    return parseInt(match[1],10)*60 + parseInt(match[2]||"0",10);
  }
  return 60;
}
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
function padTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}
function getWeekDates(startDate) {
  return Array.from({length: 6}, (_, i) => addDays(startDate, i));
}
function weekdayLabel(date) {
  const weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return `${weekdays[date.getDay() - 1]} (${format(date, "dd/MM")})`;
}
function compareSessions(a, b) {
  const aDate = isValid(parseISO(a.date)) ? parseISO(a.date) : null;
  const bDate = isValid(parseISO(b.date)) ? parseISO(b.date) : null;
  if (!aDate && bDate) return 1;
  if (aDate && !bDate) return -1;
  if (!aDate && !bDate) return 0;
  if (a.date !== b.date) return compareAsc(aDate, bDate);
  if (a.time && b.time) {
    return timeToMinutes(a.time) - timeToMinutes(b.time);
  }
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return 0;
}

// NOVA LÓGICA PARA INCLUIR HORÁRIOS PERSONALIZADOS, MAS CONSIDERAR TODOS OS SLOTS, BLOQUEANDO-OS SE CONFLITAREM
function getDefaultDaySlots(dow) {
  // dow: 0=segunda, 5=sabado
  const start = 8;
  const end = dow === 5 ? 16 : 20; // Sábado até 16:10
  const slots = [];
  let minutes = start * 60;
  const endMinutes = end * 60 + 15;
  while (minutes <= endMinutes) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    slots.push(`${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`);
    minutes += 70;
  }
  return slots;
}

// Retorna quais períodos (duração) cabem para um slot considerando os agendamentos já marcados
function getValidPeriodsForSlot(date, slot, sessions) {
  // Checa o próximo agendamento depois desse slot
  const PERIOD_OPTIONS = ["30min", "1h", "1h30", "2h"];
  const slotMinutes = timeToMinutes(slot);
  const daySessions = sessions
    .filter(s => s.date === date && (s.status === "scheduled" || s.status === "done"))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  // Próximo agendamento depois desse horário
  let nextSessionStart = 24 * 60; // default: fim do dia
  for (const s of daySessions) {
    if (s.time && timeToMinutes(s.time) > slotMinutes) {
      nextSessionStart = Math.min(nextSessionStart, timeToMinutes(s.time));
    }
  }
  // Para cada período, só entra se slot+dur <= inicio do próximo agendamento OU não colide com nenhum
  return PERIOD_OPTIONS.filter(periodOpt => {
    const dur = getSessionDurationWithBuffer(periodOpt);
    // Checa se cabe antes do próximo agendamento
    if ((slotMinutes + dur) > nextSessionStart) return false;
    // Checa se conflita com sessões já marcadas
    for (const s of daySessions) {
      if (!s.time || !s.period) continue;
      const sStart = timeToMinutes(s.time);
      const sEnd = sStart + getSessionDurationWithBuffer(s.period);
      const slotEnd = slotMinutes + dur;
      if (slotMinutes < sEnd && slotEnd > sStart) return false;
    }
    return true;
  });
}


function getAvailableTimesForPeriod(date, sessions, _, period = "1h") {
  const d = new Date(date + "T00:00:00");
  const dow = d.getDay();
  if (dow === 0 || dow > 6) return [];
  const startExpediente = 480;
  const endExpediente = [1215, 1215, 1215, 1215, 1215, 975][dow - 1];
  const sessionDuration = getSessionDurationWithBuffer(period);

  // Sessões ordenadas
  const daySessions = sessions
    .filter(s => s.date === date && (s.status === "scheduled" || s.status === "done"))
    .map(s => ({
      ...s,
      start: timeToMinutes(s.time),
      end: timeToMinutes(s.time) + getSessionDurationWithBuffer(s.period)
    }))
    .sort((a, b) => a.start - b.start);

  let freeSlots = [];

  // Função auxiliar para inserir slots em um intervalo de [start, end]
  function fillSlotsInInterval(windowStart, windowEnd) {
    let slot = windowStart;
    while (slot + sessionDuration <= windowEnd) {
      freeSlots.push(minutesToTime(slot));
      slot += 70;
    }
  }

  if (daySessions.length === 0) {
    // Nenhuma sessão: slots de 8:00 até expediente
    fillSlotsInInterval(startExpediente, endExpediente);
  } else {
    // Antes da primeira sessão
    fillSlotsInInterval(startExpediente, daySessions[0].start - 15);

    // Entre as sessões
    for (let i = 0; i < daySessions.length - 1; i++) {
      const endCurr = daySessions[i].end;
      const startNext = daySessions[i + 1].start;
      // Janela livre é: [endCurr+10, startNext-10]
      fillSlotsInInterval(endCurr + 15, startNext - 15);
    }

    // Após a última sessão
    fillSlotsInInterval(daySessions[daySessions.length - 1].end + 15, endExpediente);
  }

  // Adiciona horários personalizados, se houver para o dia
  const customSlots = getCustomSlotsForDate(date) || [];
  for (const custom of customSlots) {
    if (!freeSlots.includes(padTime(custom))) {
      freeSlots.push(padTime(custom));
    }
  }

  freeSlots = Array.from(new Set(freeSlots)).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  return freeSlots;
}

function getWeekAvailableTimesForPeriod(sessions, timeSlotsByDay, weekStart, period) {
  const weekDates = Array.from({length: 6}, (_, i) => addDays(weekStart, i));
  let result = "";
  weekDates.forEach(date => {
    const dateStr = format(date, "yyyy-MM-dd");
    const label = weekdayLabel(date);
    const times = getAvailableTimesForPeriod(dateStr, sessions, timeSlotsByDay, period);
    if (times.length > 0) {
      result += `${label}\n${times.join("\n")}\n\n`;
    }
  });
  return result.trim();
}

// NOVA FUNÇÃO: Copia apenas horários MARCADOS da semana
function buildWhatsappMarkedSessionsOnly({clients, sessions, weekStart}) {
  const weekDates = getWeekDates(weekStart);
  let msg = "";
  for (const date of weekDates) {
    const dayLabel = weekdayLabel(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const markedDaySessions = sessions
      .filter(s => (s.status === "scheduled" || s.status === "done") && s.date === dateStr)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    if (markedDaySessions.length === 0) continue;
    msg += `${dayLabel}\n`;
    for (const s of markedDaySessions) {
      let line = `${s.time} ${s.clientName || ""}`;
      if (s.period) line += ` ${s.period}`;
      if (s.package && s.packageId) {
        const client = getClientById(clients, s.clientId);
        line += ` ${getPackageSessionDisplay(client, s.packageId, sessions, s.id)}`;
      }
      if (s.massageType && !s.package) line += ` (${s.massageType})`;
      msg += line + "\n";
    }
    msg += "\n";
  }
  return msg.trim();
}

function buildWhatsappMessage({clients, sessions, timeSlotsByDay, weekStart}) {
  // MANTÉM a função antiga para os botões antigos
  const weekDates = getWeekDates(weekStart);
  let msg = "";
  for (const date of weekDates) {
    const dayLabel = weekdayLabel(date);
    const dateStr = format(date, "yyyy-MM-dd");
    msg += `${dayLabel}\n`;
    const daySessions = sessions
      .filter(s => (s.status === "scheduled" || s.status === "done") && s.date === dateStr)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    const customSlots = getCustomSlotsForDate(dateStr) || [];
    const slots = (timeSlotsByDay[date.getDay() - 1] || []);
    const allSlots = Array.from(new Set([...slots, ...customSlots.map(padTime)])).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    if (daySessions.length === 0) {
      for (const slot of allSlots) {
        msg += `${padTime(slot)}\n`;
      }
      msg += "\n";
      continue;
    }
    for (const s of daySessions) {
      let line = `${s.time} ${s.clientName || ""}`;
      if (s.period) line += ` ${s.period}`;
      if (s.package && s.packageId) {
        const client = getClientById(clients, s.clientId);
        line += ` ${getPackageSessionDisplay(client, s.packageId, sessions, s.id)}`;
      }
      if (s.massageType && !s.package) line += ` (${s.massageType})`;
      msg += line + "\n";
    }
    // Mostra os horários livres do dia (considerando bloqueio de 70min para slots personalizados)
    const freeSlots = getAvailableTimesForPeriod(dateStr, sessions, timeSlotsByDay, "1h");
    for (const slot of freeSlots) {
      if (
        !daySessions.some(s => s.time === padTime(slot))
      ) {
        msg += `${padTime(slot)}\n`;
      }
    }
    msg += "\n";
  }
  return msg.trim();
}
function getClientById(clients, clientId) {
  return clients.find(c => c.id === clientId);
}
function getWhatsappLink(phone) {
  if (!phone) return null;
  let num = phone.replace(/\D/g, "");
  if (num.length === 11 && !num.startsWith("55")) num = "55" + num;
  if (num.length === 13 && num.startsWith("550")) num = "55" + num.slice(2);
  return `https://wa.me/${num}`;
}
function formatSessionWhatsappMessage({client, session, sessionNumber}) {
  const dateObj = session.date ? parseISO(session.date) : null;
  const weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const weekday = dateObj ? weekdays[dateObj.getDay() - 1] : "";
  const dateStr = dateObj ? format(dateObj, "dd/MM") : "";

  let msg = `Segue a confirmação do seu agendamento:
Terapia: ${session.massageType || "-"} | ${session.period || "-"}
Data: ${weekday} (${dateStr})
Horário: ${session.time || "-"}`;

  if (session.package && session.packageId && client) {
    msg += `\nSessão ${getPackageSessionDisplay(client, session.packageId, client.sessions || [], session.id)}`;
  }

  msg += `
Terapeuta: Letícia
Le Renovare | Open Mall The Square- Sala 424 | Bloco E- Ao lado do carrefour 
Rod. Raposo Tavares, KM 22

🙏🏼🍃✨`;
  return msg;
}
function formatSessionWhatsappConfirmMessage({session}) {
  const dateObj = session.date ? parseISO(session.date) : null;
  const weekdays = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const weekday = dateObj ? weekdays[dateObj.getDay() - 1] : "";
  const dateStr = dateObj ? format(dateObj, "dd/MM") : "";
  let msg = `Oii, aqui é a Lari e estou ajudando a Lê com a agenda de atendimentos🍃✨

Passando para confirmar sua sessão:
Dia: ${weekday}${dateObj && dateStr ? ` (${dateStr})` : ""}
Horário: ${session.time || "-"}
Local: Le Renovare | Open Mall The Square- Sala 424 | Bloco E- Ao lado do carrefour 

Posso confirmar? Aguardamos seu retorno.💆🏼‍♀️💖`;
  return msg;
}

// ALTERAÇÃO: esta função agora ignora sessões canceladas e mostra o número correto da sessão
function getPackageSessionDisplay(client, pkgId, sessions, sessionId) {
  if (!pkgId || !client) return "-";
  const pkgObj = client.packages?.find(p => p.id === pkgId);
  if (!pkgObj) return "-";
  const total = getSessionsForPackage(pkgObj.name || "");
  const sessionsUsedBase = pkgObj.sessionsUsed ?? 0;
  const allSessions = sessions
    .filter(
      s =>
        s.clientId === client.id &&
        s.packageId === pkgId &&
        (s.status === "scheduled" || s.status === "done")
    )
    .sort((a, b) => {
      const aDate = isValid(parseISO(a.date)) ? parseISO(a.date) : null;
      const bDate = isValid(parseISO(b.date)) ? parseISO(b.date) : null;
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      if (!aDate && !bDate) return 0;
      if (a.date !== b.date) return compareAsc(aDate, bDate);
      if (a.time && b.time) {
        return timeToMinutes(a.time) - timeToMinutes(b.time);
      }
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return 0;
    });
  const idx = allSessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return "-";
  // Soma a base sessionsUsed ao índice atual (idx + 1)
  return `${sessionsUsedBase + idx + 1}/${total}`;
}

// --- COMPONENTE PRINCIPAL ---
export default function ScheduleManager() {
  // ADICIONADO: state para agendamento avulso
  const [isAvulsa, setIsAvulsa] = useState(true);

  useEffect(() => {
    const updateSlots = () => setTimeSlotsByDay(getStoredTimeSlots());
    window.addEventListener("storage", updateSlots);
    return () => window.removeEventListener("storage", updateSlots);
  }, []);

  const PERIOD_OPTIONS = ["30min", "1h", "1h30", "2h"];
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState({
    id: null,
    clientId: "",
    clientName: "",
    date: "",
    time: "",
    massageType: "",
    period: "",
    package: null,
    packageSession: null,
    packageId: null,
    status: "scheduled"
  });
  const [selectDay, setSelectDay] = useState("");
  const [timeSlotsByDay, setTimeSlotsByDay] = useState(getStoredTimeSlots());
  useEffect(() => {
    const updateSlots = () => setTimeSlotsByDay(getStoredTimeSlots());
    window.addEventListener("storage", updateSlots);
    return () => window.removeEventListener("storage", updateSlots);
  }, []);
  const [availableHours, setAvailableHours] = useState([]);
  const [activePackages, setActivePackages] = useState([]);
  const [nextSessionNumber, setNextSessionNumber] = useState(null);
  const [showRealized, setShowRealized] = useState(true);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarText, setSnackbarText] = useState("Horários copiados para a área de transferência!");
  const [showConfirmList, setShowConfirmList] = useState(true);
  const scheduledSessions = sessions.filter(s => s.status === "scheduled").sort(compareSessions);
  const realizedSessions = sessions.filter(s => s.status === "done").sort(compareSessions);
  const [confirmList, setConfirmList] = useState([]);

  // ----------- NOVOS STATES para HORÁRIO PERSONALIZADO -----------
  const [customTimeInput, setCustomTimeInput] = useState("");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customSlotsForDay, setCustomSlotsForDay] = useState([]);
  const [customInputError, setCustomInputError] = useState("");

  // Estado para períodos válidos no horário selecionado
  const [validPeriods, setValidPeriods] = useState(PERIOD_OPTIONS);

  useEffect(() => {
    setClients(getClients());
    setSessions(getSessions());
    setTimeSlotsByDay(getStoredTimeSlots());
  }, []);
  useEffect(() => {
    setConfirmList(prev =>
      scheduledSessions.map(s => {
        const checkedObj = prev.find(ss => ss.id === s.id);
        return checkedObj ? { ...s, checked: checkedObj.checked } : { ...s, checked: false };
      })
    );
  }, [sessions]);
  const handleCheckConfirm = (sessId) => {
    setConfirmList(list =>
      list.map(s => s.id === sessId ? { ...s, checked: !s.checked } : s)
    );
  };
  const handleRemoveConfirm = (sessId) => {
    setConfirmList(list => list.filter(s => s.id !== sessId));
  };
  useEffect(() => {
    const handleStorage = () => {
      setClients(getClients());
      setSessions(getSessions());
      setTimeSlotsByDay(getStoredTimeSlots());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  useEffect(() => {
    if (session.date) {
      const custom = getCustomSlotsForDate(session.date);
      setCustomSlotsForDay(custom || []);
      setShowCustomTime(!!(custom && custom.length > 0));
    } else {
      setCustomSlotsForDay([]);
      setShowCustomTime(false);
    }
    setCustomTimeInput("");
    setCustomInputError("");
  }, [session.date, open]);
  useEffect(() => {
    let data = session.date;
    if (!data) {
      data = format(new Date(), "yyyy-MM-dd");
    }
    setAvailableHours(getAvailableTimesForPeriod(data, sessions, timeSlotsByDay, session.period || "1h"));
  }, [session.date, sessions, timeSlotsByDay, session.period, customSlotsForDay]);
  useEffect(() => {
    if (session.clientId) {
      const client = clients.find(c => c.id === session.clientId);
      if (client && Array.isArray(client.packages)) {
        const pkgs = client.packages.filter(pkg => !isIndividualPackageExpired(pkg));
        setActivePackages(pkgs);
        if (pkgs.length === 1) {
          setSession(s => ({
            ...s,
            packageId: pkgs[0].id,
            package: pkgs[0].name,
            period: getDefaultPeriodForPackage(pkgs[0].name)
          }));
        } else {
          setSession(s => ({
            ...s,
            packageId: "",
            package: "",
            period: ""
          }));
        }
      } else {
        setActivePackages([]);
        setSession(s => ({
          ...s,
          packageId: "",
          package: "",
          period: ""
        }));
      }
    } else {
      setActivePackages([]);
      setSession(s => ({
        ...s,
        packageId: "",
        package: "",
        period: ""
      }));
    }
  }, [session.clientId, clients]);

  // Sempre ativa opção avulsa se não houver pacote
  useEffect(() => {
    if (activePackages.length === 0) {
      setIsAvulsa(true);
    } else {
      setIsAvulsa(false);
    }
  }, [activePackages.length]);

  useEffect(() => {
    if (session.packageId && activePackages.length > 0) {
      const pkg = activePackages.find(p => p.id === session.packageId);
      setSession(s => ({
        ...s,
        package: pkg ? pkg.name : "",
        period: pkg ? getDefaultPeriodForPackage(pkg.name) : ""
      }));
      setNextSessionNumber(pkg && pkg.sessionsUsed !== undefined ? pkg.sessionsUsed : 0);
    } else {
      setNextSessionNumber(null);
    }
  }, [session.packageId, activePackages]);

  // Atualiza os períodos válidos quando data/hora mudam
  useEffect(() => {
    if (session.date && session.time) {
      setValidPeriods(getValidPeriodsForSlot(session.date, session.time, sessions));
      // Se não houver pacote selecionado, limpa o período se não for válido
      if (!session.packageId && !getValidPeriodsForSlot(session.date, session.time, sessions).includes(session.period)) {
        setSession(s => ({ ...s, period: "" }));
      }
      // Se houver pacote, sempre mantém o período do pacote
      if (session.packageId && activePackages.length > 0) {
        const pkg = activePackages.find(p => p.id === session.packageId);
        if (pkg) {
          setSession(s => ({
            ...s,
            period: getDefaultPeriodForPackage(pkg.name)
          }));
        }
      }
    } else {
      setValidPeriods(PERIOD_OPTIONS);
    }
  // eslint-disable-next-line
  }, [session.date, session.time, sessions, session.packageId, activePackages]);

  const handleOpen = () => {
    setSession({
      id: null,
      clientId: "",
      clientName: "",
      date: "",
      time: "",
      massageType: "",
      period: "",
      package: null,
      packageSession: null,
      packageId: null,
      status: "scheduled"
    });
    setOpen(true);
    setNextSessionNumber(null);
    // Deixa isAvulsa ativado se não houver pacote ativo
    setIsAvulsa(activePackages.length === 0);
  };
  const handleChange = (e) => {
    setSession({ ...session, [e.target.name]: e.target.value });
  };
  const handleDateChange = (e) => {
    setSession({ ...session, date: e.target.value, time: "", period: "" });
  };
  const handleClientChange = (e) => {
    const cid = e.target.value;
    setSession(s => ({
      id: null,
      clientId: cid,
      clientName: clients.find(c => c.id === cid)?.name || "",
      date: "",
      time: "",
      massageType: "",
      period: "",
      package: null,
      packageSession: null,
      packageId: null,
      status: "scheduled"
    }));
    setNextSessionNumber(null);
    // isAvulsa será setado pelo useEffect acima
  };
  const handlePackageChange = (e) => {
    const pkgId = e.target.value;
    setSession(s => {
      const pkg = activePackages.find(p => p.id === pkgId);
      setNextSessionNumber(pkg && pkg.sessionsUsed !== undefined ? pkg.sessionsUsed : 0);
      return {
        ...s,
        packageId: pkgId,
        package: pkg ? pkg.name : "",
        period: pkg ? getDefaultPeriodForPackage(pkg.name) : ""
      };
    });
  };

  const isSessionValid = () => {
    const data = session.date || format(new Date(), "yyyy-MM-dd");
    if (activePackages.length === 0) {
      // Cliente sem pacote: só pode salvar se marcado como avulsa (vem ativado!)
      return (
        session.clientId &&
        data &&
        session.time &&
        session.massageType &&
        session.period &&
        isAvulsa
      );
    }
    // Cliente com pacote: só pode salvar se selecionou pacote
    return (
      session.clientId &&
      data &&
      session.time &&
      session.massageType &&
      session.period &&
      session.packageId
    );
  };

  const handleSave = () => {
    if (!isSessionValid()) return;
    let updatedClients = [...clients];
    let pkgSessionNumber = null;
    const data = session.date || format(new Date(), "yyyy-MM-dd");
    if (session.packageId) {
      const clientIdx = updatedClients.findIndex(c => c.id === session.clientId);
      if (clientIdx !== -1 && Array.isArray(updatedClients[clientIdx].packages)) {
        const pkgIdx = updatedClients[clientIdx].packages.findIndex(p => p.id === session.packageId);
        if (pkgIdx !== -1) {
          pkgSessionNumber = updatedClients[clientIdx].packages[pkgIdx].sessionsUsed || 0;
        }
      }
      saveClients(updatedClients);
    }
    const newSession = {
      ...session,
      id: Date.now(),
      date: data,
      time: padTime(session.time),
      status: "scheduled",
      packageSession: pkgSessionNumber,
      isAvulsa: isAvulsa || false // <-- salva o campo avulsa
    };
    const updatedSessions = [...sessions, newSession];
    setClients(updatedClients);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);
    setOpen(false);
    setNextSessionNumber(null);
    setIsAvulsa(activePackages.length === 0);
  };

  // ----------- FUNÇÕES PARA SLOT PERSONALIZADO -----------
  function handleAddCustomTime() {
    if (!customTimeInput.match(/^\d{2}:\d{2}$/)) {
      setCustomInputError("Formato deve ser HH:mm");
      return;
    }
    if (customSlotsForDay.includes(customTimeInput)) {
      setCustomInputError("Horário já adicionado");
      return;
    }
    const newSlots = [...customSlotsForDay, customTimeInput].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    setCustomSlotsForDay(newSlots);
    setCustomTimeInput("");
    setCustomInputError("");
    setShowCustomTime(true);
  }
  function handleRemoveCustomTime(slot) {
    const newSlots = customSlotsForDay.filter(s => s !== slot);
    setCustomSlotsForDay(newSlots);
    setCustomInputError("");
    if (newSlots.length === 0) {
      setShowCustomTime(false);
    }
  }
  function handleSaveCustomSlots() {
    if (customSlotsForDay.length > 0) {
      setCustomSlotsForDate(session.date, customSlotsForDay);
    } else {
      setCustomSlotsForDate(session.date, []);
    }
    setAvailableHours(getAvailableTimesForPeriod(session.date, sessions, timeSlotsByDay, session.period || "1h"));
    setSnackbarText("Horários personalizados salvos!");
    setShowSnackbar(true);
  }
  function handleClearCustomSlots() {
    setCustomSlotsForDate(session.date, []);
    setCustomSlotsForDay([]);
    setShowCustomTime(false);
    setAvailableHours(getAvailableTimesForPeriod(session.date, sessions, timeSlotsByDay, session.period || "1h"));
    setSnackbarText("Horários personalizados removidos!");
    setShowSnackbar(true);
  }

  const handleMarkAsDone = (sessId) => {
    const updated = sessions.map(s =>
      s.id === sessId ? { ...s, status: "done" } : s
    );
    setSessions(updated);
    saveSessions(updated);
  };
  const handleCancelSession = (sessId) => {
    const sess = sessions.find(s => s.id === sessId);
    if (sess && sess.status === "done" && sess.packageId) {
      let updatedClients = getClients().map(c => {
        if (c.id !== sess.clientId) return c;
        if (!c.packages || !Array.isArray(c.packages)) return c;
        const pkgs = c.packages.map(pkg => {
          if (pkg.id !== sess.packageId) return pkg;
          const alreadyUsed =
            sessions.filter(
              s =>
                s.clientId === c.id &&
                s.packageId === pkg.id &&
                s.status === "done" &&
                s.id !== sessId
            ).length;
          return { ...pkg, sessionsUsed: alreadyUsed };
        });
        return {
          ...c,
          packages: pkgs,
          package: pkgs[0]?.name || "",
          packageValidity: pkgs[0]?.validity || "",
          packageSession: pkgs[0]?.sessionsUsed || 0
        };
      });
      setClients(updatedClients);
      saveClients(updatedClients);
    }
    const updated = sessions.map(s =>
      s.id === sessId ? { ...s, status: "cancelled" } : s
    );
    setSessions(updated);
    saveSessions(updated);
  };
  const handleRemoveRealized = (sessId) => {
    const updated = sessions.filter(s => s.id !== sessId);
    setSessions(updated);
    saveSessions(updated);
  };
  const handleCopyWeekPeriod = (period) => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const msg = getWeekAvailableTimesForPeriod(sessions, timeSlotsByDay, weekStart, period);
    navigator.clipboard.writeText(msg);
    setSnackbarText("Horários copiados para a área de transferência!");
    setShowSnackbar(true);
  };
  const handleCopyDayPeriod = (period) => {
    const data = selectDay || format(new Date(), "yyyy-MM-dd");
    const label = weekdayLabel(new Date(data + "T00:00:00"));
    const times = getAvailableTimesForPeriod(data, sessions, timeSlotsByDay, period);
    const msg = `${label}\n${times.join("\n")}`;
    navigator.clipboard.writeText(msg);
    setSnackbarText("Horários copiados para a área de transferência!");
    setShowSnackbar(true);
  };
  const handleCopyWeek = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const msg = buildWhatsappMarkedSessionsOnly({
      clients,
      sessions,
      weekStart,
    });
    navigator.clipboard.writeText(msg);
    setSnackbarText("Horários marcados copiados para a área de transferência!");
    setShowSnackbar(true);
  };
  function sessionDisplayTable(pkgName, pkgSession, client, pkgId, sessionId) {
    if (!pkgName || !pkgId || !client) return "-";
    return getPackageSessionDisplay(client, pkgId, sessions, sessionId);
  }
  function nextSessionDisplay(pkgName, sessionNumber) {
    if (!pkgName || sessionNumber === null || sessionNumber === undefined) return "-";
    const total = getSessionsForPackage(pkgName);
    const current = sessionNumber + 1;
    return `${current}/${total}`;
  }
  const handleCopyWhatsappMessage = (sess) => {
    const client = getClientById(clients, sess.clientId);
    let sessionNumber = null;
    if (sess.package && sess.packageId && client) {
      const allSessions = sessions
        .filter(
          s =>
            s.clientId === client.id &&
            s.packageId === sess.packageId &&
            (s.status === "scheduled" || s.status === "done")
        )
        .sort(compareSessions);
      const idx = allSessions.findIndex(s => s.id === sess.id);
      sessionNumber = idx;
    }
    const msg = formatSessionWhatsappMessage({
      client,
      session: sess,
      sessionNumber: sessionNumber
    });
    navigator.clipboard.writeText(msg);
    setSnackbarText("Mensagem da sessão copiada para a área de transferência!");
    setShowSnackbar(true);
  };
  const handleCopyWhatsappConfirmMessage = (sess) => {
    const msg = formatSessionWhatsappConfirmMessage({ session: sess });
    navigator.clipboard.writeText(msg);
    setSnackbarText("Mensagem de confirmação copiada para a área de transferência!");
    setShowSnackbar(true);
  };
  return (
    <Box>
      <Box sx={{display: "flex", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1}}>
        <Typography variant="h5" sx={{ flex: 1 }}>Agendar Sessão</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopyWeek}
            size="small"
          >
            Copiar horários p/ WhatsApp
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyWeekPeriod("1h")}
            size="small"
          >
            Copiar horários 1h (semana)
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyWeekPeriod("1h30")}
            size="small"
          >
            Copiar horários 1h30 (semana)
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ ml: 2 }}>
          <TextField
            type="date"
            size="small"
            value={selectDay}
            onChange={e => setSelectDay(e.target.value)}
            InputLabelProps={{ shrink: true }}
            label=""
            sx={{ minWidth: 120 }}
          />
          <Button
            variant="outlined"
            color="primary"
            startIcon={<CalendarMonthIcon />}
            onClick={() => setSelectDay(format(new Date(), "yyyy-MM-dd"))}
            size="small"
          >
            Hoje
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyDayPeriod("1h")}
            size="small"
          >
            Copiar horários 1h (dia)
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopyDayPeriod("1h30")}
            size="small"
          >
            Copiar horários 1h30 (dia)
          </Button>
        </Stack>
        <Button
          variant="contained"
          color="primary"
          sx={{ ml: 2 }}
          onClick={handleOpen}
        >
          Nova Sessão
        </Button>
      </Box>
      <Snackbar
        open={showSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setShowSnackbar(false)} severity="success" sx={{ width: '100%' }}>
          {snackbarText}
        </Alert>
      </Snackbar>
      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>Sessões Marcadas</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Cliente</TableCell>
            <TableCell>Data</TableCell>
            <TableCell>Hora</TableCell>
            <TableCell>Tipo de Massagem</TableCell>
            <TableCell>Período</TableCell>
            <TableCell>Pacote/Sessão</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {scheduledSessions.map(s => {
            const client = getClientById(clients, s.clientId);
            return (
              <TableRow key={s.id}>
                <TableCell>{s.clientName || "-"}</TableCell>
                <TableCell>{s.date || "-"}</TableCell>
                <TableCell>{s.time || "-"}</TableCell>
                <TableCell>{s.massageType || "-"}</TableCell>
                <TableCell>{s.period || "-"}</TableCell>
                <TableCell>
                  {sessionDisplayTable(s.package, s.packageSession, client, s.packageId, s.id)}
                </TableCell>
                <TableCell>Marcada</TableCell>
                <TableCell>
                  <Button variant="outlined" size="small" onClick={() => handleMarkAsDone(s.id)}>
                    Marcar como realizada
                  </Button>
                  <Button variant="outlined" size="small" color="error" sx={{ ml: 1 }} onClick={() => handleCancelSession(s.id)}>
                    Desmarcar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Box sx={{ display: "flex", alignItems: "center", mt: 4, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Confirmar Sessões</Typography>
        <IconButton onClick={() => setShowConfirmList(v => !v)} aria-label={showConfirmList ? "Ocultar" : "Mostrar"}>
          {showConfirmList ? <VisibilityOffIcon /> : <VisibilityIcon />}
        </IconButton>
      </Box>
      <Collapse in={showConfirmList}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Confirmar</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Hora</TableCell>
              <TableCell>Tipo de Massagem</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Pacote/Sessão</TableCell>
              <TableCell>WhatsApp</TableCell>
              <TableCell>Remover</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {confirmList.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">Nenhuma sessão a confirmar</TableCell>
              </TableRow>
            )}
            {confirmList.map(s => {
              const client = getClientById(clients, s.clientId);
              const whatsappLink = client ? getWhatsappLink(client.phone) : null;
              return (
                <TableRow key={s.id}>
                  <TableCell>
                    <Checkbox
                      icon={<RadioButtonUncheckedIcon fontSize="small"/>}
                      checkedIcon={<CheckCircleIcon fontSize="small"/>}
                      checked={!!s.checked}
                      onChange={() => handleCheckConfirm(s.id)}
                      color="success"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{s.clientName || "-"}</TableCell>
                  <TableCell>{s.date || "-"}</TableCell>
                  <TableCell>{s.time || "-"}</TableCell>
                  <TableCell>{s.massageType || "-"}</TableCell>
                  <TableCell>{s.period || "-"}</TableCell>
                  <TableCell>
                    {sessionDisplayTable(s.package, s.packageSession, client, s.packageId, s.id)}
                  </TableCell>
                  <TableCell>
                    {whatsappLink && (
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="success"
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ p: 0.5 }}
                        >
                          <WhatsAppIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyWhatsappMessage(s)}
                          sx={{ p: 0.5 }}
                          title="Copiar Msg 1"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyWhatsappConfirmMessage(s)}
                          sx={{ p: 0.5 }}
                          title="Copiar Msg 2"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton aria-label="Remover" color="error" onClick={() => handleRemoveConfirm(s.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Collapse>
      <Box sx={{ display: "flex", alignItems: "center", mt: 4, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Sessões Realizadas</Typography>
        <IconButton onClick={() => setShowRealized(v => !v)} aria-label={showRealized ? "Ocultar" : "Mostrar"}>
          {showRealized ? <VisibilityOffIcon /> : <VisibilityIcon />}
        </IconButton>
      </Box>
      <Collapse in={showRealized}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Hora</TableCell>
              <TableCell>Tipo de Massagem</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Pacote/Sessão</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Ações</TableCell>
              <TableCell>WhatsApp</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {realizedSessions.map(s => {
              const client = getClientById(clients, s.clientId);
              const whatsappLink = client ? getWhatsappLink(client.phone) : null;
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.clientName || "-"}</TableCell>
                  <TableCell>{s.date || "-"}</TableCell>
                  <TableCell>{s.time || "-"}</TableCell>
                  <TableCell>{s.massageType || "-"}</TableCell>
                  <TableCell>{s.period || "-"}</TableCell>
                  <TableCell>
                    {sessionDisplayTable(s.package, s.packageSession, client, s.packageId, s.id)}
                  </TableCell>
                  <TableCell>Realizada</TableCell>
                  <TableCell>
                    <IconButton aria-label="Remover" color="error" onClick={() => handleRemoveRealized(s.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    {whatsappLink && (
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                        <IconButton
                          size="small"
                          color="success"
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ p: 0.5 }}
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyWhatsappMessage(s)}
                          sx={{ p: 0.5 }}
                          title="Copiar Msg 1"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyWhatsappConfirmMessage(s)}
                          sx={{ p: 0.5 }}
                          title="Copiar Msg 2"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Collapse>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Nova Sessão</DialogTitle>
        <DialogContent sx={{ minWidth: 350, display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl>
            <InputLabel>Cliente</InputLabel>
            <Select
              name="clientId"
              value={session.clientId}
              label="Cliente"
              onChange={handleClientChange}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* ADICIONADO: opção avulsa, já ativado se não houver pacote ativo */}
          {activePackages.length === 0 && (
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAvulsa}
                    onChange={e => setIsAvulsa(e.target.checked)}
                  />
                }
                label="Agendamento Avulso (sem pacote)"
              />
              {isAvulsa && (
                <Typography variant="caption" color="primary">
                  Será registrada como sessão avulsa (valor será somado no montante financeiro).
                </Typography>
              )}
            </Box>
          )}
          {activePackages.length > 0 && (
            <FormControl>
              <InputLabel>Pacote</InputLabel>
              <Select
                name="packageId"
                value={session.packageId || ""}
                label="Pacote"
                onChange={handlePackageChange}
              >
                {activePackages.map(pkg =>
                  <MenuItem key={pkg.id} value={pkg.id}>{pkg.name}</MenuItem>
                )}
              </Select>
            </FormControl>
          )}
          {session.package && nextSessionNumber !== null && (
            <Typography variant="body2">
              Pacote: <b>{session.package}</b> — Próxima sessão deste pacote: <b>{nextSessionDisplay(session.package, nextSessionNumber)}</b>
            </Typography>
          )}
          <TextField
            label="Data"
            name="date"
            type="date"
            value={session.date || format(new Date(), "yyyy-MM-dd")}
            onChange={handleDateChange}
            InputLabelProps={{ shrink: true }}
          />

          {/* =========== SLOT PERSONALIZADO UI ============ */}
          <Box sx={{ mt: 1, p: 1, border: "1px solid #eee", borderRadius: 1, bgcolor: "#f9f9f9" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Horários personalizados para este dia
            </Typography>
            {showCustomTime && (
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", rowGap: 1 }}>
                {customSlotsForDay.map(slot => (
                  <Box key={slot} sx={{ display: "flex", alignItems: "center", bgcolor: "#fff", px: 1, py: 0.5, borderRadius: 1, border: "1px solid #ccc", mr: 1, mb: 1 }}>
                    <Typography variant="body2">{slot}</Typography>
                    <IconButton
                      aria-label="Remover"
                      color="error"
                      size="small"
                      sx={{ ml: 0.5 }}
                      onClick={() => handleRemoveCustomTime(slot)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <TextField
                label="Adicionar horário (HH:mm)"
                size="small"
                value={customTimeInput}
                onChange={e => setCustomTimeInput(e.target.value)}
                error={!!customInputError}
                helperText={customInputError}
                placeholder="Ex: 14:30"
                inputProps={{ maxLength: 5 }}
                sx={{ width: 120 }}
              />
              <Button variant="outlined" size="small" onClick={handleAddCustomTime}>
                Adicionar
              </Button>
              <Button
                variant="contained"
                size="small"
                color="success"
                onClick={handleSaveCustomSlots}
                disabled={customSlotsForDay.length === 0}
              >
                Salvar horários personalizados
              </Button>
              {customSlotsForDay.length > 0 && (
                <Button
                  variant="text"
                  size="small"
                  color="error"
                  onClick={handleClearCustomSlots}
                >
                  Limpar horários personalizados
                </Button>
              )}
            </Stack>
            <Typography variant="caption" color="textSecondary">
              Quando há horários personalizados para o dia, todos os horários do sistema para esta data passam a ser calculados por eles, com intervalo fixo de 70 minutos.
            </Typography>
          </Box>
          {/* ========== FIM SLOT PERSONALIZADO ============= */}

          <FormControl>
            <InputLabel>Hora</InputLabel>
            <Select
              name="time"
              value={session.time}
              label="Hora"
              onChange={e => {
                setSession(prevSession => {
                  // Se o pacote estiver selecionado, mantém o período do pacote
                  if (prevSession.packageId && activePackages.length > 0) {
                    const pkg = activePackages.find(p => p.id === prevSession.packageId);
                    return {
                      ...prevSession,
                      time: e.target.value,
                      period: pkg ? getDefaultPeriodForPackage(pkg.name) : ""
                    };
                  } else {
                    // Se não tem pacote, limpa o período para forçar o preenchimento
                    return {
                      ...prevSession,
                      time: e.target.value,
                      period: ""
                    };
                  }
                });
              }}
              disabled={!(session.date || format(new Date(), "yyyy-MM-dd"))}
            >
              {availableHours.length === 0 && (session.date || true) && (
                <MenuItem value="" disabled>
                  Nenhum horário disponível
                </MenuItem>
              )}
              {availableHours.map(opt =>
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              )}
            </Select>
          </FormControl>
          <TextField
            label="Tipo de Massagem"
            name="massageType"
            value={session.massageType}
            onChange={handleChange}
            placeholder="Ex: Relaxante, Terapêutica, etc."
          />
          <FormControl>
            <InputLabel>Período</InputLabel>
            <Select
              name="period"
              value={session.period}
              label="Período"
              onChange={handleChange}
              disabled={!!session.packageId}
            >
              {validPeriods.length === 0 && (
                <MenuItem value="" disabled>
                  Nenhum período disponível
                </MenuItem>
              )}
              {validPeriods.map(opt =>
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              )}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={!isSessionValid()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}