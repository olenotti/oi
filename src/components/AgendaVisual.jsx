import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  Button,
  Tooltip,
  Stack,
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import PersonIcon from "@mui/icons-material/Person";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// --- UTILITÁRIOS ---
function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function pad2(n) {
  return n.toString().padStart(2, "0");
}
function weekdayLabel(date) {
  const weekdays = [
    "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"
  ];
  const jsDay = date.getDay();
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return (
    `<span style="font-weight:600">${weekdays[idx]}</span><br/><span style="font-size:13px">${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}</span>`
  );
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

// --- BUSCA CLIENTES ---
function getClients() {
  try {
    return JSON.parse(localStorage.getItem("clients") || "[]");
  } catch {
    return [];
  }
}

// --- BUSCA TODAS AS SESSÕES DO SISTEMA ---
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

// --- BUSCA SESSÕES DO PROFISSIONAL ---
function getSessionsByProfissional(profissional) {
  const key = `sessions_${profissional}`;
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

// --- UTILITÁRIO: QUANTAS SESSÕES TEM O PACOTE PELO NOME ---
function getSessionsForPackage(pkgName) {
  // Adapte conforme seu sistema de pacotes
  if (!pkgName) return 1;
  if (/5/.test(pkgName)) return 5;
  if (/10/.test(pkgName)) return 10;
  if (/20/.test(pkgName)) return 20;
  return 1;
}

// --- UTILITÁRIO: NÚMERO DA SESSÃO NO PACOTE ---
function getPackageSessionNumber(client, pkgId, allSessions, sessionId) {
  if (!pkgId || !client) return "";
  const pkgObj = client.packages?.find(p => p.id === pkgId);
  if (!pkgObj) return "";
  const total = getSessionsForPackage(pkgObj.name || "");
  const sessionsUsedBase = pkgObj.sessionsUsed ?? 0;
  const sessions = allSessions
    .filter(
      s =>
        s.clientId === client.id &&
        s.packageId === pkgId &&
        (s.status === "scheduled" || s.status === "done")
    )
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return 0;
    });
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return "";
  return `${sessionsUsedBase + idx + 1}/${total}`;
}

// --- UTILITÁRIO: LINHA DE SESSÃO PARA CÓPIA ---
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

// --- HORÁRIOS LIVRES (igual agendamentos.jsx) ---
function getCustomSlotsForDate(date, profissional) {
  const customSlots = JSON.parse(localStorage.getItem("custom_slots_by_date") || "{}");
  return customSlots[`${date}_${profissional}`] || [];
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
  const customSlotsWithSession = customSlotsRaw.filter(slot =>
    daySessions.some(s => s.time === slot)
  );
  let firstMarked = null;
  if (customSlotsWithSession.length > 0) {
    const customMarkedMinutes = customSlotsWithSession.map(timeToMinutes);
    firstMarked = Math.min(...customMarkedMinutes);
  } else if (daySessions.length > 0) {
    firstMarked = daySessions[0].start;
  }
  let freeSlots = [];
  function fillSlotsBeforeMarked(markedTime) {
    let slot = markedTime - minDuration - interval;
    while (slot >= startExpediente) {
      const slotEnd = slot + minDuration;
      const conflict = daySessions.some(s =>
        (slot < s.end && slotEnd > s.start)
      );
      const overlapFree = freeSlots.some(free => {
        const freeStart = timeToMinutes(free);
        const freeEnd = freeStart + minDuration;
        return (slot < freeEnd && slotEnd > freeStart);
      });
      if (!conflict && !overlapFree) {
        freeSlots.push(
          `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`
        );
      }
      slot -= (minDuration + interval);
    }
  }
  function fillSlotsInInterval(windowStart, windowEnd) {
    let slot = windowStart;
    while (slot + minDuration <= windowEnd) {
      const slotEnd = slot + minDuration;
      const conflict = daySessions.some(s =>
        (slot < s.end && slotEnd > s.start)
      );
      if (!conflict) {
        freeSlots.push(
          `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`
        );
      }
      slot += (minDuration + interval);
    }
  }
  if (daySessions.length === 0) {
    fillSlotsInInterval(startExpediente, endExpediente);
  } else {
    if (customSlotsWithSession.length > 0 && firstMarked !== null && firstMarked > startExpediente) {
      fillSlotsBeforeMarked(firstMarked);
      for (let i = 0; i < daySessions.length - 1; i++) {
        const endCurr = daySessions[i].end;
        const startNext = daySessions[i + 1].start;
        fillSlotsInInterval(endCurr + interval, startNext - interval);
      }
      fillSlotsInInterval(daySessions[daySessions.length - 1].end + interval, endExpediente);
    } else {
      fillSlotsInInterval(startExpediente, daySessions[0].start - interval);
      for (let i = 0; i < daySessions.length - 1; i++) {
        const endCurr = daySessions[i].end;
        const startNext = daySessions[i + 1].start;
        fillSlotsInInterval(endCurr + interval, startNext - interval);
      }
      fillSlotsInInterval(daySessions[daySessions.length - 1].end + interval, endExpediente);
    }
  }
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

// --- CÓPIA NO MODELO AGENDAMENTOS.JSX ---
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
function getWeekStart(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
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
    let allTimes = [];
    for (const s of daySessions) {
      allTimes.push({
        time: s.time,
        type: "marcado",
        sessao: s
      });
    }
    for (const h of livres) {
      if (!daySessions.some(s => s.time === h)) {
        allTimes.push({
          time: h,
          type: "livre"
        });
      }
    }
    allTimes.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    if (allTimes.length === 0) continue;
    const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const weekLabel = weekdays[date.getDay() === 0 ? 6 : date.getDay() - 1];
    msg += `${weekLabel} (${pad2(date.getDate())}/${pad2(date.getMonth() + 1)})\n`;
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

// --- COMPONENTE PRINCIPAL ---
export default function AgendaVisual() {
  const [profissional, setProfissional] = useState(PROFISSIONAIS[0].value);
  const [period, setPeriod] = useState("1h");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  const clients = useMemo(() => getClients(), []);
  const allSessions = useMemo(() => getAllSessions(), []);
  const sessions = useMemo(() => getSessionsByProfissional(profissional), [profissional]);
  const weekDays = useMemo(() => {
    const days = [];
    const monday = new Date(startDate);
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [startDate]);

  const allTimesByDay = useMemo(() => {
    const obj = {};
    weekDays.forEach(date => {
      const dateStr = date.toISOString().slice(0, 10);
      const livres = getAvailableTimes({
        date: dateStr,
        sessions,
        period,
        profissional,
        minDuration: getMinutesFromPeriod(period),
        interval: 15
      });
      const daySessions = sessions
        .filter(s => s.date === dateStr)
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      const allTimesSet = new Set([
        ...livres,
        ...daySessions.map(s => s.time),
        ...getCustomSlotsForDate(dateStr, profissional)
      ]);
      obj[dateStr] = Array.from(allTimesSet).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    });
    return obj;
  }, [weekDays, period, profissional, sessions]);

  function handleCopyHorariosLivres(date, idx) {
    const dateStr = date.toISOString().slice(0, 10);
    const livres = getAvailableTimes({
      date: dateStr,
      sessions,
      period,
      profissional,
      minDuration: getMinutesFromPeriod(period),
      interval: 15
    });
    if (livres.length === 0) return;
    const weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const jsDay = date.getDay();
    const weekLabel = weekdays[jsDay === 0 ? 6 : jsDay - 1];
    const header = `${weekLabel} (${pad2(date.getDate())}/${pad2(date.getMonth() + 1)})`;
    const text = [header, ...livres].join("\n");
    navigator.clipboard.writeText(text);
  }

  function handleCopySemanaCompleta() {
    const weekStart = getWeekStart(startDate);
    const msg = buildWeekMarkedAndFreeCombined({
      sessions,
      clients,
      weekStart,
      allSessions,
      profissional,
    });
    navigator.clipboard.writeText(msg);
  }

  function goToPrevWeek() {
    setStartDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }
  function goToNextWeek() {
    setStartDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }

  return (
    <Box sx={{ p: { xs: 1, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
          <EventAvailableIcon sx={{ mr: 1, mb: "-4px", color: "#00695f" }} />
          Agenda Visual
        </Typography>
        <Tooltip title="Copiar horários marcados + livres (1h) da semana">
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopySemanaCompleta}
            sx={{
              borderRadius: 2,
              fontWeight: 500,
              bgcolor: "#f5f5f5",
              color: "#00695f",
              "&:hover": { bgcolor: "#e0f2f1" },
              boxShadow: "none",
              textTransform: "none"
            }}
          >
            Copiar horários
          </Button>
        </Tooltip>
      </Stack>
      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center", flexWrap: "wrap" }}>
        <Select
          value={profissional}
          onChange={e => setProfissional(e.target.value)}
          size="small"
          sx={{ minWidth: 140, bgcolor: "#f5f5f5", borderRadius: 2 }}
        >
          {PROFISSIONAIS.map(p => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
        <Select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          size="small"
          sx={{ minWidth: 120, bgcolor: "#f5f5f5", borderRadius: 2 }}
        >
          {PERIODOS.map(p => (
            <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
          ))}
        </Select>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={goToPrevWeek}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          <AccessTimeIcon sx={{ mr: 1, fontSize: 18 }} />
          Semana anterior
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={goToNextWeek}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
        >
          Próxima semana
          <AccessTimeIcon sx={{ ml: 1, fontSize: 18 }} />
        </Button>
      </Box>
      <Paper sx={{
        overflowX: "auto",
        p: { xs: 1, md: 3 },
        borderRadius: 4,
        boxShadow: "0 4px 24px 0 #0001"
      }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              {weekDays.map(date => (
                <TableCell
                  key={date.toISOString()}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    bgcolor: "#f5f5f5",
                    fontSize: 17,
                    borderRight: "2px solid #e0e0e0",
                    borderTopLeftRadius: date === weekDays[0] ? 16 : 0,
                    borderTopRightRadius: date === weekDays[weekDays.length - 1] ? 16 : 0,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: weekdayLabel(date)
                  }}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: Math.max(...weekDays.map(date => allTimesByDay[date.toISOString().slice(0, 10)].length)) }).map((_, idx) => (
              <TableRow key={idx} sx={{ "&:hover": { bgcolor: "#f9f9fa" } }}>
                {weekDays.map(date => {
                  const dateStr = date.toISOString().slice(0, 10);
                  const horarios = allTimesByDay[dateStr];
                  const horario = horarios[idx];
                  if (!horario) {
                    return <TableCell key={dateStr} />;
                  }
                  const daySessions = sessions.filter(s => s.date === dateStr);
                  const sessao = daySessions.find(s => s.time === horario);
                  if (sessao) {
                    // Mostra label do pacote na célula da tabela
                    let pacoteLabel = "";
                    if (sessao.packageId) {
                      const client = clients.find(c => c.id === sessao.clientId);
                      if (client) {
                        const sessaoNum = getPackageSessionNumber(client, sessao.packageId, allSessions, sessao.id);
                        if (sessaoNum) pacoteLabel = ` ${sessaoNum}`;
                      }
                    }
                    return (
                      <TableCell
                        key={dateStr}
                        align="center"
                        sx={{
                          bgcolor: sessao.status === "done" ? "#b9f6ca" : "#fff9c4",
                          color: "#111",
                          border: "1px solid #e0e0e0",
                          fontWeight: 500,
                          borderRadius: 2,
                          p: 0.5,
                          fontSize: 15,
                          boxShadow: sessao.status === "done"
                            ? "0 2px 8px 0 #b9f6ca55"
                            : sessao.status === "scheduled"
                            ? "0 2px 8px 0 #fff9c455"
                            : undefined,
                          transition: "box-shadow 0.2s"
                        }}
                      >
                        <Tooltip title={`Período: ${sessao.period}`}>
                          <span>
                            <b style={{ fontSize: 15 }}>{horario}</b>
                            <br />
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <PersonIcon sx={{ fontSize: 17, mb: "-2px", color: "#111" }} />
                              <span style={{ fontWeight: 600 }}>{sessao.clientName}</span>
                            </span>
                            <span style={{ fontSize: 12, color: "#111", fontWeight: 400, marginLeft: 6 }}>
                              • {sessao.period}{pacoteLabel}
                            </span>
                            <br />
                            <span style={{
                              fontSize: 12,
                              color: sessao.status === "done" ? "#2e7d32" : "#bfa100",
                              fontWeight: 600,
                              letterSpacing: 1
                            }}>
                              {sessao.status === "done"
                                ? <DoneAllIcon sx={{ fontSize: 15, mb: "-2px" }} />
                                : <AccessTimeIcon sx={{ fontSize: 14, mb: "-2px" }} />}
                              {sessao.status === "done" ? " Realizada" : " Marcada"}
                            </span>
                          </span>
                        </Tooltip>
                      </TableCell>
                    );
                  }
                  // Livre (branco)
                  return (
                    <TableCell
                      key={dateStr}
                      align="center"
                      sx={{
                        bgcolor: "#fff",
                        color: "#111",
                        border: "1px solid #e0e0e0",
                        fontWeight: 400,
                        borderRadius: 2,
                        p: 0.5,
                        fontSize: 15,
                        opacity: 0.95,
                        transition: "background 0.2s"
                      }}
                    >
                      <b style={{ fontSize: 15 }}>{horario}</b>
                      <br />
                      <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                        <AccessTimeIcon sx={{ fontSize: 15, mb: "-2px", color: "#bbb" }} /> Livre
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {/* Linha extra: botões de copiar horários livres do período selecionado */}
            <TableRow>
              {weekDays.map((date, idx) => (
                <TableCell key={date.toISOString()} align="center" sx={{ border: "none", pt: 2 }}>
                  <Tooltip title="Copiar horários livres" arrow>
                    <Button
                      variant="text"
                      size="small"
                      sx={{
                        minWidth: 0,
                        borderRadius: "50%",
                        p: 1,
                        color: "#00695f",
                        bgcolor: "#f5f5f5",
                        "&:hover": { bgcolor: "#e0f2f1" },
                        boxShadow: "none",
                        mx: "auto",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                      onClick={() => handleCopyHorariosLivres(date, idx)}
                    >
                      <ContentCopyIcon sx={{ fontSize: 22 }} />
                    </Button>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}