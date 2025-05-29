import React, { createContext, useContext, useState } from "react";

const ClientesContext = createContext();

export function useClientes() {
  return useContext(ClientesContext);
}

export function ClientesProvider({ children }) {
  const [clientes, setClientes] = useState([
    { id: 1, nome: "Ana Paula", telefone: "+55 11 91234-5678", pacote: { periodo: "1h", total: 10, usadas: 3 } },
    { id: 2, nome: "João Silva", telefone: "+55 11 99876-5432" },
    { id: 3, nome: "Maria Souza", telefone: "+55 11 98765-4321", pacote: { periodo: "1h30", total: 5, usadas: 2 } }
  ]);

  return (
    <ClientesContext.Provider value={{ clientes, setClientes }}>
      {children}
    </ClientesContext.Provider>
  );
}