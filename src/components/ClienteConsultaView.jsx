import React, { useState, useEffect } from "react";
import {
  Box, Typography, Paper, MenuItem, FormControl, InputLabel, Select, Table, TableHead, TableRow, TableCell, TableBody, TextField, IconButton
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { getClients, getSessions, saveSessions } from "../utils/storage";
import { getSessionsForPackage, isIndividualPackageExpired } from "../utils/packageUtils";

export default function ClienteConsultaView() {
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setClients(getClients());
    setSessions(getSessions());
    // Atualiza sempre que houver alteração no localStorage, espelhando qualquer alteração feita em qualquer aba
    const handler = () => {
      setClients(getClients());
      setSessions(getSessions());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Filtra clientes conforme busca
  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const client = clients.find(c => c.id === selected);

  // Agrupar sessões por pacoteId (se existir), senão por pacote antigo
  function getSessionsByPackage(pkg) {
    if (!pkg || !pkg.id) return [];
    return sessions
      .filter(s => s.clientId === selected && s.packageId === pkg.id && s.status === "done")
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  // Remover sessão do histórico
  function handleRemoveSession(sessId) {
    const updated = sessions.filter(s => s.id !== sessId);
    setSessions(updated);
    saveSessions(updated);
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Consulta de Cliente</Typography>
      <TextField
        label="Buscar cliente"
        variant="outlined"
        size="small"
        sx={{ minWidth: 250, mb: 2, mr: 2 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <FormControl sx={{ minWidth: 250, mb: 2 }}>
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

      {client && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">{client.name}</Typography>
          <Typography>Email: {client.email || <i>não informado</i>}</Typography>
          <Typography>Telefone: {client.phone || <i>não informado</i>}</Typography>
          <Typography>Observações: {client.notes || <i>nenhuma</i>}</Typography>
          <Typography sx={{ mt: 2, fontWeight: "bold" }}>Pacotes do Cliente</Typography>
          {(client.packages && client.packages.length > 0) ? (
            <Table size="small" sx={{ my: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Pacote</TableCell>
                  <TableCell>Validade</TableCell>
                  <TableCell>Sessões</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Sessões Restantes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {client.packages.map(pkg => {
                  const pkgSessions = getSessionsByPackage(pkg);
                  const total = getSessionsForPackage(pkg.name);
                  const usadas = pkg.sessionsUsed ?? pkgSessions.length;
                  const restantes = Math.max(total - usadas, 0);
                  const status = isIndividualPackageExpired(pkg)
                    ? (pkg.validity && new Date().toISOString().slice(0,10) > pkg.validity
                        ? "Vencido por validade"
                        : "Encerrado por uso")
                    : "Ativo";
                  return (
                    <TableRow key={pkg.id}>
                      <TableCell>{pkg.id}</TableCell>
                      <TableCell>{pkg.name}</TableCell>
                      <TableCell>{pkg.validity || "-"}</TableCell>
                      <TableCell>{`${usadas} / ${total}`}</TableCell>
                      <TableCell>{status}</TableCell>
                      <TableCell>{restantes}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Typography sx={{ mt: 1 }}><i>Nenhum pacote</i></Typography>
          )}
        </Paper>
      )}

      {client && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>Histórico de Sessões</Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Hora</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>ID Pacote</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.filter(s => s.clientId === selected && s.status !== "cancelled").length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">Nenhuma sessão encontrada</TableCell>
                </TableRow>
              )}
              {sessions
                .filter(s => s.clientId === selected && s.status !== "cancelled")
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map(sess => (
                <TableRow key={sess.id}>
                  <TableCell>{sess.date}</TableCell>
                  <TableCell>{sess.time}</TableCell>
                  <TableCell>{sess.massageType}</TableCell>
                  <TableCell>{sess.period}</TableCell>
                  <TableCell>
                    {sess.status === "scheduled"
                      ? "Marcada"
                      : sess.status === "done"
                        ? "Realizada"
                        : sess.status === "cancelled"
                          ? "Cancelada"
                          : sess.status
                    }
                  </TableCell>
                  <TableCell>{sess.packageId || <i>-</i>}</TableCell>
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
        </>
      )}
    </Box>
  );
}