const CLIENTS_KEY = "clients";
const SESSIONS_KEY = "sessions";
const PACKAGES_KEY = "packages";

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
}

/**
 * Retorna todas as sessões salvas ou um array vazio.
 */
export function getSessions() {
  return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
}

/**
 * Salva a lista de sessões.
 */
export function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
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
  // ...
  week[i] = slots;
}
return week;
}