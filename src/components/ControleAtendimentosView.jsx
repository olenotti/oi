import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  FormControl, InputLabel, Select, MenuItem, IconButton, TextField, Button
} from "@mui/material";
import { getClients } from "../utils/storage";
import { format, addWeeks, addMonths, subMonths, startOfMonth, isSameMonth, isSameWeek, parseISO, isValid, compareAsc } from "date-fns";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import DeleteIcon from "@mui/icons-material/Delete";
import { getSessionsForPackage } from "../utils/packageUtils";

// Tabela de valores dos pacotes
const PACOTE_VALUES = {
  "Relax 5 sessões (30 min)": 400,
  "Relax 10 sessões (30 min)": 750,
  "Renove 5 sessões (1h)": 725,
  "Renove 10 sessões (1h)": 1250,
  "Revigore 5 sessões (1h30)": 925,
  "Revigore 10 sessões (1h30)": 1650,
  "Renovare 5 sessões (2h)": 1375,
  "Renovare 10 sessões (2h)": 2550,
};

// Valores de sessão avulsa por período
const AVULSA_VALUES = {
  "30min": 85,
  "1h": 160,
  "1h30": 200,
  "2h": 290,
};

// Profissionais cadastrados no sistema
const PROFISSIONAIS = [
  "leticia",
  "dani",
  "bia"
];

// Entradas manuais: salva e carrega do localStorage
const MANUAL_ENTRIES_KEY = "manual_entries";

function getManualEntries() {
  return JSON.parse(localStorage.getItem(MANUAL_ENTRIES_KEY) || "[]");
}
function saveManualEntries(entries) {
  localStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(entries));
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Função para buscar sessões de todos os profissionais + global + horários fixos
function getAllSessions() {
  let all = [];
  // Global
  const global = JSON.parse(localStorage.getItem("sessions") || "[]");
  all = all.concat(global);
  // Por profissional
  for (const prof of PROFISSIONAIS) {
    const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
    all = all.concat(profSessions);
  }
  // Remove duplicadas (por id)
  const seen = new Set();
  return all.filter(s => {
    if (!s.id) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

// Função centralizada para mostrar o número da sessão do pacote (igual ao PackageManager)
function getPackageSessionDisplay(client, pkgId, allSessions, sessionId) {
  if (!pkgId || !client) return "-";
  const pkgObj = client.packages?.find(p => p.id === pkgId);
  if (!pkgObj) return "-";
  const total = getSessionsForPackage(pkgObj.name || "");
  // Soma sessionsUsed (manual) + sessões "done" no sistema, ordenadas por data/hora
  const sessionsUsedBase = pkgObj.sessionsUsed ?? 0;
  // Junta todas as sessões do cliente/pacote (de qualquer origem), status "done", ordenadas
  const sessions = allSessions
    .filter(
      s =>
        s.clientId === client.id &&
        s.packageId === pkgId &&
        s.status === "done"
    )
    .sort((a, b) => {
      const aDate = isValid(parseISO(a.date)) ? parseISO(a.date) : null;
      const bDate = isValid(parseISO(b.date)) ? parseISO(b.date) : null;
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      if (!aDate && !bDate) return 0;
      if (a.date !== b.date) return compareAsc(aDate, bDate);
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return 0;
    });
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return "-";
  // Soma a base sessionsUsed ao índice atual (idx + 1)
  return `${sessionsUsedBase + idx + 1}/${total}`;
}

// Remove sessão de todas as chaves (global e profissionais) e atualiza clients/pacotes se necessário
function removeSessionEverywhere(sessId, clients, setClients) {
  // Remove da chave global
  let allSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  allSessions = allSessions.filter(s => s.id !== sessId);
  localStorage.setItem("sessions", JSON.stringify(allSessions));

  // Remove de cada profissional
  for (const prof of PROFISSIONAIS) {
    let profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
    profSessions = profSessions.filter(s => s.id !== sessId);
    localStorage.setItem(`sessions_${prof}`, JSON.stringify(profSessions));
  }

  // Atualiza clients/pacotes: se a sessão era de pacote, diminui sessionsUsed
  let updatedClients = [...clients];
  let sessionRemoved = null;
  // Procurar a sessão removida para saber se era de pacote
  for (const prof of PROFISSIONAIS) {
    const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
    const found = profSessions.find(s => s.id === sessId);
    if (found) {
      sessionRemoved = found;
      break;
    }
  }
  if (!sessionRemoved) {
    // Tenta na global
    const globalSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessionRemoved = globalSessions.find(s => s.id === sessId);
  }
  if (sessionRemoved && sessionRemoved.packageId) {
    const clientIdx = updatedClients.findIndex(c => c.id === sessionRemoved.clientId);
    if (clientIdx !== -1 && Array.isArray(updatedClients[clientIdx].packages)) {
      const pkgIdx = updatedClients[clientIdx].packages.findIndex(p => p.id === sessionRemoved.packageId);
      if (pkgIdx !== -1) {
        // Recalcula sessionsUsed para esse pacote (conta só as sessões "done" restantes)
        // Busca todas as sessões desse cliente/pacote
        let allSess = [];
        for (const prof of PROFISSIONAIS) {
          const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
          allSess = allSess.concat(profSessions);
        }
        allSess = allSess.concat(JSON.parse(localStorage.getItem("sessions") || "[]"));
        const used = allSess.filter(
          s =>
            s.clientId === sessionRemoved.clientId &&
            s.packageId === sessionRemoved.packageId &&
            s.status === "done" &&
            s.id !== sessId // já removida
        ).length;
        updatedClients[clientIdx].packages[pkgIdx].sessionsUsed = used;
      }
    }
    setClients(updatedClients);
    localStorage.setItem("clients", JSON.stringify(updatedClients));
  }
}

export default function ControleAtendimentosView() {
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [tab, setTab] = useState("mes"); // "mes" ou "semana"
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [currentWeek, setCurrentWeek] = useState(getMonday(new Date()));
  // Entradas manuais
  const [manualEntries, setManualEntries] = useState(getManualEntries());
  const [manualValue, setManualValue] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  useEffect(() => {
    setSessions(getAllSessions());
    setClients(getClients());
    setManualEntries(getManualEntries());
    const handler = () => {
      setSessions(getAllSessions());
      setClients(getClients());
      setManualEntries(getManualEntries());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Pacotes "novos" vendidos no mês/semana (no client.packages)
  function getNewPackagesInPeriod(clients, periodCheck) {
    const pkgs = [];
    clients.forEach(client => {
      (client.packages || []).forEach(pkg => {
        if (pkg.isNew && pkg.newAssignedAt && periodCheck(pkg.newAssignedAt)) {
          pkgs.push({
            id: pkg.id,
            clientName: client.name,
            name: pkg.name,
            value: PACOTE_VALUES[pkg.name] || 0,
            date: pkg.newAssignedAt,
          });
        }
      });
    });
    return pkgs;
  }

  // Sessões avulsas realizadas no período (pega sessions marcadas como isAvulsa)
  function getAvulsasInPeriod(sessions, periodCheck, clients) {
    return sessions
      .filter(s => s.status === "done" && s.isAvulsa && s.date && periodCheck(s.date))
      .map(s => ({
        id: s.id,
        clientName: clients.find(c => c.id === s.clientId)?.name || "-",
        period: s.period,
        massageType: s.massageType,
        date: s.date,
        value: AVULSA_VALUES[s.period] || 0,
      }));
  }

  // Entradas manuais no período
  function getManualInPeriod(entries, periodCheck) {
    return entries
      .filter(e => e.date && periodCheck(e.date))
      .map(e => ({
        id: e.id,
        desc: e.desc,
        value: Number(e.value) || 0,
        date: e.date,
      }));
  }

  // Period checks
  const checkMonth = dateStr => isSameMonth(parseISO(dateStr), currentMonth);
  const checkWeek = dateStr => isSameWeek(parseISO(dateStr), currentWeek, { weekStartsOn: 1 });

  // Entradas do período selecionado
  const newPackages = getNewPackagesInPeriod(clients, tab === "mes" ? checkMonth : checkWeek);
  const avulsasDone = getAvulsasInPeriod(sessions, tab === "mes" ? checkMonth : checkWeek, clients);
  const manualDone = getManualInPeriod(manualEntries, tab === "mes" ? checkMonth : checkWeek);

  // Para tabela de sessões realizadas (agora pega todas as sessões realizadas, inclusive avulsas, de pacote e de horário fixo)
  const sessionsRealizadas = sessions.filter(
    s => s.status === "done"
  );
  const sessionsDoMes = sessionsRealizadas.filter(s =>
    isSameMonth(parseISO(s.date), currentMonth)
  );
  const sessionsDaSemana = sessionsRealizadas.filter(s =>
    isSameWeek(parseISO(s.date), currentWeek, { weekStartsOn: 1 })
  );

  // Soma total
  const totalEntrada = [
    ...newPackages.map(e => e.value),
    ...avulsasDone.map(e => e.value),
    ...manualDone.map(e => e.value)
  ].reduce((a, b) => a + b, 0);

  // Adicionar entrada manual
  function handleAddManualEntry() {
    if (!manualValue) return;
    const entry = {
      id: Date.now(),
      value: Number(manualValue),
      desc: manualDesc,
      date: format(new Date(), "yyyy-MM-dd"),
    };
    const updated = [entry, ...manualEntries];
    setManualEntries(updated);
    saveManualEntries(updated);
    setManualValue("");
    setManualDesc("");
  }

  function handleRemoveManualEntry(id) {
    const updated = manualEntries.filter(e => e.id !== id);
    setManualEntries(updated);
    saveManualEntries(updated);
  }

  // Remover avulsa do controle (remove sessão realizada, diminui saldo)
  function handleRemoveAvulsa(id) {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    // Remove de todas as chaves possíveis
    localStorage.setItem("sessions", JSON.stringify(updated));
    for (const prof of PROFISSIONAIS) {
      const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
      const filtered = profSessions.filter(s => s.id !== id);
      localStorage.setItem(`sessions_${prof}`, JSON.stringify(filtered));
    }
  }

  // Remover pacote novo do controle (tira flag isNew do pacote, diminui saldo)
  function handleRemoveNewPackage(pkgId) {
    const updatedClients = clients.map(client => {
      return {
        ...client,
        packages: (client.packages || []).map(pkg =>
          pkg.id === pkgId ? { ...pkg, isNew: false } : pkg
        )
      };
    });
    setClients(updatedClients);
    localStorage.setItem("clients", JSON.stringify(updatedClients));
  }

  // Remover sessão realizada (remove de todas as chaves e atualiza clients/pacotes)
  function handleRemoveRealizada(sessId) {
    if (!window.confirm("Remover este atendimento? Isso irá desfazer o registro da sessão.")) return;
    removeSessionEverywhere(sessId, clients, setClients);
    // Atualiza lista local
    setSessions(getAllSessions());
  }

  // Para mudar mês/semana
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handlePrevWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

  // Ajuda a mostrar cliente
  const getClientName = clientId => {
    const c = clients.find(cl => cl.id === clientId);
    return c ? c.name : "-";
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, color: "#224488" }}>
        Controle de Atendimentos Realizados
      </Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 160, mr: 2 }}>
          <InputLabel>Visualizar por</InputLabel>
          <Select
            value={tab}
            label="Visualizar por"
            onChange={e => setTab(e.target.value)}
          >
            <MenuItem value="mes">Mês</MenuItem>
            <MenuItem value="semana">Semana</MenuItem>
          </Select>
        </FormControl>
        {tab === "mes" ? (
          <Box sx={{ display: "inline-flex", alignItems: "center" }}>
            <IconButton onClick={handlePrevMonth}><ArrowBackIcon /></IconButton>
            <Typography sx={{ mx: 2, fontWeight: 500 }}>
              {format(currentMonth, "MMMM yyyy").charAt(0).toUpperCase() +
                format(currentMonth, "MMMM yyyy").slice(1)}
            </Typography>
            <IconButton onClick={handleNextMonth}><ArrowForwardIcon /></IconButton>
          </Box>
        ) : (
          <Box sx={{ display: "inline-flex", alignItems: "center" }}>
            <IconButton onClick={handlePrevWeek}><ArrowBackIcon /></IconButton>
            <Typography sx={{ mx: 2, fontWeight: 500 }}>
              Semana de {format(currentWeek, "dd/MM/yyyy")}
            </Typography>
            <IconButton onClick={handleNextWeek}><ArrowForwardIcon /></IconButton>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Entradas financeiras do período</Typography>
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <TextField
            label="Valor"
            size="small"
            type="number"
            value={manualValue}
            onChange={e => setManualValue(e.target.value)}
            sx={{ width: 120 }}
          />
          <TextField
            label="Descrição"
            size="small"
            value={manualDesc}
            onChange={e => setManualDesc(e.target.value)}
            sx={{ width: 220 }}
          />
          <Button variant="contained" color="primary" onClick={handleAddManualEntry}>
            Adicionar entrada manual
          </Button>
        </Box>
        <Typography variant="body1" sx={{ fontWeight: 600, color: "#00796b" }}>
          Total do período: <span style={{ fontSize: 22 }}>R$ {totalEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
        </Typography>
        <Table size="small" sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Cliente/Descrição</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {newPackages.map(e => (
              <TableRow key={"np-" + e.id}>
                <TableCell>Pacote Novo</TableCell>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.clientName} — {e.name}</TableCell>
                <TableCell>R$ {e.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => handleRemoveNewPackage(e.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {avulsasDone.map(e => (
              <TableRow key={"av-" + e.id}>
                <TableCell>Avulsa</TableCell>
                <TableCell>{e.date}</TableCell>
                <TableCell>
                  {e.clientName}
                  {e.period && <> — <b>{e.period}</b></>}
                  {e.massageType && <> — {e.massageType}</>}
                </TableCell>
                <TableCell>R$ {e.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => handleRemoveAvulsa(e.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {manualDone.map(e => (
              <TableRow key={"mn-" + e.id}>
                <TableCell>Manual</TableCell>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.desc || "-"}</TableCell>
                <TableCell>R$ {e.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" onClick={() => handleRemoveManualEntry(e.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {newPackages.length === 0 && avulsasDone.length === 0 && manualDone.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhuma entrada financeira no período</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">
            {tab === "mes" ? "Atendimentos realizados no mês" : "Atendimentos realizados na semana"}
          </Typography>
          <Typography variant="h6" sx={{ color: "green", fontWeight: 700 }}>
            {(tab === "mes" ? sessionsDoMes : sessionsDaSemana).length}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Hora</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Pacote</TableCell>
              <TableCell>Observações</TableCell>
              <TableCell>Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(tab === "mes" ? sessionsDoMes : sessionsDaSemana)
              .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.time < b.time ? 1 : -1)))
              .map(sess => (
                <TableRow key={sess.id}>
                  <TableCell>{sess.date}</TableCell>
                  <TableCell>{sess.time}</TableCell>
                  <TableCell>{getClientName(sess.clientId)}</TableCell>
                  <TableCell>{sess.massageType}</TableCell>
                  <TableCell>{sess.period}</TableCell>
                  <TableCell>
                    {sess.packageId
                      ? getPackageSessionDisplay(
                          clients.find(c => c.id === sess.clientId),
                          sess.packageId,
                          sessions,
                          sess.id
                        )
                      : "-"}
                  </TableCell>
                  <TableCell>{sess.notes || "-"}</TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveRealizada(sess.id)}
                      title="Remover atendimento"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            {(tab === "mes" ? sessionsDoMes : sessionsDaSemana).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">Nenhum atendimento realizado</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}