/**
 * Maps raw database/API error messages to user-friendly messages in PT-BR.
 * Prevents leaking internal schema details to end users.
 */
export function mapErrorMessage(error: any): string {
  const message = error?.message || '';

  if (message.includes('duplicate key')) return 'Este registro já existe.';
  if (message.includes('foreign key')) return 'Não é possível remover — existem registros vinculados.';
  if (message.includes('violates check')) return 'Dados inválidos fornecidos.';
  if (message.includes('permission denied') || message.includes('row-level security'))
    return 'Você não tem permissão para esta ação.';
  if (message.includes('JWT')) return 'Sua sessão expirou. Faça login novamente.';

  console.error('Unhandled error:', error);
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
