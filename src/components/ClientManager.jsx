import React, { useState, useEffect } from "react";
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel
} from "@mui/material";
import { getClients, saveClients } from "../utils/storage";
import { getPackagesList, isIndividualPackageExpired } from "../utils/packageUtils";

// Suporte ao modelo antigo (client.package) e modelo novo (client.packages)
function emptyClient() {
  return {
    id: null,
    name: "",
    email: "",
    phone: "",
    birthday: "", // Campo de aniversário
    notes: "",
    package: "",
    packageValidity: "",
    packageSession: 0,
    // Novo modelo: array de pacotes
    packages: []
  }
}

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(emptyClient());
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    setClients(getClients());
    const handler = () => setClients(getClients());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Sempre mostra todos os pacotes do cliente (ativos e encerrados), mas exibe só o ativo no resumo
  const getActivePackage = (c) => {
    if (!c.packages || !c.packages.length) return null;
    return c.packages.find(pkg => !isIndividualPackageExpired(pkg)) || null;
  };

  const getPackageDisplay = c => {
    const active = getActivePackage(c);
    if (active) return active.name;
    return "-";
  };

  const getValidityDisplay = c => {
    const active = getActivePackage(c);
    if (active) return active.validity || "-";
    return "-";
  };

  const handleOpen = (c = null) => {
    setClient(c ? { ...emptyClient(), ...c } : emptyClient());
    setOpen(true);
  };

  const handleChange = (e) => {
    setClient({ ...client, [e.target.name]: e.target.value });
  };

  // Quando troca o pacote, também altera o array packages do novo modelo
  const handlePackageChange = (e) => {
    const pkgName = e.target.value;
    let updatedPackages = client.packages || [];
    if (pkgName) {
      // Modelo compatível: só um pacote ativo
      updatedPackages = [{
        id: client.packages?.[0]?.id || Math.floor(100 + Math.random() * 900).toString(),
        name: pkgName,
        validity: client.packageValidity || "",
        sessionsUsed: client.packageSession || 0
      }, ...(client.packages?.filter(pkg => isIndividualPackageExpired(pkg)) || [])];
    } else {
      // Remove todos os ativos, mantém só encerrados
      updatedPackages = (client.packages || []).filter(pkg => isIndividualPackageExpired(pkg));
    }
    setClient({
      ...client,
      package: pkgName,
      packages: updatedPackages
    });
  };

  // Quando altera validade, reflete nos dois modelos
  const handleValidityChange = (e) => {
    const val = e.target.value;
    let updatedPackages = client.packages || [];
    if (updatedPackages.length > 0) {
      // Só altera validade do pacote ativo
      updatedPackages = updatedPackages.map(pkg =>
        !isIndividualPackageExpired(pkg)
          ? { ...pkg, validity: val }
          : pkg
      );
    }
    setClient({
      ...client,
      packageValidity: val,
      packages: updatedPackages
    });
  };

  const handleSave = () => {
    let updated = [];
    if (client.id) {
      updated = clients.map(c => c.id === client.id ? { ...client } : c);
    } else {
      updated = [...clients, { ...client, id: Date.now() }];
    }
    setClients(updated);
    saveClients(updated);
    setOpen(false);
  };

  const handleDeleteClick = (c) => {
    setClientToDelete(c);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (clientToDelete) {
      const updated = clients.filter(c => c.id !== clientToDelete.id);
      setClients(updated);
      saveClients(updated);
      setDeleteDialog(false);
      setClientToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog(false);
    setClientToDelete(null);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Clientes</Typography>
      <Button variant="contained" sx={{ mb: 2 }} onClick={() => handleOpen()}>Novo Cliente</Button>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Telefone</TableCell>
            <TableCell>Aniversário</TableCell>
            <TableCell>Pacote</TableCell>
            <TableCell>Validade</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map(c => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.phone}</TableCell>
              <TableCell>{c.birthday || "-"}</TableCell>
              <TableCell>{getPackageDisplay(c)}</TableCell>
              <TableCell>{getValidityDisplay(c)}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => handleOpen(c)}>Editar</Button>
                <Button size="small" color="error" onClick={() => handleDeleteClick(c)} sx={{ ml: 1 }}>
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Dialog de Adição/Edição */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Cliente</DialogTitle>
        <DialogContent sx={{ minWidth: 350, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="Nome" name="name" value={client.name} onChange={handleChange} autoFocus />
          <TextField label="Email" name="email" value={client.email} onChange={handleChange} />
          <TextField label="Telefone" name="phone" value={client.phone} onChange={handleChange} />
          <TextField
            label="Aniversário (dd-mm)"
            name="birthday"
            value={client.birthday}
            onChange={handleChange}
            placeholder="24-08"
            inputProps={{ maxLength: 5 }}
          />
          <TextField label="Observações" name="notes" value={client.notes} onChange={handleChange} />
          <FormControl>
            <InputLabel>Pacote</InputLabel>
            <Select
              name="package"
              value={client.package}
              label="Pacote"
              onChange={handlePackageChange}
            >
              <MenuItem value="">Nenhum</MenuItem>
              {getPackagesList().map(pkg =>
                <MenuItem key={pkg} value={pkg}>{pkg}</MenuItem>
              )}
            </Select>
          </FormControl>
          <TextField
            label="Validade do pacote"
            name="packageValidity"
            type="date"
            value={client.packageValidity || ""}
            onChange={handleValidityChange}
            InputLabelProps={{ shrink: true }}
            disabled={!client.package}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Remoção */}
      <Dialog open={deleteDialog} onClose={handleDeleteCancel}>
        <DialogTitle>Remover Cliente</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja remover o cliente <strong>{clientToDelete?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancelar</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Remover</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}