import React, { useState } from "react";
import { CssBaseline, ThemeProvider, createTheme, Box, AppBar, Toolbar, Typography, Container } from "@mui/material";
import SideMenu from "./components/SideMenu";
import PackageManager from "./components/PackageManager";
import ClientManager from "./components/ClientManager";
import ScheduleManager from "./components/ScheduleManager";
import ClienteConsultaView from "./components/ClienteConsultaView";
import ControleAtendimentosView from "./components/ControleAtendimentosView"; // <-- IMPORTAÇÃO NOVA

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: "#00695f" },
    secondary: { main: "#e57373" }
  }
});

export default function App() {
  const [menu, setMenu] = useState(0);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <SideMenu menu={menu} setMenu={setMenu} />
        <Box component="main" sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Le Renovare - Sistema de Gestão {/* Texto atualizado */}
              </Typography>
            </Toolbar>
          </AppBar>
          <Container sx={{ py: 3 }}>
            {menu === 0 && <ClientManager />}
            {menu === 1 && <PackageManager />}
            {menu === 2 && <ScheduleManager />}
            {menu === 3 && <ClienteConsultaView />}
            {menu === 5 && <ControleAtendimentosView />} {/* <-- NOVA ABA */}
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
