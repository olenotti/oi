// Lista dos pacotes existentes com nome, quantidade de sessões e período
export const PACKAGES = [
    {
      name: "Relax 5 sessões (30 min)",
      sessions: 5,
      period: "30min"
    },
    {
      name: "Relax 10 sessões (30 min)",
      sessions: 10,
      period: "30min"
    },
    {
      name: "Renove 5 sessões (1h)",
      sessions: 5,
      period: "1h"
    },
    {
      name: "Renove 10 sessões (1h)",
      sessions: 10,
      period: "1h"
    },
    {
      name: "Revigore 5 sessões (1h30)",
      sessions: 5,
      period: "1h30"
    },
    {
      name: "Revigore 10 sessões (1h30)",
      sessions: 10,
      period: "1h30"
    },
    {
      name: "Renovare 5 sessões (2h)",
      sessions: 5,
      period: "2h"
    },
    {
      name: "Renovare 10 sessões (2h)",
      sessions: 10,
      period: "2h"
    },
    {
      name: "Pacote 20 sessões (1h30)",
      sessions: 20,
      period: "1h30"
    }
  ];
  
  // Retorna apenas os nomes dos pacotes
  export function getPackagesList() {
    return PACKAGES.map(p => p.name);
  }
  
  // Retorna a quantidade de sessões de um pacote pelo nome
  export function getSessionsForPackage(pkgName) {
    const found = PACKAGES.find(p => p.name === pkgName);
    return found ? found.sessions : 1;
  }
  
  // Retorna o período (duração) do pacote pelo nome
  export function getDefaultPeriodForPackage(pkgName) {
    const found = PACKAGES.find(p => p.name === pkgName);
    return found ? found.period : "";
  }
  
  // Gera um id de 3 dígitos aleatório para o pacote
  export function generatePackageId() {
    return Math.floor(100 + Math.random() * 900).toString();
  }
  
  // Verifica se um pacote individual está vencido (para estrutura por pacote)
  export function isIndividualPackageExpired(pkg) {
    const today = new Date().toISOString().slice(0, 10);
    if (pkg.validity && today > pkg.validity) return true;
    if ((pkg.sessionsUsed ?? 0) >= getSessionsForPackage(pkg.name)) return true;
    return false;
  }
  
  // (Mantém para retrocompatibilidade, mas use isIndividualPackageExpired para o novo modelo)
  export function isPackageExpired(client) {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const validade = client.packageValidity;
    // Considera encerrado por validade se a data já passou
    if (validade && today > validade) return true;
    // Considera encerrado por uso se não há mais sessões restantes
    if (client.package) {
      const total = getSessionsForPackage(client.package);
      const used = client.packageSession ?? 0;
      if (used >= total) return true;
    }
    return false;
  }