import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const brand = {
  primary: '#1B7A43',
  income: '#2E7D32',
  expense: '#C62828',
  transfer: '#1565C0',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    secondary: '#4A6354',
    background: '#F4F5FA',
    surface: '#FFFFFF',
    income: brand.income,
    expense: brand.expense,
    transfer: brand.transfer,
  } as typeof MD3LightTheme.colors & { income: string; expense: string; transfer: string },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#6FCF97',
    income: '#81C784',
    expense: '#EF5350',
    transfer: '#64B5F6',
  } as typeof MD3DarkTheme.colors & { income: string; expense: string; transfer: string },
};

export type AppColors = typeof lightTheme.colors;

/** Shared card surface — rounded, subtle border, no heavy shadow. */
export const cardStyle = {
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#E8E9F0',
  backgroundColor: '#FFFFFF',
} as const;

/** Content column inside the centered app frame on wide screens. */
export const contentWidth = 1120;
