const CLIENTS_KEY = "clients";
const SESSIONS_KEY = "sessions";
const PACKAGES_KEY = "packages";

// Função utilitária para forçar evento de storage (para atualização em tempo real)
function broadcastStorageChange(key) {
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

/**
 * Retorna todos os clientes salvos ou um array vazio.
 */
export function getClients() {
  return JSON.parse(localStorage.getItem(CLIENTS_KEY)) || [];
}

/**
 * Salva a lista de clientes.
 */
export function saveClients(clients) {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  broadcastStorageChange(CLIENTS_KEY);
}

/**
 * Retorna todas as sessões salvas ou um array vazio.
 * Se passado um profissional, retorna apenas as sessões desse profissional.
 */
export function getSessions(profissional) {
  if (!profissional) {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
  }
  return JSON.parse(localStorage.getItem(`sessions_${profissional}`)) || [];
}

/**
 * Salva a lista de sessões.
 * Se passado um profissional, salva apenas para esse profissional.
 */
export function saveSessions(sessions, profissional) {
  if (!profissional) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    broadcastStorageChange(SESSIONS_KEY);
  } else {
    localStorage.setItem(`sessions_${profissional}`, JSON.stringify(sessions));
    broadcastStorageChange(`sessions_${profissional}`);
  }
}

/**
 * Retorna todos os pacotes salvos ou um array vazio.
 */
export function getPackages() {
  return JSON.parse(localStorage.getItem(PACKAGES_KEY)) || [];
}

/**
 * Salva a lista de pacotes.
 */
export function savePackages(packages) {
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
  broadcastStorageChange(PACKAGES_KEY);
}

/**
 * Atualiza o campo sessionsUsed do pacote do cliente, baseado nas sessões "done" no sistema.
 */
export function updateSessionsUsedForClientPackage(clientId, packageId) {
  const clients = getClients();
  const sessions = [];
  // Pega todas as sessões de todos os profissionais + global
  const PROFISSIONAIS = ["leticia", "dani", "bia"];
  for (const prof of PROFISSIONAIS) {
    try {
      sessions.push(...(JSON.parse(localStorage.getItem(`sessions_${prof}`)) || []));
    } catch {}
  }
  try {
    sessions.push(...(JSON.parse(localStorage.getItem("sessions")) || []));
  } catch {}

  const clientIdx = clients.findIndex(c => c.id === clientId);
  if (clientIdx === -1) return;
  const client = clients[clientIdx];
  if (!client.packages) return;
  const pkgIdx = client.packages.findIndex(p => p.id === packageId);
  if (pkgIdx === -1) return;

  // Conta quantas sessões "done" existem para esse cliente/pacote
  const used = sessions.filter(
    s =>
      s.clientId === clientId &&
      s.packageId === packageId &&
      s.status === "done"
  ).length;

  clients[clientIdx].packages[pkgIdx].sessionsUsed = used;
  saveClients(clients);
}

/**
 * Retorna os horários da agenda semanal salvos, ou um padrão seguro caso não exista.
 * Garante que nunca retorna undefined ou null, evitando erros de tela branca.
 */
export function getStoredTimeSlots() {
  const stored = localStorage.getItem("agenda_time_slots");
  try {
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    }
  } catch (e) {
    // erro no parse, ignora e gera padrão
  }
  // Valor padrão: 6 dias (segunda a sábado)
  const week = [];
  for (let i = 0; i < 6; i++) {
    // ...defina slots padrão conforme sua lógica...
    week[i] = [];
  }
  return week;
}