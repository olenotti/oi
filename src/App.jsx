import React, { useEffect, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme, Box, AppBar, Toolbar, Typography, Container, Button } from "@mui/material";
import SideMenu from "./components/SideMenu";
import PackageManager from "./components/PackageManager";
import ClientManager from "./components/ClientManager";
import ClienteConsultaView from "./components/ClienteConsultaView";
import ControleAtendimentosView from "./components/ControleAtendimentosView";
import Agendamentos from "./components/agendamentos";
import Fixos from "./components/fixos";
import AgendaVisual from "./components/AgendaVisual";
import { ClientesProvider } from "./context/ClientesContext";
import LoginPage from "./components/login"; // Corrija para o nome do arquivo: login.jsx
import { supabase } from "./supabaseClient";

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: "#00695f" },
    secondary: { main: "#e57373" }
  }
});

export default function App() {
  const [menu, setMenu] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  if (!user) return <LoginPage onLogin={() => supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))} />;

  return (
    <ClientesProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: "flex", minHeight: "100vh" }}>
          <SideMenu menu={menu} setMenu={setMenu} />
          <Box component="main" sx={{ flexGrow: 1 }}>
            <AppBar position="static">
              <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                  Le Renovare - Sistema de Gestão
                </Typography>
                <Button color="inherit" onClick={() => supabase.auth.signOut()}>
                  Sair
                </Button>
              </Toolbar>
            </AppBar>
            <Container sx={{ py: 3 }}>
              {menu === 0 && <ClientManager />}
              {menu === 1 && <PackageManager />}
              {menu === 2 && <Agendamentos />}
              {menu === 3 && <ClienteConsultaView />}
              {menu === 4 && <Fixos />}
              {menu === 5 && <ControleAtendimentosView />}
              {menu === 6 && <AgendaVisual />}
            </Container>
          </Box>
        </Box>
      </ThemeProvider>
    </ClientesProvider>
  );
}