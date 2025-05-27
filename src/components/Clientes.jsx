import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Paper
} from "@mui/material";
import { getClients, saveClients } from "../utils/storage";

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setClients(getClients());
    const handler = () => setClients(getClients());
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const handleAddClient = () => {
    if (!name.trim()) return;
    const newClient = {
      id: Date.now().toString(),
      name,
      email,
      phone,
      notes,
      packages: []
    };
    const updatedClients = [...clients, newClient];
    setClients(updatedClients);
    saveClients(updatedClients);
    setOpen(false);
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
  };

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h5">Clientes</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Adicionar Cliente
        </Button>
      </Box>
      <TextField
        label="Buscar cliente"
        variant="outlined"
        size="small"
        sx={{ minWidth: 250, mb: 2 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Observações</TableCell>
              <TableCell>Qtde Pacotes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhum cliente cadastrado</TableCell>
              </TableRow>
            )}
            {filteredClients.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.email || <i>-</i>}</TableCell>
                <TableCell>{c.phone || <i>-</i>}</TableCell>
                <TableCell>{c.notes || <i>-</i>}</TableCell>
                <TableCell>{c.packages ? c.packages.length : 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Adicionar Cliente</DialogTitle>
        <DialogContent>
          <TextField
            label="Nome"
            fullWidth
            sx={{ mt: 2 }}
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <TextField
            label="Email"
            fullWidth
            sx={{ mt: 2 }}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <TextField
            label="Telefone"
            fullWidth
            sx={{ mt: 2 }}
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          <TextField
            label="Observações"
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 2 }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleAddClient}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}