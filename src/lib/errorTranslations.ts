export function translateError(error: any): string {
  if (!error) return "Ocorreu um erro desconhecido.";
  
  const msg = typeof error === 'string' ? error : (error.message || "");
  
  if (!msg) return "Ocorreu um erro desconhecido.";

  const lowerMsg = msg.toLowerCase();

  const translations: Record<string, string> = {
    "invalid login credentials": "E-mail ou senha incorretos.",
    "new password should be different from the old password.": "A nova senha deve ser diferente da antiga.",
    "user already registered": "Usuário já cadastrado.",
    "password should be at least 6 characters.": "A senha deve ter pelo menos 6 caracteres.",
    "password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
    "token has expired or is invalid": "O link é inválido ou expirou.",
    "email link is invalid or has expired": "O link de confirmação é inválido ou expirou.",
    "email not confirmed": "E-mail não confirmado.",
    "user not found": "Usuário não encontrado.",
    "banned": "Acesso suspenso pelo administrador.",
    "suspended": "Acesso suspenso pelo administrador.",
    "ban": "Acesso suspenso pelo administrador.",
  };

  for (const [key, value] of Object.entries(translations)) {
    if (lowerMsg.includes(key)) {
      return value;
    }
  }

  // Se for um erro de duplicidade no banco (Unique constraint)
  if (lowerMsg.includes("duplicate key value violates unique constraint")) {
    return "Já existe um registro com estes dados.";
  }

  // Falha de rede genérica
  if (lowerMsg.includes("fetch") || lowerMsg.includes("network")) {
    return "Erro de conexão. Verifique sua internet.";
  }

  // Retorna a original se não achar tradução (ou uma genérica se preferir, mas como há muita coisa específica, manter a original ajuda a debugar)
  return msg;
}
