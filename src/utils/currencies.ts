export interface Currency {
  code: string;
  name: string;
}

export const CURRENCY_LIST: Currency[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'TWD', name: 'Taiwan Dollar' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'ZAR', name: 'South African Rand' },
];

const orderMap = new Map<string, number>();
CURRENCY_LIST.forEach((c, idx) => {
  orderMap.set(c.code.toUpperCase(), idx);
});

export const compareCurrencies = (a: string, b: string): number => {
  const codeA = a.toUpperCase();
  const codeB = b.toUpperCase();
  const idxA = orderMap.get(codeA);
  const idxB = orderMap.get(codeB);

  if (idxA !== undefined && idxB !== undefined) {
    return idxA - idxB;
  }
  if (idxA !== undefined) return -1;
  if (idxB !== undefined) return 1;
  return codeA.localeCompare(codeB);
};
