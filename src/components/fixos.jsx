import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Snackbar,
  Alert,
  Switch,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { getClients, getSessions, saveClients, updateSessionsUsedForClientPackage } from "../utils/storage";
import { getDefaultPeriodForPackage, isIndividualPackageExpired, getPackageSessionNumber, getSessionsForPackage } from "../utils/packageUtils";
import { format, addDays } from "date-fns";

// --- Constantes ---
const DIAS_SEMANA = [
  { label: "Segunda-feira", value: 1 },
  { label: "Terça-feira", value: 2 },
  { label: "Quarta-feira", value: 3 },
  { label: "Quinta-feira", value: 4 },
  { label: "Sexta-feira", value: 5 },
  { label: "Sábado", value: 6 },
];

const PROFISSIONAIS = [
  { label: "Letícia", value: "leticia" },
  { label: "Dani", value: "dani" },
  { label: "Bia", value: "bia" }
];

const STORAGE_KEY = "horarios_fixos";

// --- Helpers ---
function loadFixos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveFixos(fixos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fixos));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}
function getClientName(clients, id) {
  return clients.find(c => c.id === id)?.name || "-";
}

// Calcula a próxima data do dia da semana a partir de hoje (inclusive hoje)
function getNextDateOfWeekFromToday(diaSemana) {
  const hoje = new Date();
  const hojeDia = hoje.getDay() === 0 ? 7 : hoje.getDay(); // 1=segunda, 7=domingo
  let diff = diaSemana - hojeDia;
  if (diff < 0) diff += 7;
  if (diff === 0) {
    return format(hoje, "yyyy-MM-dd");
  }
  const data = addDays(hoje, diff);
  return format(data, "yyyy-MM-dd");
}

// Salva sessão na chave do profissional
function saveSessionForProfissional(session, profissional) {
  const key = `sessions_${profissional}`;
  let profSessions = [];
  try {
    profSessions = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {}
  const idx = profSessions.findIndex(s => s.id === session.id);
  if (idx !== -1) {
    profSessions[idx] = session;
  } else {
    profSessions = [...profSessions, session];
  }
  localStorage.setItem(key, JSON.stringify(profSessions));
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

// Salva sessão na chave global
function saveSessionGlobal(session) {
  let allSessions = [];
  try {
    allSessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  } catch {}
  const idx = allSessions.findIndex(s => s.id === session.id);
  if (idx !== -1) {
    allSessions[idx] = session;
  } else {
    allSessions = [...allSessions, session];
  }
  localStorage.setItem("sessions", JSON.stringify(allSessions));
  window.dispatchEvent(new StorageEvent("storage", { key: "sessions" }));
}

// Função para buscar todas as sessões do sistema (global + profissionais)
function getAllSessions() {
  let all = [];
  const global = JSON.parse(localStorage.getItem("sessions") || "[]");
  all = all.concat(global);
  for (const prof of PROFISSIONAIS) {
    const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof.value}`) || "[]");
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

export default function Fixos() {
  const [fixos, setFixos] = useState([]);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    diaSemana: 1,
    hora: "",
    periodo: "",
    pacoteId: "",
    isAvulsa: true,
    profissional: PROFISSIONAIS[0].value,
    ativo: true,
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Carrega dados
  useEffect(() => {
    setFixos(loadFixos());
    setClients(getClients());
    setSessions(getSessions());
    const handler = () => {
      setFixos(loadFixos());
      setClients(getClients());
      setSessions(getSessions());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Pacotes ativos do cliente selecionado
  const activePackages = useMemo(() => {
    const client = clients.find(c => c.id === form.clientId);
    if (!client || !Array.isArray(client.packages)) return [];
    return client.packages.filter(pkg => !isIndividualPackageExpired(pkg));
  }, [clients, form.clientId]);

  // Atualiza período/pacote ao trocar cliente/pacote
  useEffect(() => {
    if (!form.clientId) {
      setForm(f => ({
        ...f,
        pacoteId: "",
        periodo: "",
        isAvulsa: true,
      }));
      return;
    }
    if (activePackages.length > 0) {
      const pacoteId = activePackages.length === 1 ? activePackages[0].id : "";
      setForm(f => ({
        ...f,
        isAvulsa: false,
        pacoteId,
        periodo: pacoteId
          ? getDefaultPeriodForPackage(activePackages.find(p => p.id === pacoteId)?.name)
          : "",
      }));
    } else {
      setForm(f => ({
        ...f,
        pacoteId: "",
        periodo: "",
        isAvulsa: true,
      }));
    }
    // eslint-disable-next-line
  }, [form.clientId, activePackages.length]);

  useEffect(() => {
    if (!form.isAvulsa && form.pacoteId) {
      const pkg = activePackages.find(p => p.id === form.pacoteId);
      setForm(f => ({
        ...f,
        periodo: pkg ? getDefaultPeriodForPackage(pkg.name) : "",
      }));
    }
    // eslint-disable-next-line
  }, [form.pacoteId, form.isAvulsa]);

  // Lista de horários fixos para confirmar agendamento nesta semana
  const fixosParaConfirmar = fixos
    .filter(f => f.ativo)
    .map(f => {
      const data = getNextDateOfWeekFromToday(Number(f.diaSemana));
      const profSessions = JSON.parse(localStorage.getItem(`sessions_${f.profissional || PROFISSIONAIS[0].value}`) || "[]");
      const jaMarcada = profSessions.some(
        s =>
          s.clientId === f.clientId &&
          s.date === data &&
          s.time === f.hora &&
          s.status !== "cancelled"
      );
      return { ...f, data, jaMarcada };
    })
    .filter(f => !f.jaMarcada);

  // Pacote ativo do cliente
  function getActivePackage(client, pacoteId) {
    if (!client || !Array.isArray(client.packages)) return null;
    if (pacoteId) return client.packages.find(pkg => pkg.id === pacoteId && !isIndividualPackageExpired(pkg));
    return client.packages.find(pkg => !isIndividualPackageExpired(pkg));
  }

  // Confirma/agendar horário fixo
  function handleConfirmarFixo(fixo) {
    const client = clients.find(c => c.id === fixo.clientId);
    if (!client) return;
    const pacote = getActivePackage(client, fixo.pacoteId);
    const sessionDate = getNextDateOfWeekFromToday(Number(fixo.diaSemana));
    const sessionId = `${fixo.clientId}_${sessionDate}_${fixo.hora}_fixo`;
    let isAvulsa = fixo.isAvulsa || !pacote;
    let period = pacote ? getDefaultPeriodForPackage(pacote.name) : fixo.periodo || "1h";
    let massageType = "Massagem";
    let packageId = pacote ? pacote.id : "";
    let packageName = pacote ? pacote.name : "";
    let profissional = fixo.profissional || PROFISSIONAIS[0].value;

    // --- NOVO: sincronizar número da sessão do pacote ---
    // Busca todas as sessões do sistema (global + profissionais)
    const allSessions = getAllSessions();
    // O número da sessão é calculado dinamicamente
    let packageSessionNumber = null;
    if (pacote && !isAvulsa) {
      packageSessionNumber = getPackageSessionNumber(client, pacote.id, allSessions.concat([ // inclui a sessão que será criada
        {
          id: sessionId,
          clientId: fixo.clientId,
          packageId: pacote.id,
          date: sessionDate,
          time: fixo.hora,
          status: "scheduled"
        }
      ]), sessionId);
    }

    const newSession = {
      id: sessionId,
      clientId: fixo.clientId,
      clientName: client.name,
      date: sessionDate,
      time: fixo.hora,
      massageType,
      period,
      status: "scheduled",
      packageId,
      packageName,
      isAvulsa,
      profissional,
      notes: "Agendado por horário fixo",
      observacao: "",
      packageSession: packageSessionNumber,
    };

    saveSessionForProfissional(newSession, profissional);
    saveSessionGlobal(newSession);

    setSnackbar({ open: true, message: "Sessão agendada!", severity: "success" });
  }

  // Excluir horário fixo
  function handleDeleteFixo(id) {
    if (!window.confirm("Excluir este horário fixo?")) return;
    const novos = fixos.filter(f => f.id !== id);
    setFixos(novos);
    saveFixos(novos);
  }

  // Ativar/desativar
  function handleToggleAtivo(id) {
    const novos = fixos.map(f => f.id === id ? { ...f, ativo: !f.ativo } : f);
    setFixos(novos);
    saveFixos(novos);
  }

  // Criar novo horário fixo
  function handleSaveFixo() {
    if (!form.clientId || !form.hora || !form.periodo || !form.profissional) {
      setSnackbar({ open: true, message: "Preencha todos os campos!", severity: "warning" });
      return;
    }
    const novo = { ...form, id: Date.now().toString() };
    const novos = [...fixos, novo];
    setFixos(novos);
    saveFixos(novos);
    setOpenDialog(false);
    setForm({
      clientId: "",
      diaSemana: 1,
      hora: "",
      periodo: "",
      pacoteId: "",
      isAvulsa: true,
      profissional: PROFISSIONAIS[0].value,
      ativo: true,
    });
    setSnackbar({ open: true, message: "Horário fixo criado!", severity: "success" });
  }

  // Form change
  function handleFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (name === "isAvulsa" && checked) {
      setForm(f => ({
        ...f,
        pacoteId: "",
        periodo: "",
      }));
    }
    if (name === "pacoteId") {
      const pkg = activePackages.find(p => p.id === value);
      setForm(f => ({
        ...f,
        periodo: pkg ? getDefaultPeriodForPackage(pkg.name) : "",
      }));
    }
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, color: "#224488" }}>
        Horários Fixos
      </Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        sx={{ mb: 2 }}
        onClick={() => setOpenDialog(true)}
      >
        Criar horário fixo
      </Button>

      {/* Lista de horários fixos */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Lista de Horários Fixos</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Dia</TableCell>
              <TableCell>Horário</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Profissional</TableCell>
              <TableCell>Pacote?</TableCell>
              <TableCell>Ativo</TableCell>
              <TableCell>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fixos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">Nenhum horário fixo cadastrado</TableCell>
              </TableRow>
            )}
            {fixos.map(fixo => {
              const client = clients.find(c => c.id === fixo.clientId);
              const pacote = getActivePackage(client, fixo.pacoteId);
              return (
                <TableRow key={fixo.id}>
                  <TableCell>{getClientName(clients, fixo.clientId)}</TableCell>
                  <TableCell>{DIAS_SEMANA.find(d => d.value === Number(fixo.diaSemana))?.label}</TableCell>
                  <TableCell>{fixo.hora}</TableCell>
                  <TableCell>{fixo.periodo}</TableCell>
                  <TableCell>{PROFISSIONAIS.find(p => p.value === fixo.profissional)?.label || "-"}</TableCell>
                  <TableCell>{pacote ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <Switch checked={fixo.ativo} onChange={() => handleToggleAtivo(fixo.id)} />
                  </TableCell>
                  <TableCell>
                    <IconButton color="error" onClick={() => handleDeleteFixo(fixo.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Lista para confirmar agendamento */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Confirmar Agendamento de Horários Fixos</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cliente</TableCell>
              <TableCell>Dia</TableCell>
              <TableCell>Horário</TableCell>
              <TableCell>Período</TableCell>
              <TableCell>Profissional</TableCell>
              <TableCell>Pacote?</TableCell>
              <TableCell>Agendar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fixosParaConfirmar.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">Nenhum horário fixo para agendar</TableCell>
              </TableRow>
            )}
            {fixosParaConfirmar.map(fixo => {
              const client = clients.find(c => c.id === fixo.clientId);
              const pacote = getActivePackage(client, fixo.pacoteId);
              return (
                <TableRow key={fixo.id + fixo.data}>
                  <TableCell>{getClientName(clients, fixo.clientId)}</TableCell>
                  <TableCell>{DIAS_SEMANA.find(d => d.value === Number(fixo.diaSemana))?.label}</TableCell>
                  <TableCell>{fixo.hora}</TableCell>
                  <TableCell>{fixo.periodo}</TableCell>
                  <TableCell>{PROFISSIONAIS.find(p => p.value === fixo.profissional)?.label || "-"}</TableCell>
                  <TableCell>{pacote ? "Sim" : "Não"}</TableCell>
                  <TableCell>
                    <IconButton color="success" onClick={() => handleConfirmarFixo(fixo)}>
                      <CheckCircleIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Dialog de criação */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Criar horário fixo</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Cliente</InputLabel>
            <Select
              name="clientId"
              value={form.clientId}
              label="Cliente"
              onChange={handleFormChange}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Dia da semana</InputLabel>
            <Select
              name="diaSemana"
              value={form.diaSemana}
              label="Dia da semana"
              onChange={handleFormChange}
            >
              {DIAS_SEMANA.map(d => (
                <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Profissional</InputLabel>
            <Select
              name="profissional"
              value={form.profissional}
              label="Profissional"
              onChange={handleFormChange}
            >
              {PROFISSIONAIS.map(p => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Horário"
            name="hora"
            type="time"
            value={form.hora}
            onChange={handleFormChange}
            fullWidth
            sx={{ mb: 2 }}
            inputProps={{ step: 300 }}
          />
          {activePackages.length > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  name="isAvulsa"
                  checked={form.isAvulsa}
                  onChange={handleFormChange}
                  color="primary"
                />
              }
              label="Sessão Avulsa (sem pacote)"
            />
          )}
          {activePackages.length > 0 && !form.isAvulsa && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Pacote</InputLabel>
              <Select
                name="pacoteId"
                value={form.pacoteId}
                label="Pacote"
                onChange={handleFormChange}
              >
                {activePackages.map(pkg => (
                  <MenuItem key={pkg.id} value={pkg.id}>{pkg.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <TextField
            label="Período"
            name="periodo"
            value={form.periodo}
            onChange={handleFormChange}
            fullWidth
            sx={{ mb: 2 }}
            disabled={!form.isAvulsa && form.pacoteId}
            placeholder="Ex: 1h, 1h30, 2h"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveFixo}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}