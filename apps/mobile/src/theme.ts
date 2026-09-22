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
