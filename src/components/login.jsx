import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { Box, TextField, Button, Typography, Paper } from "@mui/material";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) setError(error.message);
    else if (onLogin) onLogin();
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7faf9" }}>
      <Paper sx={{ p: 4, minWidth: 320, borderRadius: 3, boxShadow: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, color: "#00695f", fontWeight: 700 }}>Login</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            required
          />
          <TextField
            label="Senha"
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            required
          />
          {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ fontWeight: 600 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}