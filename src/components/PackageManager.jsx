import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, TextField, Checkbox, FormControlLabel
} from "@mui/material";
import { getClients, saveClients } from "../utils/storage";
import {
  getPackagesList,
  getSessionsForPackage,
  generatePackageId,
  isIndividualPackageExpired
} from "../utils/packageUtils";
import { getSessions } from "../utils/storage";

// Função para calcular dinamicamente o total de sessões usadas
function getTotalSessionsUsed(client, pkg, sessions) {
  const initialUsed = pkg.sessionsUsed ?? 0;
  const doneInSystem = sessions.filter(
    s => s.clientId === client.id && s.packageId === pkg.id && s.status === "done"
  ).length;
  return initialUsed + doneInSystem;
}

export default function PackageManager() {
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [session, setSession] = useState(0);
  const [validity, setValidity] = useState("");
  const [editingPackageId, setEditingPackageId] = useState(null);

  // Para o diálogo de adição global
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [addClientId, setAddClientId] = useState("");
  const [addPackage, setAddPackage] = useState("");
  const [addValidity, setAddValidity] = useState("");
  const [addSessionsUsed, setAddSessionsUsed] = useState(0);
  // NOVO: Flag para saber se é um pacote novo (entrada financeira)
  const [addIsNew, setAddIsNew] = useState(false);

  useEffect(() => {
    setClients(getClients());
    setSessions(getSessions());
    const handler = () => {
      setClients(getClients());
      setSessions(getSessions());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Atualiza pacotes encerrados para sempre refletirem em ClientManager
  useEffect(() => {
    const updatedClients = clients.map(client => {
      if (!client.packages || !client.packages.length) return client;
      const activePackages = client.packages.filter(pkg => !isIndividualPackageExpired(pkg));
      if (client.packages.length !== activePackages.length) {
        return {
          ...client,
          packages: activePackages,
          package: activePackages[0]?.name || "",
          packageValidity: activePackages[0]?.validity || "",
          packageSession: activePackages[0]?.sessionsUsed || 0
        };
      }
      return client;
    });
    if (JSON.stringify(updatedClients) !== JSON.stringify(clients)) {
      setClients(updatedClients);
      saveClients(updatedClients);
    }
    // eslint-disable-next-line
  }, []);

  function getAllPackagesByStatus(status) {
    const all = [];
    clients.forEach(client => {
      (client.packages || []).forEach(pkg => {
        if (status === "ativo" && !isIndividualPackageExpired(pkg)) {
          all.push({ client, pkg });
        }
        if (status === "encerrado" && isIndividualPackageExpired(pkg)) {
          all.push({ client, pkg });
        }
      });
    });
    return all;
  }

  const ativos = getAllPackagesByStatus("ativo");
  const encerrados = getAllPackagesByStatus("encerrado");

  const handleEdit = (client, pkg = null) => {
    setSelectedClient(client);
    if (pkg) {
      setEditingPackageId(pkg.id);
      setSelectedPackage(pkg.name);
      setSession(pkg.sessionsUsed ?? 0);
      setValidity(pkg.validity ?? "");
    } else {
      setEditingPackageId(null);
      setSelectedPackage("");
      setSession(0);
      setValidity("");
    }
    setOpen(true);
  };

  const handleSave = () => {
    const updatedClients = clients.map(c => {
      if (c.id !== selectedClient.id) return c;
      let packages = c.packages || [];
      if (editingPackageId) {
        packages = packages.map(pkg =>
          pkg.id === editingPackageId
            ? {
                ...pkg,
                name: selectedPackage,
                sessionsUsed: session,
                validity: validity
              }
            : pkg
        );
      } else {
        packages = [
          ...(packages || []),
          {
            id: generatePackageId(),
            name: selectedPackage,
            sessionsUsed: session,
            validity: validity
          }
        ];
      }
      return {
        ...c,
        packages,
        package: packages[0]?.name || "",
        packageValidity: packages[0]?.validity || "",
        packageSession: packages[0]?.sessionsUsed || 0
      };
    });
    setClients(updatedClients);
    saveClients(updatedClients);
    setOpen(false);
  };

  const handleRemove = (client, pkgId) => {
    if (!window.confirm("Tem certeza que deseja remover este pacote?")) return;
    const updatedClients = clients.map(c => {
      if (c.id !== client.id) return c;
      const pkgs = (c.packages || []).filter(p => p.id !== pkgId);
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
  };

  const handleAddPackage = () => {
    if (!addClientId || !addPackage) return;
    const updatedClients = clients.map(c => {
      if (c.id === addClientId) {
        const pkgs = [
          ...(c.packages || []),
          {
            id: generatePackageId(),
            name: addPackage,
            validity: addValidity,
            sessionsUsed: addSessionsUsed,
            isNew: !!addIsNew, // <- salva flag!
            newAssignedAt: addIsNew ? new Date().toISOString().slice(0, 10) : undefined // <- salva data
          }
        ];
        return {
          ...c,
          packages: pkgs,
          package: pkgs[0]?.name || "",
          packageValidity: pkgs[0]?.validity || "",
          packageSession: pkgs[0]?.sessionsUsed || 0
        };
      }
      return c;
    });
    setClients(updatedClients);
    saveClients(updatedClients);
    setOpenAddDialog(false);
    setAddClientId("");
    setAddPackage("");
    setAddValidity("");
    setAddSessionsUsed(0);
    setAddIsNew(false);
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">Pacotes Ativos</Typography>
        <Button variant="contained" onClick={() => setOpenAddDialog(true)}>
          Adicionar Pacote
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Cliente</TableCell>
            <TableCell>ID Pacote</TableCell>
            <TableCell>Nome do Pacote</TableCell>
            <TableCell>Sessões</TableCell>
            <TableCell>Validade</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ativos.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center">Nenhum pacote ativo</TableCell>
            </TableRow>
          )}
          {ativos.map(({ client, pkg }) => (
            <TableRow key={client.id + "-" + pkg.id}>
              <TableCell>{client.name}</TableCell>
              <TableCell>{pkg.id}</TableCell>
              <TableCell>{pkg.name}</TableCell>
              <TableCell>
                {getTotalSessionsUsed(client, pkg, sessions)} / {getSessionsForPackage(pkg.name)}
              </TableCell>
              <TableCell>{pkg.validity || "-"}</TableCell>
              <TableCell>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleEdit(client, pkg)}
                  sx={{ mr: 1 }}
                >
                  Editar
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={() => handleRemove(client, pkg.id)}
                >
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Typography variant="h5" sx={{ mb: 2, mt: 6 }}>Pacotes Encerrados</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Cliente</TableCell>
            <TableCell>ID Pacote</TableCell>
            <TableCell>Nome do Pacote</TableCell>
            <TableCell>Sessões</TableCell>
            <TableCell>Validade</TableCell>
            <TableCell>Status Encerramento</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {encerrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">Nenhum pacote encerrado</TableCell>
            </TableRow>
          )}
          {encerrados.map(({ client, pkg }) => (
            <TableRow key={client.id + "-" + pkg.id}>
              <TableCell>{client.name}</TableCell>
              <TableCell>{pkg.id}</TableCell>
              <TableCell>{pkg.name}</TableCell>
              <TableCell>
                {getTotalSessionsUsed(client, pkg, sessions)} / {getSessionsForPackage(pkg.name)}
              </TableCell>
              <TableCell>{pkg.validity || "-"}</TableCell>
              <TableCell>
                {(pkg.validity && new Date().toISOString().slice(0,10) > pkg.validity)
                  ? "Vencido por validade"
                  : "Todas as sessões usadas"}
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleEdit(client, pkg)}
                  sx={{ mr: 1 }}
                >
                  Editar
                </Button>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  onClick={() => handleRemove(client, pkg.id)}
                >
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Diálogo de edição/adicionar */}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>
          {editingPackageId ? "Editar Pacote" : "Adicionar Pacote"}
        </DialogTitle>
        <DialogContent sx={{ minWidth: 300 }}>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Pacote</InputLabel>
            <Select
              value={selectedPackage}
              label="Pacote"
              onChange={e => {
                setSelectedPackage(e.target.value);
                setSession(0);
                setValidity("");
              }}>
              {getPackagesList().map(pkg => (
                <MenuItem key={pkg} value={pkg}>{pkg}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedPackage &&
            <>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Sessões Usadas</InputLabel>
                <Select
                  value={session}
                  label="Sessões Usadas"
                  onChange={e => setSession(Number(e.target.value))}>
                  {Array.from({ length: getSessionsForPackage(selectedPackage) + 1 }, (_, i) => (
                    <MenuItem key={i} value={i}>{i}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Validade do pacote"
                type="date"
                fullWidth
                sx={{ mt: 2 }}
                value={validity}
                onChange={e => setValidity(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para adicionar pacote global */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Adicionar Pacote</DialogTitle>
        <DialogContent sx={{ minWidth: 300 }}>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Cliente</InputLabel>
            <Select
              value={addClientId}
              label="Cliente"
              onChange={e => setAddClientId(e.target.value)}
            >
              {clients.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Pacote</InputLabel>
            <Select
              value={addPackage}
              label="Pacote"
              onChange={e => {
                setAddPackage(e.target.value);
                setAddSessionsUsed(0);
                setAddValidity("");
              }}>
              {getPackagesList().map(pkg => (
                <MenuItem key={pkg} value={pkg}>{pkg}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {addPackage &&
            <>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Sessões Usadas</InputLabel>
                <Select
                  value={addSessionsUsed}
                  label="Sessões Usadas"
                  onChange={e => setAddSessionsUsed(Number(e.target.value))}
                >
                  {Array.from({ length: getSessionsForPackage(addPackage) + 1 }, (_, i) => (
                    <MenuItem key={i} value={i}>{i}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Validade do pacote"
                type="date"
                fullWidth
                sx={{ mt: 2 }}
                value={addValidity}
                onChange={e => setAddValidity(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <FormControlLabel
                sx={{ mt: 2 }}
                control={
                  <Checkbox
                    checked={addIsNew}
                    onChange={e => setAddIsNew(e.target.checked)}
                  />
                }
                label="Pacote Novo (considerar como entrada financeira)"
              />
              {addIsNew && (
                <Typography variant="caption" color="primary">
                  O valor de venda do pacote será somado no controle financeiro.
                </Typography>
              )}
            </>
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAddPackage}
            disabled={!addClientId || !addPackage}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}