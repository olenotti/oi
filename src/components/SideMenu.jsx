import React from "react";
import { List, ListItem, ListItemText, ListItemIcon } from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventIcon from "@mui/icons-material/Event";
import GroupIcon from "@mui/icons-material/Group";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import HistoryEduIcon from "@mui/icons-material/HistoryEdu"; // Novo ícone

const menuItems = [
  { label: "Clientes", icon: <GroupIcon />, idx: 0 },
  { label: "Pacotes", icon: <AssignmentIndIcon />, idx: 1 },
  { label: "Agendamentos", icon: <EventIcon />, idx: 2 },
  { label: "Consulta Cliente", icon: <PersonSearchIcon />, idx: 3 },
  { label: "Controle de Atendimentos", icon: <HistoryEduIcon />, idx: 5 } // Nova aba
];

export default function SideMenu({ menu, setMenu }) {
  return (
    <nav>
      <List>
        {menuItems.map(item => (
          <ListItem
            button
            key={item.idx}
            selected={menu === item.idx}
            onClick={() => setMenu(item.idx)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </nav>
  );
}