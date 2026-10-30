import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Platform, type ColorValue } from 'react-native';

/**
 * SF Symbols only exist on iOS (backlog 17). Android and web get the closest
 * Material icon; a symbol with no match shows its fallback, as before.
 */
export const MATERIAL: Partial<Record<SFSymbol, keyof typeof MaterialIcons.glyphMap>> = {
  magnifyingglass: 'search',
  'text.bubble': 'chat-bubble-outline',
  suitcase: 'luggage',
  'person.crop.circle': 'account-circle',
  airplane: 'flight',
  'airplane.departure': 'flight-takeoff',
  'car.fill': 'directions-car',
  xmark: 'close',
  'xmark.circle': 'cancel',
  checkmark: 'check',
  plus: 'add',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  calendar: 'calendar-today',
  'arrow.left.arrow.right': 'swap-horiz',
  'cloud.rain': 'umbrella',
  'line.3.horizontal.decrease.circle': 'filter-list',
  'exclamationmark.circle': 'error-outline',
  'exclamationmark.triangle': 'warning-amber',
  'exclamationmark.triangle.fill': 'warning',
  'wifi.exclamationmark': 'wifi-off',
  'house.fill': 'home',
};

export interface IconProps {
  name: SFSymbol;
  size?: number;
  tintColor?: ColorValue;
  weight?: SymbolWeight;
  /** Shown where neither the SF Symbol nor a Material match is available. */
  fallback?: ReactNode;
}

export function Icon({ name, size = 24, tintColor, weight, fallback = null }: IconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={name} size={size} tintColor={tintColor} weight={weight} fallback={fallback} />;
  }
  const material = MATERIAL[name];
  // Material glyphs draw a little small next to SF Symbols at the same size.
  return material ? <MaterialIcons name={material} size={Math.round(size * 1.1)} color={typeof tintColor === 'number' ? undefined : (tintColor ?? undefined)} /> : <>{fallback}</>;
}
