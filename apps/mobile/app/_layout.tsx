/**
 * Mise en page racine de l'app mobile (Expo Router).
 *
 * Rôle : navigation en pile commune à tous les écrans. Squelette minimal :
 * l'app mobile est développée après la bêta web (étape 10 du plan).
 */
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

/** @returns La navigation racine de l'application. */
export default function RootLayout(): ReactNode {
  return <Stack screenOptions={{ headerShown: false }} />;
}
