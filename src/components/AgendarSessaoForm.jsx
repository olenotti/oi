import React, { useState, useEffect } from "react";
import { getClients } from "../utils/storage";
import { getDefaultPeriodForPackage, isIndividualPackageExpired } from "../utils/packageUtils";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";

export default function AgendarSessaoForm({ onSubmit }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [period, setPeriod] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Carrega clientes do storage
  useEffect(() => {
    setClients(getClients());
    // Sincroniza em tempo real, caso outro componente altere clientes/pacotes
    const handler = () => setClients(getClients());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Busca o cliente escolhido
  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Busca os pacotes ativos do cliente escolhido
  const activePackages = selectedClient
    ? (selectedClient.packages || []).filter(pkg => !isIndividualPackageExpired(pkg))
    : [];

  // Quando muda o pacote, preenche o período automaticamente
  useEffect(() => {
    if (!selectedClient) {
      setPeriod("");
      return;
    }
    const pkg = activePackages.find(p => p.id === selectedPackageId);
    if (pkg) {
      setPeriod(getDefaultPeriodForPackage(pkg.name));
    } else {
      setPeriod("");
    }
  }, [selectedClient, selectedPackageId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedClientId || !selectedPackageId || !period || !date || !time) return;
    const sessionData = {
      clientId: selectedClientId,
      packageId: selectedPackageId,
      period,
      date,
      time,
    };
    if (onSubmit) onSubmit(sessionData);
    // Limpa os campos
    setSelectedClientId("");
    setSelectedPackageId("");
    setPeriod("");
    setDate("");
    setTime("");
  };

  return (
    <Box sx={{ p: 2, maxWidth: 400 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Agendar Sessão
      </Typography>
      <form onSubmit={handleSubmit}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Cliente</InputLabel>
          <Select
            value={selectedClientId}
            label="Cliente"
            onChange={e => {
              setSelectedClientId(e.target.value);
              setSelectedPackageId("");
              setPeriod("");
            }}
            required
          >
            {clients.map(c => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth sx={{ mb: 2 }} disabled={!selectedClient}>
          <InputLabel>Pacote</InputLabel>
          <Select
            value={selectedPackageId}
            label="Pacote"
            onChange={e => setSelectedPackageId(e.target.value)}
            required
          >
            {activePackages.map(pkg => (
              <MenuItem key={pkg.id} value={pkg.id}>
                {pkg.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Período"
          value={period}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{ readOnly: true }}
        />
        <TextField
          label="Data"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          required
        />
        <TextField
          label="Hora"
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          required
        />
        <Button variant="contained" color="primary" type="submit" fullWidth>
          Agendar
        </Button>
      </form>
    </Box>
  );
}