import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  IconButton,
  Chip,
  Stack,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PhoneIcon from "@mui/icons-material/Phone";
import NotesIcon from "@mui/icons-material/Notes";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import EventNoteIcon from "@mui/icons-material/EventNote";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelIcon from "@mui/icons-material/Cancel";
import { getClients } from "../utils/storage";
import { getSessionsForPackage, isIndividualPackageExpired } from "../utils/packageUtils";

// Função para buscar todas as sessões do sistema (global + profissionais)
function getAllSessions() {
  let all = [];
  const global = JSON.parse(localStorage.getItem("sessions") || "[]");
  all = all.concat(global);
  const PROFISSIONAIS = ["leticia", "dani", "bia"];
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

// Função para mostrar o número da sessão do pacote (igual ao PackageManager)
function getPackageSessionDisplay(client, pkgId, allSessions, sessionId) {
  if (!pkgId || !client) return "-";
  const pkgObj = client.packages?.find(p => p.id === pkgId);
  if (!pkgObj) return "-";
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
  if (idx === -1) return "-";
  return `${sessionsUsedBase + idx + 1}/${total}`;
}

function getTotalSessionsUsed(client, pkg, allSessions) {
  const initialUsed = pkg.sessionsUsed ?? 0;
  const doneInSystem = allSessions.filter(
    s => s.clientId === client.id && s.packageId === pkg.id && s.status === "done"
  ).length;
  return initialUsed + doneInSystem;
}

export default function ClienteConsultaView() {
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setClients(getClients());
    setSessions(getAllSessions());
    const handler = () => {
      setClients(getClients());
      setSessions(getAllSessions());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const client = clients.find(c => c.id === selected);

  function handleRemoveSession(sessId) {
    let all = [];
    const global = JSON.parse(localStorage.getItem("sessions") || "[]");
    all = all.concat(global);
    const PROFISSIONAIS = ["leticia", "dani", "bia"];
    for (const prof of PROFISSIONAIS) {
      const profSessions = JSON.parse(localStorage.getItem(`sessions_${prof}`) || "[]");
      all = all.concat(profSessions);
    }
    const seen = new Set();
    all = all.filter(s => {
      if (!s.id) return false;
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    const updated = all.filter(s => s.id !== sessId);
    localStorage.setItem("sessions", JSON.stringify(updated.filter(s => !s.profissional)));
    for (const prof of PROFISSIONAIS) {
      localStorage.setItem(
        `sessions_${prof}`,
        JSON.stringify(updated.filter(s => s.profissional === prof))
      );
    }
    setSessions(updated);
  }

  function renderSessionsColumn(client, pkg, allSessions) {
    const sessionsList = allSessions
      .filter(
        s =>
          s.clientId === client.id &&
          s.packageId === pkg.id &&
          (s.status === "scheduled" || s.status === "done")
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        return 0;
      });

    if (sessionsList.length === 0) return null;

    return (
      <Stack spacing={0.5} sx={{ mt: 1, mb: 1 }}>
        {sessionsList.map(sess => (
          <Box key={sess.id} sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 15 }}>
            <Chip
              size="small"
              color={sess.status === "done" ? "success" : "warning"}
              icon={sess.status === "done" ? <CheckCircleIcon /> : <HourglassEmptyIcon />}
              label={`Sessão ${getPackageSessionDisplay(client, pkg.id, allSessions, sess.id)}`}
              sx={{ minWidth: 110, fontWeight: 600 }}
            />
            <span>
              {sess.date} {sess.time}{" "}
              <span style={{ color: sess.status === "done" ? "#2e7d32" : "#bfa100", fontWeight: 500 }}>
                ({sess.status === "done" ? "Realizada" : "Agendada"})
              </span>
            </span>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 800, mx: "auto" }}>
      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, borderRadius: 4, boxShadow: "0 2px 12px 0 #0001" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#00695f", mb: 2 }}>
              Consulta de Cliente
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Buscar cliente"
                variant="outlined"
                size="small"
                sx={{ minWidth: 200 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Selecione o Cliente</InputLabel>
                <Select
                  value={selected}
                  label="Selecione o Cliente"
                  onChange={e => setSelected(e.target.value)}
                >
                  {filteredClients.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {client && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#00695f" }}>
                  {client.name}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PhoneIcon sx={{ fontSize: 18, color: "#888" }} />
                    <Typography variant="body2" sx={{ color: "#222" }}>
                      {client.phone || <i>não informado</i>}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <NotesIcon sx={{ fontSize: 18, color: "#888" }} />
                    <Typography variant="body2" sx={{ color: "#222" }}>
                      {client.notes || <i>nenhuma observação</i>}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
            {client && (
              <Paper sx={{ p: 2, borderRadius: 3, background: "#f7faf9", boxShadow: "0 1px 6px 0 #0001" }}>
                <Typography sx={{ fontWeight: 600, color: "#00695f", mb: 1 }}>
                  Pacotes do Cliente
                </Typography>
                {(client.packages && client.packages.length > 0) ? (
                  <Table size="small" sx={{ background: "transparent" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell><LocalOfferIcon sx={{ fontSize: 18, color: "#888" }} /></TableCell>
                        <TableCell>Pacote</TableCell>
                        <TableCell>Validade</TableCell>
                        <TableCell>Sessões</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Restantes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {client.packages.map(pkg => {
                        const total = getSessionsForPackage(pkg.name);
                        const usadas = getTotalSessionsUsed(client, pkg, sessions);
                        const restantes = Math.max(total - usadas, 0);
                        const status = isIndividualPackageExpired(pkg)
                          ? (pkg.validity && new Date().toISOString().slice(0,10) > pkg.validity
                              ? "Vencido por validade"
                              : "Encerrado por uso")
                          : "Ativo";
                        return (
                          <React.Fragment key={pkg.id}>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>{pkg.id}</TableCell>
                              <TableCell>{pkg.name}</TableCell>
                              <TableCell>{pkg.validity || "-"}</TableCell>
                              <TableCell>
                                <Chip
                                  label={`${usadas} / ${total}`}
                                  color={restantes === 0 ? "success" : "primary"}
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell>
                                {status === "Ativo" && (
                                  <Chip label="Ativo" color="success" size="small" icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} />
                                )}
                                {status === "Vencido por validade" && (
                                  <Chip label="Vencido" color="error" size="small" icon={<CancelIcon sx={{ fontSize: 16 }} />} />
                                )}
                                {status === "Encerrado por uso" && (
                                  <Chip label="Encerrado" color="warning" size="small" icon={<AssignmentIcon sx={{ fontSize: 16 }} />} />
                                )}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={restantes}
                                  color={restantes === 0 ? "success" : "default"}
                                  size="small"
                                  sx={{ fontWeight: 600 }}
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={6} sx={{ p: 0, border: "none", background: "#f5f5f7" }}>
                                {renderSessionsColumn(client, pkg, sessions)}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <Typography sx={{ mt: 1, color: "#888" }}><i>Nenhum pacote</i></Typography>
                )}
              </Paper>
            )}
          </Box>
        </Stack>
      </Paper>

      {client && (
        <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, boxShadow: "0 2px 12px 0 #0001" }}>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, color: "#00695f" }}>
            Histórico de Sessões
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><EventNoteIcon sx={{ fontSize: 18, color: "#888" }} /></TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Pacote/Sessão</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.filter(s => s.clientId === selected && s.status !== "cancelled").length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ color: "#888" }}>Nenhuma sessão encontrada</TableCell>
                </TableRow>
              )}
              {sessions
                .filter(s => s.clientId === selected && s.status !== "cancelled")
                .sort((a, b) => {
                  if (a.date !== b.date) return a.date.localeCompare(b.date);
                  if (a.time && b.time) return a.time.localeCompare(b.time);
                  if (a.time && !b.time) return -1;
                  if (!a.time && b.time) return 1;
                  return 0;
                })
                .map(sess => (
                <TableRow key={sess.id}>
                  <TableCell>{sess.date}</TableCell>
                  <TableCell>{sess.time}</TableCell>
                  <TableCell>{sess.massageType}</TableCell>
                  <TableCell>{sess.period}</TableCell>
                  <TableCell>
                    {sess.status === "scheduled"
                      ? <Chip label="Marcada" color="primary" size="small" icon={<HourglassEmptyIcon sx={{ fontSize: 16 }} />} />
                      : sess.status === "done"
                        ? <Chip label="Realizada" color="success" size="small" icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} />
                        : sess.status === "cancelled"
                          ? <Chip label="Cancelada" color="error" size="small" icon={<CancelIcon sx={{ fontSize: 16 }} />} />
                          : sess.status
                    }
                  </TableCell>
                  <TableCell>
                    {sess.packageId
                      ? getPackageSessionDisplay(client, sess.packageId, sessions, sess.id)
                      : <i>-</i>}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label="Remover sessão"
                      color="error"
                      onClick={() => handleRemoveSession(sess.id)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}