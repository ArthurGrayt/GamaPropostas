// utils.ts

/**
 * Aplica máscara de CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export const formatCNPJ = (value: string): string => {
  if (!value) return '';
  // Remove tudo que não for número
  let cnpj = value.replace(/\D/g, '');
  
  if (cnpj.length > 14) {
    cnpj = cnpj.slice(0, 14);
  }

  // Aplica a máscara
  cnpj = cnpj.replace(/^(\d{2})(\d)/, '$1.$2');
  cnpj = cnpj.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  cnpj = cnpj.replace(/\.(\d{3})(\d)/, '.$1/$2');
  cnpj = cnpj.replace(/(\d{4})(\d)/, '$1-$2');

  return cnpj;
};

/**
 * Valida o formato e os dígitos verificadores do CNPJ
 */
export const validateCNPJ = (cnpj: string): boolean => {
  if (!cnpj) return false;

  // Remove máscara
  const numbers = cnpj.replace(/[^\d]+/g, '');

  if (numbers.length !== 14) return false;

  // Elimina CNPJs invalidos conhecidos
  if (
    numbers === "00000000000000" || 
    numbers === "11111111111111" || 
    numbers === "22222222222222" || 
    numbers === "33333333333333" || 
    numbers === "44444444444444" || 
    numbers === "55555555555555" || 
    numbers === "66666666666666" || 
    numbers === "77777777777777" || 
    numbers === "88888888888888" || 
    numbers === "99999999999999"
  ) {
    return false;
  }

  // Valida DVs
  let length = numbers.length - 2;
  let numbersPart = numbers.substring(0, length);
  const digits = numbers.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbersPart.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  length = length + 1;
  numbersPart = numbers.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbersPart.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};
